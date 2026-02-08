import { Request, Response } from "express";
import fs from "fs";
import path from "path";

interface NodeData {
    id: number;
    lat: number;
    lon: number;
}

interface Edge {
    from: number;
    to: number;
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
}

let nodesData: NodeData[] = [];
let edgesCache: Edge[] = [];
let isLoaded = false;

const isProduction = process.env.NODE_ENV === 'production';
const nodesBinFile = isProduction
    ? path.join(process.cwd(), 'data/nodes.bin')
    : path.join(__dirname, "../../../data/nodes.bin");
const offsetFile = isProduction
    ? path.join(process.cwd(), 'data/graph.offset')
    : path.join(__dirname, "../../../data/graph.offset");
const targetsFile = isProduction
    ? path.join(process.cwd(), 'data/graph.targets')
    : path.join(__dirname, "../../../data/graph.targets");

function loadData(): void {
    if (isLoaded) return;

    console.log("[EDGES] Loading binary nodes...");
    const startTime = Date.now();

    if (!fs.existsSync(nodesBinFile)) {
        console.error("Binary nodes file not found:", nodesBinFile);
        isLoaded = true;
        return;
    }

    const nodeBuffer = fs.readFileSync(nodesBinFile);
    const nodeCount = nodeBuffer.length / 16;

    nodesData = new Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
        const offset = i * 16;
        nodesData[i] = {
            id: i,
            lat: nodeBuffer.readDoubleLE(offset),
            lon: nodeBuffer.readDoubleLE(offset + 8),
        };
    }
    console.log(`[EDGES] Loaded ${nodeCount.toLocaleString()} nodes`);

    if (!fs.existsSync(offsetFile) || !fs.existsSync(targetsFile)) {
        console.error("CSR files not found - edges will be empty");
        isLoaded = true;
        return;
    }

    console.log("[EDGES] Loading binary CSR edges...");
    const offsetBuffer = fs.readFileSync(offsetFile);
    const targetsBuffer = fs.readFileSync(targetsFile);

    const edges: Edge[] = [];
    const maxEdges = 500000;
    const sampleRate = Math.max(1, Math.floor(nodeCount / 50000));

    for (let u = 0; u < nodeCount && edges.length < maxEdges; u += sampleRate) {
        const startOff = offsetBuffer.readUInt32LE(u * 4);
        const endOff = offsetBuffer.readUInt32LE((u + 1) * 4);

        const fromNode = nodesData[u];

        for (let i = startOff; i < endOff && edges.length < maxEdges; i++) {
            const v = targetsBuffer.readInt32LE(i * 4);

            if (v < nodeCount && nodesData[v]) {
                const toNode = nodesData[v];
                edges.push({
                    from: u,
                    to: v,
                    fromLat: fromNode.lat,
                    fromLon: fromNode.lon,
                    toLat: toNode.lat,
                    toLon: toNode.lon,
                });
            }
        }
    }

    edgesCache = edges;
    isLoaded = true;
    console.log(`[EDGES] Loaded ${edges.length.toLocaleString()} edges from CSR in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
}

setTimeout(() => loadData(), 200);

export const getEdges = async (req: Request, res: Response) => {
    try {
        if (!isLoaded) {
            return res.json({
                edges: [],
                total: 0,
                loading: true
            });
        }

        const { minLat, maxLat, minLon, maxLon, limit } = req.query;

        if (!minLat || !maxLat || !minLon || !maxLon) {
            const sampleEdges = edgesCache.slice(0, Math.min(1000, edgesCache.length));
            return res.json({
                edges: sampleEdges,
                total: edgesCache.length,
                sampled: true
            });
        }

        const bounds = {
            minLat: parseFloat(minLat as string),
            maxLat: parseFloat(maxLat as string),
            minLon: parseFloat(minLon as string),
            maxLon: parseFloat(maxLon as string),
        };

        const maxEdges = limit ? parseInt(limit as string, 10) : 5000;

        const filtered: Edge[] = [];
        for (const edge of edgesCache) {
            const edgeInBounds =
                (edge.fromLat >= bounds.minLat && edge.fromLat <= bounds.maxLat &&
                    edge.fromLon >= bounds.minLon && edge.fromLon <= bounds.maxLon) ||
                (edge.toLat >= bounds.minLat && edge.toLat <= bounds.maxLat &&
                    edge.toLon >= bounds.minLon && edge.toLon <= bounds.maxLon);

            if (edgeInBounds) {
                filtered.push(edge);
                if (filtered.length >= maxEdges) break;
            }
        }

        res.json({
            edges: filtered,
            total: edgesCache.length,
            inBounds: filtered.length,
            bounds
        });
    } catch (err) {
        console.error("Error loading edges:", err);
        res.status(500).json({ error: "Failed to load edges" });
    }
};
