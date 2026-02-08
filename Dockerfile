FROM --platform=linux/amd64 gcc:12 AS cpp-builder

WORKDIR /cpp-build
COPY cpp-engine/ ./

RUN g++ -O3 -std=c++17 -o map_v2 src/main.cpp src/graph.cpp -I include

FROM --platform=linux/amd64 node:20 AS ts-builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM --platform=linux/amd64 node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY backend/package*.json ./
RUN npm ci --only=production

COPY --from=ts-builder /app/dist ./dist

COPY --from=cpp-builder /cpp-build/map_v2 ./cpp-engine/src/map_v2
RUN chmod +x ./cpp-engine/src/map_v2

COPY data/places.bin ./data/
COPY data/graph.offset ./data/

ARG S3_BUCKET_URL=https://mapdatabase8710.s3.us-east-1.amazonaws.com
RUN curl -f -L -o ./data/nodes.bin "$S3_BUCKET_URL/nodes.bin" && \
    curl -f -L -o ./data/graph.targets "$S3_BUCKET_URL/graph.targets" && \
    curl -f -L -o ./data/graph.weights "$S3_BUCKET_URL/graph.weights" && \
    curl -f -L -o ./data/nodes.txt "$S3_BUCKET_URL/nodes.txt" && \
    curl -f -L -o ./data/edges.txt "$S3_BUCKET_URL/edges.txt"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:8080/api/nodes/stats || exit 1

CMD ["node", "dist/server.js"]
