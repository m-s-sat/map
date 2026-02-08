#pragma once
#include<vector>
#include<string>
#include<cstddef>

#ifdef _WIN32
#include <windows.h>
#else
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#endif

using namespace std;

struct Node {
    double lat;
    double lon;
};

struct MappedFile {
    void* data = nullptr;
    size_t size = 0;
#ifdef _WIN32
    HANDLE fileHandle = INVALID_HANDLE_VALUE;
    HANDLE mapHandle = nullptr;
#else
    int fd = -1;
#endif
};

class Graph{
public:
    ~Graph();
    
    void loadNodes(const string& file);
    void loadEdges(const string& file);
    void loadBinary(const string& prefix);
    
    pair<double, vector<int>> dijkstra(int src, int dest);
    pair<double, vector<int>> bidirectionalDijkstra(int src, int dest);
    
    size_t numNodes = 0;
    size_t numEdges = 0;
    
    const Node* nodes = nullptr;
    const unsigned int* offsets = nullptr;
    const int* targets = nullptr;
    const double* weights = nullptr;
    
private:
    MappedFile nodesMap;
    MappedFile offsetsMap;
    MappedFile targetsMap;
    MappedFile weightsMap;
    
    bool mapFile(const string& filename, MappedFile& mf);
    void unmapFile(MappedFile& mf);
    double haversine(double lat1, double lon1, double lat2, double lon2);
};