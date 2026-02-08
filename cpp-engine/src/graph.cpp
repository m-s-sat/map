#include "../include/graph.h"
#include <fstream>
#include <cmath>
#include <queue>
#include <algorithm>
#include <stdexcept>
#include <iostream>
#include <cstdio>

using namespace std;

void Graph::loadNodes(const string& file){
    ifstream fin(file);
    if(!fin.is_open()) throw runtime_error("Cannot open " + file);
    
    string header;
    getline(fin, header);
    
    int id;
    double lat, lon;
    
    while(fin >> id >> lat >> lon){
        if(id >= nodes.size()) nodes.resize(id + 1);
        nodes[id] = {lat, lon};
    }
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
    
    string header;
    getline(fin, header);
    
    vector<int> degrees(nodes.size(), 0);
    int u, v;
    while(fin >> u >> v){
        if(u < nodes.size()) degrees[u]++;
        if(v < nodes.size()) degrees[v]++;
    }
    
    offsets.resize(nodes.size() + 1);
    offsets[0] = 0;
    for(size_t i=0; i<nodes.size(); ++i){
        offsets[i+1] = offsets[i] + degrees[i];
    }
    
    targets.resize(offsets.back());
    weights.resize(offsets.back());
    
    fin.clear();
    fin.seekg(0);
    getline(fin, header);
    
    vector<unsigned int> current_offset = offsets;
    
    while(fin >> u >> v){
        double dist = haversine(nodes[u].lat, nodes[u].lon, nodes[v].lat, nodes[v].lon);
        
        targets[current_offset[u]] = v;
        weights[current_offset[u]] = dist;
        current_offset[u]++;
        
        targets[current_offset[v]] = u;
        weights[current_offset[v]] = dist;
        current_offset[v]++;
    }
}

void Graph::loadBinary(const string& prefix){
    string nodeFile = prefix + "nodes.bin";
    string offsetFile = prefix + "graph.offset";
    string targetFile = prefix + "graph.targets";
    string weightFile = prefix + "graph.weights";
    
    FILE* f = fopen(nodeFile.c_str(), "rb");
    if(!f) throw runtime_error("Missing " + nodeFile);
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    rewind(f);
    
    int numNodes = size / (sizeof(double) * 2);
    nodes.resize(numNodes);
    
    fread(nodes.data(), sizeof(Node), numNodes, f);
    fclose(f);
    
    f = fopen(offsetFile.c_str(), "rb");
    if(!f) throw runtime_error("Missing " + offsetFile);
    fseek(f, 0, SEEK_END);
    size = ftell(f);
    rewind(f);
    
    int numOffsets = size / sizeof(unsigned int);
    offsets.resize(numOffsets);
    fread(offsets.data(), sizeof(unsigned int), numOffsets, f);
    fclose(f);
    
    f = fopen(targetFile.c_str(), "rb");
    if(!f) throw runtime_error("Missing " + targetFile);
    fseek(f, 0, SEEK_END);
    size = ftell(f);
    rewind(f);
    
    int numEdges = size / sizeof(int);
    targets.resize(numEdges);
    fread(targets.data(), sizeof(int), numEdges, f);
    fclose(f);
    
    f = fopen(weightFile.c_str(), "rb");
    if(!f) throw runtime_error("Missing " + weightFile);
    fseek(f, 0, SEEK_END);
    rewind(f);
    
    weights.resize(numEdges);
    fread(weights.data(), sizeof(double), numEdges, f);
    fclose(f);
}

pair<double, vector<int>> Graph::dijkstra(int src, int dest){
    if(src < 0 || src >= nodes.size() || dest < 0 || dest >= nodes.size()) return {0.0, {}};
    
    priority_queue<pair<double, int>, vector<pair<double, int>>, greater<>> pq;
    vector<double> dist(nodes.size(), 1e18);
    vector<int> parent(nodes.size(), -1);
    
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
