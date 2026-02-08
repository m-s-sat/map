import struct
import csv
import sys
from pathlib import Path

def convert_places_to_binary(csv_path: str, output_path: str):
    """Convert places CSV to binary format for fast loading.
    
    Binary format:
    - Header: [place_count: 4 bytes uint32]
    - Each record: [name_len: 1 byte][name: 64 bytes padded][type: 16 bytes padded][lat: 8 bytes double][lon: 8 bytes double]
    - Record size: 1 + 64 + 16 + 8 + 8 = 97 bytes
    """
    
    unique_places = {}
    
    print(f"[1/3] Reading CSV: {csv_path}")
    
    with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        for i, row in enumerate(reader):
            if len(row) >= 6:
                name = row[2].strip()
                ref = row[3].strip()
                display_name = name if name else ref
                
                if display_name and display_name.lower() not in unique_places:
                    unique_places[display_name.lower()] = {
                        'name': display_name[:64],
                        'type': row[1][:16],
                        'lat': float(row[4]),
                        'lon': float(row[5])
                    }
            
            if (i + 1) % 1000000 == 0:
                print(f"  Processed {(i + 1):,} rows, {len(unique_places):,} unique places...")
    
    places = list(unique_places.values())
    print(f"\n[2/3] Found {len(places):,} unique places")
    
    print(f"[3/3] Writing binary file: {output_path}")
    
    with open(output_path, 'wb') as f:
        f.write(struct.pack('<I', len(places)))
        
        for place in places:
            name_bytes = place['name'].encode('utf-8')[:64]
            name_len = len(name_bytes)
            name_padded = name_bytes.ljust(64, b'\x00')
            
            type_bytes = place['type'].encode('utf-8')[:16]
            type_padded = type_bytes.ljust(16, b'\x00')
            
            f.write(struct.pack('<B', name_len))
            f.write(name_padded)
            f.write(type_padded)
            f.write(struct.pack('<d', place['lat']))
            f.write(struct.pack('<d', place['lon']))
    
    file_size = Path(output_path).stat().st_size
    print(f"\nDone! Binary file size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
    print(f"Records: {len(places):,} places")

if __name__ == '__main__':
    csv_file = Path(__file__).parent.parent / 'map_central_zone.csv'
    bin_file = Path(__file__).parent.parent / 'data' / 'places.bin'
    
    if len(sys.argv) > 1:
        csv_file = Path(sys.argv[1])
    if len(sys.argv) > 2:
        bin_file = Path(sys.argv[2])
    
    if not csv_file.exists():
        print(f"Error: CSV file not found: {csv_file}")
        sys.exit(1)
    
    convert_places_to_binary(str(csv_file), str(bin_file))
