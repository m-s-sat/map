import { Request, Response } from "express";
import fs from "fs";
import path from "path";

let nodeCount = 0;
let isLoaded = false;
let fd: number | null = null;
let dataBounds = { minLat: 17.7553, maxLat: 31.4441, minLon: 73.9486, maxLon: 84.6525 };
let dataCenter = { lat: 24.6, lon: 79.3 };

const isProduction = process.env.NODE_ENV === 'production';
const nodesBinFile = isProduction
    ? path.join(process.cwd(), 'data/nodes.bin')
    : path.join(__dirname, "../../../data/nodes.bin");

function initNodes(): void {
    if (isLoaded) return;

    if (!fs.existsSync(nodesBinFile)) {
        console.error("Binary nodes file not found:", nodesBinFile);
        isLoaded = true;
        return;
    }

    const stats = fs.statSync(nodesBinFile);
    nodeCount = stats.size / 16;
    fd = fs.openSync(nodesBinFile, 'r');

    console.log(`Nodes file ready: ${nodeCount.toLocaleString()} nodes (streaming mode - no memory used)`);
    isLoaded = true;
}

setTimeout(() => initNodes(), 100);

function readNodeAt(index: number): { lat: number; lon: number } | null {
    if (!fd || index < 0 || index >= nodeCount) return null;

    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, index * 16);

    return {
        lat: buffer.readDoubleLE(0),
        lon: buffer.readDoubleLE(8)
    };
}

export const getNodes = async (req: Request, res: Response) => {
    try {
        if (!isLoaded || !fd) {
            return res.json({ nodes: [], total: 0, loading: true });
        }

        const { minLat, maxLat, minLon, maxLon, limit } = req.query;

        if (!minLat || !maxLat || !minLon || !maxLon) {
            return res.json({ nodes: [], total: nodeCount, sampled: true });
        }

        const bounds = {
            minLat: parseFloat(minLat as string),
            maxLat: parseFloat(maxLat as string),
            minLon: parseFloat(minLon as string),
            maxLon: parseFloat(maxLon as string),
        };

        const maxNodes = limit ? parseInt(limit as string, 10) : 1000;
        const result = [];

        const step = Math.max(1, Math.floor(nodeCount / 50000));
        const buffer = Buffer.alloc(16);

        for (let i = 0; i < nodeCount && result.length < maxNodes; i += step) {
            fs.readSync(fd, buffer, 0, 16, i * 16);
            const lat = buffer.readDoubleLE(0);
            const lon = buffer.readDoubleLE(8);

            if (lat >= bounds.minLat && lat <= bounds.maxLat &&
                lon >= bounds.minLon && lon <= bounds.maxLon) {
                result.push({ id: i, lat, lon });
            }
        }

        res.json({ nodes: result, total: nodeCount });
    } catch (error) {
        console.error("Error fetching nodes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getNodeStats = async (req: Request, res: Response) => {
    if (!isLoaded) {
        return res.json({ loading: true, count: 0 });
    }

    res.json({
        count: nodeCount,
        loaded: isLoaded,
        bounds: dataBounds,
        center: dataCenter
    });
};

export { readNodeAt, nodeCount as getNodeCount };
