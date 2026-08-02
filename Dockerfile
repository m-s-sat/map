FROM node:20 AS ts-builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM gcc:12 AS cpp-builder

WORKDIR /app
COPY cpp-engine/ ./

RUN g++ -O3 -std=c++17 -o src/map_v2 src/main.cpp src/graph.cpp -I include

FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

COPY backend/package*.json ./
RUN npm ci --only=production

COPY --from=ts-builder /app/dist ./dist
COPY --from=cpp-builder /app/src/map_v2 ./cpp-engine/src/map_v2

# data/ is mounted in at runtime (see docker-compose.yml) rather than baked
# into the image - it's ~700MB and changes independently of the code.

EXPOSE 8080

CMD ["node", "dist/server.js"]
