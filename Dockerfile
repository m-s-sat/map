FROM --platform=linux/amd64 node:20 AS ts-builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM --platform=linux/amd64 node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=384"

COPY backend/package*.json ./
RUN npm ci --only=production

COPY --from=ts-builder /app/dist ./dist

COPY data/places.bin ./data/
COPY data/graph.offset ./data/

ARG S3_BUCKET_URL=https://mapdatabase8710.s3.us-east-1.amazonaws.com
RUN apt-get update && apt-get install -y curl && \
    curl -f -L -o ./data/nodes.bin "$S3_BUCKET_URL/nodes.bin" && \
    curl -f -L -o ./data/graph.targets "$S3_BUCKET_URL/graph.targets" && \
    apt-get remove -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

EXPOSE 8080

CMD ["node", "dist/server.js"]
