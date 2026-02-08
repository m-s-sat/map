#!/bin/bash

set -e

DATA_DIR="./data"
S3_BUCKET_URL="${S3_BUCKET_URL:-https://mapdatabase8710.s3.us-east-1.amazonaws.com}"

mkdir -p $DATA_DIR

echo "Downloading data files from S3..."

FILES=(
    "nodes.bin"
    "nodes.txt"
    "edges.txt"
    "graph.weights"
    "graph.targets"
)

for file in "${FILES[@]}"; do
    if [ ! -f "$DATA_DIR/$file" ]; then
        echo "Downloading $file..."
        curl -L "$S3_BUCKET_URL/$file" -o "$DATA_DIR/$file"
    else
        echo "$file already exists"
    fi
done

echo "All data files ready!"
