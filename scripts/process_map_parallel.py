import multiprocessing
import os
import csv
import time
from collections import defaultdict

INPUT_CSV = "map_central_zone.csv"
NODES_FILE = os.path.join("..", "cpp-engine", "data", "nodes.txt")
EDGES_FILE = os.path.join("..", "cpp-engine", "data", "edges.txt")

def get_chunks(filename, num_chunks):
    file_size = os.path.getsize(filename)
    chunk_size = file_size // num_chunks
    chunks = []
    with open(filename, 'rb') as f:
        start = 0
        for i in range(num_chunks):
            if i == num_chunks - 1:
                end = file_size
            else:
                f.seek(start + chunk_size)
                f.readline() 
                end = f.tell()
            chunks.append((start, end))
            start = end
    return chunks

def process_nodes_chunk(args):
    filename, start, end = args
    unique_nodes = set()
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            f.seek(start)
            if start == 0:
                f.readline() 
                
            while f.tell() < end:
                line = f.readline()
                if not line:
                    break
                
                parts = line.strip().split(',')
                if len(parts) >= 6:
                    try:
                        lat = float(parts[4])
                        lon = float(parts[5])
                        unique_nodes.add((lat, lon))
                    except ValueError:
                        continue
    except Exception:
        return set()
        
    return unique_nodes

def process_edges_chunk(args):
    filename, start, end = args
    ways_data = [] 
    
    current_way_id = None
    current_nodes = []
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            f.seek(start)
            if start == 0:
                f.readline() 
                
            while f.tell() < end:
                line = f.readline()
                if not line:
                    break
                    
                parts = line.strip().split(',')
                if len(parts) >= 6:
                    try:
                        way_id = parts[0]
                        lat = float(parts[4])
                        lon = float(parts[5])
                        
                        if way_id != current_way_id:
                            if current_way_id is not None:
                                ways_data.append((current_way_id, current_nodes))
                            current_way_id = way_id
                            current_nodes = []
                        
                        current_nodes.append((lat, lon))
                    except ValueError:
                        continue
            
            if current_way_id is not None:
                ways_data.append((current_way_id, current_nodes))
                
    except Exception:
        return []
            
    return ways_data

def main():
    start_time = time.time()
    num_workers = multiprocessing.cpu_count()
    print(f"Starting parallel processing with {num_workers} workers...")
    print(f"Input: {INPUT_CSV}")
    
    if not os.path.exists(INPUT_CSV):
        print(f"Error: {INPUT_CSV} not found in {os.getcwd()}")
        return

    chunks = get_chunks(INPUT_CSV, num_workers)
    chunk_args = [(INPUT_CSV, start, end) for start, end in chunks]
    print(f"Split file into {len(chunks)} chunks.")
    
    print("Phase 1: Extracting unique nodes (parallel)...")
    with multiprocessing.Pool(num_workers) as pool:
        results = pool.map(process_nodes_chunk, chunk_args)
    
    print("Aggregating nodes...")
    all_nodes = set()
    for res in results:
        all_nodes.update(res)
    
    print(f"Found {len(all_nodes)} unique nodes.")
    
    node_map = {}
    print(f"Writing {NODES_FILE}...")
    os.makedirs(os.path.dirname(NODES_FILE), exist_ok=True)
    
    with open(NODES_FILE, 'w', encoding='utf-8') as f:
        f.write("id lat lon\n")
        sorted_nodes = sorted(list(all_nodes)) 
        for i, (lat, lon) in enumerate(sorted_nodes):
            node_map[(lat, lon)] = i
            f.write(f"{i} {lat} {lon}\n")
            
    print(f"Nodes written. Time so far: {time.time() - start_time:.2f}s")
    
    print("Phase 2: Extracting ways and edges (parallel)...")
    with multiprocessing.Pool(num_workers) as pool:
        ways_results = pool.map(process_edges_chunk, chunk_args)
    
    def get_nid(coord, lookup=node_map):
        return lookup.get(coord)

    processed_edges_count = 0
    
    print(f"Stitching ways and writing {EDGES_FILE}...")
    with open(EDGES_FILE, 'w', encoding='utf-8') as f:
        f.write("from to\n")
        
        current_way_id = None
        current_way_nodes = []
        
        for batch in ways_results:
            for way_id, nodes in batch:
                if way_id == current_way_id:
                    current_way_nodes.extend(nodes)
                else:
                    if current_way_id is not None:
                        for i in range(len(current_way_nodes) - 1):
                            u = get_nid(current_way_nodes[i])
                            v = get_nid(current_way_nodes[i+1])
                            
                            if u is not None and v is not None and u != v:
                                f.write(f"{u} {v}\n")
                                processed_edges_count += 1
                    
                    current_way_id = way_id
                    current_way_nodes = nodes
        
        if current_way_id is not None:
            for i in range(len(current_way_nodes) - 1):
                u = get_nid(current_way_nodes[i])
                v = get_nid(current_way_nodes[i+1])
                if u is not None and v is not None and u != v:
                     f.write(f"{u} {v}\n")
                     processed_edges_count += 1

    print(f"Done! Written {processed_edges_count} edges.")
    print(f"Total time: {time.time() - start_time:.2f}s")

if __name__ == "__main__":
    import argparse
    
    multiprocessing.freeze_support()
    
    parser = argparse.ArgumentParser(description="Process OSM CSV map data in parallel.")
    parser.add_argument("input_file", nargs="?", default=INPUT_CSV, help="Input CSV file path")
    args = parser.parse_args()
    
    INPUT_CSV = args.input_file
    
    main()
