#pragma once
#include<vector>
#include<string>
using namespace std;

struct Node {
    double lat;
    double lon;
};

struct Edge {
    int to;
    double weight;
};

class Graph{
public:
    void loadNodes(const string& file);
    void loadEdges(const string& file);
    
    void loadBinary(const string& prefix);
    
    pair<double, vector<int>> dijkstra(int src, int dest);
    pair<double, vector<int>> bidirectionalDijkstra(int src, int dest);
    
    vector<Node> nodes;
    
    vector<unsigned int> offsets;
    vector<int> targets;
    vector<double> weights;
    
private:
    double haversine(double lat1, double lon1, double lat2, double lon2);
};