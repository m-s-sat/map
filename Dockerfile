# Build stage for C++ engine
FROM --platform=linux/amd64 gcc:12 AS cpp-builder

WORKDIR /cpp-build
COPY cpp-engine/ ./

RUN g++ -O3 -std=c++17 -o map_v2 src/main.cpp src/graph.cpp -I include

# Production stage
FROM --platform=linux/amd64 node:20-slim

WORKDIR /app

# Install C++ runtime and curl for downloading data
RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./

# Copy C++ engine binary
COPY --from=cpp-builder /cpp-build/map_v2 ./cpp-engine/src/map_v2
RUN chmod +x ./cpp-engine/src/map_v2

# Copy small data files from git
COPY data/places.bin ./data/
COPY data/graph.offset ./data/

# Download large data files from S3 (set S3_BUCKET_URL env var)
ARG S3_BUCKET_URL=https://mapdatabase8710.s3.us-east-1.amazonaws.com
RUN if [ -n "$S3_BUCKET_URL" ]; then \
    echo "Downloading data files from S3..." && \
    curl -L "$S3_BUCKET_URL/nodes.bin" -o ./data/nodes.bin && \
    curl -L "$S3_BUCKET_URL/graph.targets" -o ./data/graph.targets && \
    curl -L "$S3_BUCKET_URL/graph.weights" -o ./data/graph.weights && \
    curl -L "$S3_BUCKET_URL/nodes.txt" -o ./data/nodes.txt && \
    curl -L "$S3_BUCKET_URL/edges.txt" -o ./data/edges.txt; \
    else echo "No S3_BUCKET_URL set - expecting data to be mounted"; fi

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:8080/api/nodes/stats || exit 1

# Start command
CMD ["node", "dist/server.js"]
