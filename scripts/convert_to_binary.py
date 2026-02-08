import struct
import os
import time
import math

NODES_TXT = os.path.join("..", "cpp-engine", "data", "nodes.txt")
EDGES_TXT = os.path.join("..", "cpp-engine", "data", "edges.txt")

NODES_BIN = os.path.join("..", "cpp-engine", "data", "nodes.bin")
OFFSET_BIN = os.path.join("..", "cpp-engine", "data", "graph.offset")
TARGETS_BIN = os.path.join("..", "cpp-engine", "data", "graph.targets")
WEIGHTS_BIN = os.path.join("..", "cpp-engine", "data", "graph.weights")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1 = lat1 * math.pi / 180.0
    phi2 = lat2 * math.pi / 180.0
    dphi = (lat2 - lat1) * math.pi / 180.0
    dlambda = (lon2 - lon1) * math.pi / 180.0
    a = math.sin(dphi / 2)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(dlambda / 2)**2
    return 2 * R * math.asin(math.sqrt(a))

def convert():
    start_time = time.time()
    print("Converting map data to binary format...")

    print(f"Reading {NODES_TXT} and writing {NODES_BIN}...")
    node_count = 0
    with open(NODES_TXT, 'r', encoding='utf-8') as f_in, \
         open(NODES_BIN, 'wb') as f_out:
        
        f_in.readline()
        
        for line in f_in:
            parts = line.strip().split()
            if len(parts) >= 3:
                lat = float(parts[1])
                lon = float(parts[2])
                f_out.write(struct.pack('dd', lat, lon))
                node_count += 1
    
    print(f"Processed {node_count} nodes.")

    print(f"Reading {EDGES_TXT}...")
    
    print("Loading nodes for weight calculation...")
    nodes = []
    with open(NODES_TXT, 'r', encoding='utf-8') as f:
        f.readline()
        for line in f:
            p = line.split()
            nodes.append((float(p[1]), float(p[2])))
            
    print("Building adjacency list...")
    adj = [[] for _ in range(node_count)]
    edge_count = 0
    
    with open(EDGES_TXT, 'r', encoding='utf-8') as f:
        f.readline() 
        for line in f:
            u, v = map(int, line.split())
            if u < node_count and v < node_count:
                n1 = nodes[u]
                n2 = nodes[v]
                w = haversine(n1[0], n1[1], n2[0], n2[1])
                
                adj[u].append((v, w))
                adj[v].append((u, w))
                edge_count += 2

    print(f"Writing CSR files ({edge_count} edges)...")
    
    with open(OFFSET_BIN, 'wb') as f_off, \
         open(TARGETS_BIN, 'wb') as f_tgt, \
         open(WEIGHTS_BIN, 'wb') as f_wgt:
        
        current_offset = 0
        for u in range(node_count):
            f_off.write(struct.pack('I', current_offset)) 
            
            for v, w in adj[u]:
                f_tgt.write(struct.pack('i', v)) 
                f_wgt.write(struct.pack('d', w)) 
                current_offset += 1
                
        f_off.write(struct.pack('I', current_offset))

    print(f"Conversion complete! Total time: {time.time() - start_time:.2f}s")
    print(f"Output: {NODES_BIN}, {OFFSET_BIN}, {TARGETS_BIN}, {WEIGHTS_BIN}")

if __name__ == "__main__":
    convert()
