#include <fstream>
#define _USE_MATH_DEFINES
#include <cmath>
#include <cstdint>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

using namespace std;

double toRad(double deg){
    return deg * M_PI / 180.0;
}

double haversine(double lat1, double lon1, double lat2, double lon2){
    const double R = 6371;
    double dlat = toRad(lat2 - lat1);
    double dlon = toRad(lon2 - lon1);
    double a = sin(dlat/2)*sin(dlat/2) +
               cos(toRad(lat1))*cos(toRad(lat2))*
               sin(dlon/2)*sin(dlon/2);
    return 2 * R * asin(sqrt(a));
}

int64_t coordKey(double lat, double lon){
    int64_t la = llround(lat * 1e7);
    int64_t lo = llround(lon * 1e7);
    return (la << 32) | (uint32_t)lo;
}

int main(int argc, char* argv[]){
    if(argc < 3){
        cerr << "Usage: ./csv_to_graph <map_central_zone.csv> <output_prefix>\n";
        return 1;
    }

    string inFile = argv[1];
    string prefix = argv[2];
    string scratchFile = prefix + "edges.scratch";

    ifstream csv(inFile);
    if(!csv.is_open()){
        cerr << "Cannot open " << inFile << endl;
        return 1;
    }

    ofstream nodesOut(prefix + "nodes.bin", ios::binary);
    ofstream scratch(scratchFile, ios::binary);

    unordered_map<int64_t, int> nodeId;
    nodeId.reserve(20000000);
    vector<uint32_t> degree;
    long long numEdges = 0;

    string line, curWay;
    int prevNode = -1;
    getline(csv, line); // header

    cerr << "Pass 1: deduping nodes and streaming edges to scratch...\n";
    long long rows = 0;

    while(getline(csv, line)){
        if(line.empty()) continue;
        rows++;

        size_t c1 = line.find(',');
        size_t cLast = line.rfind(',');
        size_t cPrev = line.rfind(',', cLast - 1);
        if(c1 == string::npos || cPrev == string::npos) continue;

        string way = line.substr(0, c1);
        double lat, lon;
        try {
            lat = stod(line.substr(cPrev + 1, cLast - cPrev - 1));
            lon = stod(line.substr(cLast + 1));
        } catch(...) {
            continue;
        }

        int64_t key = coordKey(lat, lon);
        int id;
        auto it = nodeId.find(key);
        if(it == nodeId.end()){
            id = (int)degree.size();
            nodeId[key] = id;
            degree.push_back(0);
            nodesOut.write(reinterpret_cast<char*>(&lat), sizeof(double));
            nodesOut.write(reinterpret_cast<char*>(&lon), sizeof(double));
        } else {
            id = it->second;
        }

        if(way == curWay && prevNode != -1 && prevNode != id){
            int32_t u = prevNode, v = id;
            scratch.write(reinterpret_cast<char*>(&u), sizeof(int32_t));
            scratch.write(reinterpret_cast<char*>(&v), sizeof(int32_t));
            scratch.write(reinterpret_cast<char*>(&v), sizeof(int32_t));
            scratch.write(reinterpret_cast<char*>(&u), sizeof(int32_t));
            degree[u]++;
            degree[v]++;
            numEdges += 2;
        } else {
            curWay = way;
        }
        prevNode = id;

        if(rows % 5000000 == 0) cerr << "  " << rows << " rows, " << degree.size() << " nodes\n";
    }

    csv.close();
    nodesOut.close();
    scratch.close();

    size_t numNodes = degree.size();
    cerr << "Found " << numNodes << " nodes, " << numEdges << " edges\n";

    unordered_map<int64_t,int>().swap(nodeId); // done deduping, drop the hashmap before the big CSR allocations

    cerr << "Pass 2: building CSR offsets...\n";
    vector<uint32_t> offsets(numNodes + 1);
    uint32_t running = 0;
    for(size_t u = 0; u < numNodes; ++u){
        offsets[u] = running;
        running += degree[u];
    }
    offsets[numNodes] = running;

    vector<uint32_t> cursor(offsets.begin(), offsets.end() - 1);
    vector<uint32_t>().swap(degree);

    cerr << "Loading node coords for weight calc...\n";
    vector<pair<double,double>> coords(numNodes);
    ifstream nodesIn(prefix + "nodes.bin", ios::binary);
    for(size_t i = 0; i < numNodes; ++i){
        nodesIn.read(reinterpret_cast<char*>(&coords[i].first), sizeof(double));
        nodesIn.read(reinterpret_cast<char*>(&coords[i].second), sizeof(double));
    }
    nodesIn.close();

    cerr << "Pass 3: filling targets/weights from scratch edges...\n";
    vector<int32_t> targets(numEdges);
    vector<double> weights(numEdges);

    ifstream scratchIn(scratchFile, ios::binary);
    int32_t u, v;
    while(scratchIn.read(reinterpret_cast<char*>(&u), sizeof(int32_t))){
        scratchIn.read(reinterpret_cast<char*>(&v), sizeof(int32_t));
        double w = haversine(coords[u].first, coords[u].second, coords[v].first, coords[v].second);
        targets[cursor[u]] = v;
        weights[cursor[u]] = w;
        cursor[u]++;
    }
    scratchIn.close();
    remove(scratchFile.c_str());

    cerr << "Writing graph.offset, graph.targets, graph.weights...\n";
    ofstream offOut(prefix + "graph.offset", ios::binary);
    offOut.write(reinterpret_cast<char*>(offsets.data()), offsets.size() * sizeof(uint32_t));
    offOut.close();

    ofstream tgtOut(prefix + "graph.targets", ios::binary);
    tgtOut.write(reinterpret_cast<char*>(targets.data()), targets.size() * sizeof(int32_t));
    tgtOut.close();

    ofstream wOut(prefix + "graph.weights", ios::binary);
    wOut.write(reinterpret_cast<char*>(weights.data()), weights.size() * sizeof(double));
    wOut.close();

    cerr << "Done. " << numNodes << " nodes, " << numEdges << " edges.\n";
    return 0;
}
