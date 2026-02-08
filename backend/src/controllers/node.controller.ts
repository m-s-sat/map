import { Request, Response } from "express";
import fs from "fs";
import path from "path";

let nodesBuffer: Buffer | null = null;
let nodeCount = 0;
let isLoaded = false;
let dataBounds = { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
let dataCenter = { lat: 0, lon: 0 };

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
    if (buffer.length % 16 !== 0) {
        console.error(`[NODES] Invalid binary file size: ${buffer.length} bytes.`);
        isLoaded = true;
        return;
    }

    nodesBuffer = buffer;
    nodeCount = buffer.length / 16;

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    const sampleSize = Math.min(nodeCount, 100000);
    const step = Math.max(1, Math.floor(nodeCount / sampleSize));

    for (let i = 0; i < nodeCount; i += step) {
        const offset = i * 16;
        const lat = buffer.readDoubleLE(offset);
        const lon = buffer.readDoubleLE(offset + 8);
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
    }

    dataBounds = { minLat, maxLat, minLon, maxLon };
    dataCenter = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };

    console.log(`Binary file has ${nodeCount.toLocaleString()} nodes`);
    console.log(`Data bounds: lat [${minLat.toFixed(4)}, ${maxLat.toFixed(4)}], lon [${minLon.toFixed(4)}, ${maxLon.toFixed(4)}]`);
    isLoaded = true;

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`Finished loading nodes in ${elapsed.toFixed(2)}s`);
}

setTimeout(() => loadNodesBinary(), 100);

export const getNodes = async (req: Request, res: Response) => {
    try {
        if (!isLoaded || !nodesBuffer) {
            return res.json({
                nodes: [],
                total: 0,
                loading: true
            });
        }

        const { minLat, maxLat, minLon, maxLon, limit } = req.query;

        if (!minLat || !maxLat || !minLon || !maxLon) {
            return res.json({
                nodes: [],
                total: nodeCount,
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
        const result = [];

        for (let i = 0; i < nodeCount; i++) {
            const offset = i * 16;
            const lat = nodesBuffer.readDoubleLE(offset);
            const lon = nodesBuffer.readDoubleLE(offset + 8);

            if (lat >= bounds.minLat && lat <= bounds.maxLat &&
                lon >= bounds.minLon && lon <= bounds.maxLon) {

                result.push({ id: i, lat, lon });

                if (result.length >= maxNodes) break;
            }
        }

        res.json({
            nodes: result,
            total: nodeCount
        });
    } catch (error) {
        console.error("Error fetching nodes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getNodeStats = async (req: Request, res: Response) => {
    if (!isLoaded || !nodesBuffer) {
        return res.json({
            loading: true,
            count: 0
        });
    }

    res.json({
        count: nodeCount,
        loaded: isLoaded,
        bounds: dataBounds,
        center: dataCenter
    });
};
