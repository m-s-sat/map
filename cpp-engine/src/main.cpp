#include "../include/graph.h"
#include <iostream>
#include <vector>
#include <string>

using namespace std;

int main(int argc, char* argv[]) {

    if(argc < 2){
        cerr << "Usage: ./map <data_prefix>\n";
        return 1;
    }

    Graph g;
    
    string prefix = argv[1];
    
    try {
        g.loadBinary(prefix);
    } catch (const exception& e) {
        cerr << "Failed to load binary graph: " << e.what() << endl;
        return 1;
    }
    
    cerr << "Graph loaded. Ready for queries." << endl;

    int src, dest;
    while(cin >> src >> dest){
        pair<double, vector<int>> result = g.dijkstra(src, dest);
        
        if (result.second.empty()) {
            cout << "" << endl;
        } else {
            cout << result.first << " ";
            for(size_t i = 0; i < result.second.size(); ++i) {
                cout << result.second[i] << (i == result.second.size() - 1 ? "" : " ");
            }
            cout << endl;
        }
    }

    return 0;
}
