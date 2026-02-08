import { Request, Response } from "express";
import fs from "fs";
import path from "path";

interface NodeData {
    id: number;
    lat: number;
    lon: number;
}

let nodesCache: NodeData[] = [];
let isLoaded = false;
let loadProgress = 0;

const isProduction = process.env.NODE_ENV === 'production';
const nodesBinFile = isProduction
    ? path.join(process.cwd(), 'data/nodes.bin')
    : path.join(__dirname, "../../../data/nodes.bin");

function loadNodesBinary(): void {
    if (isLoaded) return;

    if (!fs.existsSync(nodesBinFile)) {
        console.error("Binary nodes file not found:", nodesBinFile);
        isLoaded = true;
        return;
    }

    console.log("Loading nodes from binary file:", nodesBinFile);
    const startTime = Date.now();

    const buffer = fs.readFileSync(nodesBinFile);
    const nodeCount = buffer.length / 16;

    console.log(`Binary file has ${nodeCount.toLocaleString()} nodes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    const nodes: NodeData[] = new Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
        const offset = i * 16;
        nodes[i] = {
            id: i,
            lat: buffer.readDoubleLE(offset),
            lon: buffer.readDoubleLE(offset + 8),
        };

        if (i % 1000000 === 0 && i > 0) {
            loadProgress = i;
            console.log(`Loaded ${i.toLocaleString()} nodes...`);
        }
    }

    nodesCache = nodes;
    isLoaded = true;

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`Finished loading ${nodeCount.toLocaleString()} nodes in ${elapsed.toFixed(2)}s`);
}

setTimeout(() => loadNodesBinary(), 100);

export const getNodes = async (req: Request, res: Response) => {
    try {
        if (!isLoaded) {
            return res.json({
                nodes: [],
                total: 0,
                loading: true,
                progress: loadProgress
            });
        }

        const { minLat, maxLat, minLon, maxLon, limit } = req.query;

        if (!minLat || !maxLat || !minLon || !maxLon) {
            const sampleNodes = nodesCache.slice(0, Math.min(500, nodesCache.length));
            return res.json({
                nodes: sampleNodes,
                total: nodesCache.length,
                sampled: true
            });
        }

        const bounds = {
            minLat: parseFloat(minLat as string),
            maxLat: parseFloat(maxLat as string),
            minLon: parseFloat(minLon as string),
            maxLon: parseFloat(maxLon as string),
        };

        const maxNodes = limit ? parseInt(limit as string, 10) : 2000;

        const filtered: NodeData[] = [];
        for (const node of nodesCache) {
            if (
                node.lat >= bounds.minLat &&
                node.lat <= bounds.maxLat &&
                node.lon >= bounds.minLon &&
                node.lon <= bounds.maxLon
            ) {
                filtered.push(node);
                if (filtered.length >= maxNodes) break;
            }
        }

        res.json({
            nodes: filtered,
            total: nodesCache.length,
            inBounds: filtered.length,
            bounds
        });
    } catch (err) {
        console.error("Error loading nodes:", err);
        res.status(500).json({ error: "Failed to load nodes" });
    }
};

export const getNodeStats = async (req: Request, res: Response) => {
    try {
        if (!isLoaded) {
            return res.json({
                count: 0,
                loading: true,
                progress: loadProgress
            });
        }

        if (nodesCache.length === 0) {
            return res.json({ count: 0 });
        }

        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;

        for (const node of nodesCache) {
            if (node.lat < minLat) minLat = node.lat;
            if (node.lat > maxLat) maxLat = node.lat;
            if (node.lon < minLon) minLon = node.lon;
            if (node.lon > maxLon) maxLon = node.lon;
        }

        res.json({
            count: nodesCache.length,
            bounds: { minLat, maxLat, minLon, maxLon },
            center: {
                lat: (minLat + maxLat) / 2,
                lon: (minLon + maxLon) / 2,
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to get node stats" });
    }
};
