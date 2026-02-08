#include "../include/graph.h"
#include <fstream>
#define _USE_MATH_DEFINES
#include <cmath>
#include <queue>
#include <algorithm>
#include <stdexcept>
#include <iostream>
#include <cstdio>

using namespace std;

Graph::~Graph() {
    unmapFile(nodesMap);
    unmapFile(offsetsMap);
    unmapFile(targetsMap);
    unmapFile(weightsMap);
}

bool Graph::mapFile(const string& filename, MappedFile& mf) {
#ifdef _WIN32
    mf.fileHandle = CreateFileA(filename.c_str(), GENERIC_READ, FILE_SHARE_READ, 
                                 nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (mf.fileHandle == INVALID_HANDLE_VALUE) {
        cerr << "Failed to open file: " << filename << endl;
        return false;
    }
    
    LARGE_INTEGER fileSize;
    if (!GetFileSizeEx(mf.fileHandle, &fileSize)) {
        CloseHandle(mf.fileHandle);
        mf.fileHandle = INVALID_HANDLE_VALUE;
        return false;
    }
    mf.size = static_cast<size_t>(fileSize.QuadPart);
    
    mf.mapHandle = CreateFileMapping(mf.fileHandle, nullptr, PAGE_READONLY, 0, 0, nullptr);
    if (!mf.mapHandle) {
        CloseHandle(mf.fileHandle);
        mf.fileHandle = INVALID_HANDLE_VALUE;
        return false;
    }
    
    mf.data = MapViewOfFile(mf.mapHandle, FILE_MAP_READ, 0, 0, 0);
    if (!mf.data) {
        CloseHandle(mf.mapHandle);
        CloseHandle(mf.fileHandle);
        mf.mapHandle = nullptr;
        mf.fileHandle = INVALID_HANDLE_VALUE;
        return false;
    }
#else
    mf.fd = open(filename.c_str(), O_RDONLY);
    if (mf.fd < 0) {
        cerr << "Failed to open file: " << filename << endl;
        return false;
    }
    
    struct stat sb;
    if (fstat(mf.fd, &sb) < 0) {
        close(mf.fd);
        mf.fd = -1;
        return false;
    }
    mf.size = sb.st_size;
    
    mf.data = mmap(nullptr, mf.size, PROT_READ, MAP_PRIVATE, mf.fd, 0);
    if (mf.data == MAP_FAILED) {
        close(mf.fd);
        mf.fd = -1;
        mf.data = nullptr;
        return false;
    }
#endif
    return true;
}

void Graph::unmapFile(MappedFile& mf) {
    if (!mf.data) return;
    
#ifdef _WIN32
    UnmapViewOfFile(mf.data);
    if (mf.mapHandle) CloseHandle(mf.mapHandle);
    if (mf.fileHandle != INVALID_HANDLE_VALUE) CloseHandle(mf.fileHandle);
    mf.mapHandle = nullptr;
    mf.fileHandle = INVALID_HANDLE_VALUE;
#else
    munmap(mf.data, mf.size);
    if (mf.fd >= 0) close(mf.fd);
    mf.fd = -1;
#endif
    mf.data = nullptr;
    mf.size = 0;
}

void Graph::loadNodes(const string& file){
    ifstream fin(file);
    if(!fin.is_open()) throw runtime_error("Cannot open " + file);
    fin.close();
}

double toRad(double deg){
    return deg * M_PI / 180.0;
}

double Graph::haversine(double lat1, double lon1, double lat2, double lon2){
    const double R = 6371;
    double dlat = toRad(lat2 - lat1);
    double dlon = toRad(lon2 - lon1);
    double a = sin(dlat/2)*sin(dlat/2) +
               cos(toRad(lat1))*cos(toRad(lat2))*
               sin(dlon/2)*sin(dlon/2);
    return 2 * R * asin(sqrt(a));
}

void Graph::loadEdges(const string& file){
    ifstream fin(file);
    if(!fin.is_open()) throw runtime_error("Cannot open " + file);
    fin.close();
}

void Graph::loadBinary(const string& prefix){
    string nodeFile = prefix + "nodes.bin";
    string offsetFile = prefix + "graph.offset";
    string targetFile = prefix + "graph.targets";
    string weightFile = prefix + "graph.weights";
    
    cerr << "Memory-mapping " << nodeFile << "..." << endl;
    if (!mapFile(nodeFile, nodesMap)) {
        throw runtime_error("Failed to mmap " + nodeFile);
    }
    nodes = reinterpret_cast<const Node*>(nodesMap.data);
    numNodes = nodesMap.size / sizeof(Node);
    cerr << "Mapped " << numNodes << " nodes (" << nodesMap.size / (1024*1024) << " MB)" << endl;
    
    cerr << "Memory-mapping " << offsetFile << "..." << endl;
    if (!mapFile(offsetFile, offsetsMap)) {
        throw runtime_error("Failed to mmap " + offsetFile);
    }
    offsets = reinterpret_cast<const unsigned int*>(offsetsMap.data);
    cerr << "Mapped offsets (" << offsetsMap.size / (1024*1024) << " MB)" << endl;
    
    cerr << "Memory-mapping " << targetFile << "..." << endl;
    if (!mapFile(targetFile, targetsMap)) {
        throw runtime_error("Failed to mmap " + targetFile);
    }
    targets = reinterpret_cast<const int*>(targetsMap.data);
    numEdges = targetsMap.size / sizeof(int);
    cerr << "Mapped " << numEdges << " edges (" << targetsMap.size / (1024*1024) << " MB)" << endl;
    
    cerr << "Memory-mapping " << weightFile << "..." << endl;
    if (!mapFile(weightFile, weightsMap)) {
        throw runtime_error("Failed to mmap " + weightFile);
    }
    weights = reinterpret_cast<const double*>(weightsMap.data);
    cerr << "Mapped weights (" << weightsMap.size / (1024*1024) << " MB)" << endl;
    
    cerr << "Total virtual memory mapped: " 
         << (nodesMap.size + offsetsMap.size + targetsMap.size + weightsMap.size) / (1024*1024) 
         << " MB (actual RAM usage is minimal)" << endl;
}

pair<double, vector<int>> Graph::dijkstra(int src, int dest){
    if(src < 0 || (size_t)src >= numNodes || dest < 0 || (size_t)dest >= numNodes) return {0.0, {}};
    
    priority_queue<pair<double, int>, vector<pair<double, int>>, greater<>> pq;
    vector<double> dist(numNodes, 1e18);
    vector<int> parent(numNodes, -1);
    
    dist[src] = 0;
    pq.push({0, src});
    
    while(!pq.empty()){
        double d = pq.top().first;
        int u = pq.top().second;
        pq.pop();
        
        if(d > dist[u]) continue;
        if(u == dest) break;
        
        for(unsigned int i = offsets[u]; i < offsets[u+1]; ++i){
            int v = targets[i];
            double w = weights[i];
            
            if(dist[u] + w < dist[v]){
                dist[v] = dist[u] + w;
                parent[v] = u;
                pq.push({dist[v], v});
            }
        }
    }
    
    if(dist[dest] == 1e18) return {0.0, {}};
    
    vector<int> path;
    for(int v = dest; v != -1; v = parent[v]) path.push_back(v);
    reverse(path.begin(), path.end());
    return {dist[dest], path};
}

pair<double, vector<int>> Graph::bidirectionalDijkstra(int src, int dest){
    return dijkstra(src, dest);
}
