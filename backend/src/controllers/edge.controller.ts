import { Request, Response } from "express";
import fs from "fs";
import path from "path";

interface Edge {
    from: number;
    to: number;
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
}

let nodesFd: number | null = null;
let offsetFd: number | null = null;
let targetsFd: number | null = null;
let nodeCount = 0;
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

function initEdges(): void {
    if (isLoaded) return;

    try {
        if (fs.existsSync(nodesBinFile)) {
            const stats = fs.statSync(nodesBinFile);
            nodeCount = stats.size / 16;
            nodesFd = fs.openSync(nodesBinFile, 'r');
        }
        if (fs.existsSync(offsetFile)) {
            offsetFd = fs.openSync(offsetFile, 'r');
        }
        if (fs.existsSync(targetsFile)) {
            targetsFd = fs.openSync(targetsFile, 'r');
        }
        console.log(`Edges ready: streaming mode (no memory used)`);
    } catch (e) {
        console.error("Edge init error:", e);
    }
    isLoaded = true;
}

setTimeout(() => initEdges(), 200);

function readNode(index: number): { lat: number; lon: number } | null {
    if (!nodesFd || index < 0 || index >= nodeCount) return null;
    const buf = Buffer.alloc(16);
    fs.readSync(nodesFd, buf, 0, 16, index * 16);
    return { lat: buf.readDoubleLE(0), lon: buf.readDoubleLE(8) };
}

function readOffset(index: number): number {
    if (!offsetFd) return 0;
    const buf = Buffer.alloc(4);
    fs.readSync(offsetFd, buf, 0, 4, index * 4);
    return buf.readUInt32LE(0);
}

function readTarget(index: number): number {
    if (!targetsFd) return -1;
    const buf = Buffer.alloc(4);
    fs.readSync(targetsFd, buf, 0, 4, index * 4);
    return buf.readInt32LE(0);
}

export const getEdges = async (req: Request, res: Response) => {
    try {
        if (!isLoaded || !nodesFd || !offsetFd || !targetsFd) {
            return res.json({ edges: [] });
        }

        const { minLat, maxLat, minLon, maxLon } = req.query;

        if (!minLat || !maxLat || !minLon || !maxLon) {
            return res.json({ edges: [] });
        }

        const bounds = {
            minLat: parseFloat(minLat as string),
            maxLat: parseFloat(maxLat as string),
            minLon: parseFloat(minLon as string),
            maxLon: parseFloat(maxLon as string),
        };

        const edges: Edge[] = [];
        const maxEdges = 1500;
        const step = Math.max(1, Math.floor(nodeCount / 30000));

        for (let u = 0; u < nodeCount && edges.length < maxEdges; u += step) {
            const uNode = readNode(u);
            if (!uNode) continue;

            if (uNode.lat >= bounds.minLat && uNode.lat <= bounds.maxLat &&
                uNode.lon >= bounds.minLon && uNode.lon <= bounds.maxLon) {

                const startOff = readOffset(u);
                const endOff = readOffset(u + 1);

                for (let i = startOff; i < endOff && edges.length < maxEdges; i++) {
                    const v = readTarget(i);
                    if (v < 0 || v >= nodeCount) continue;

                    const vNode = readNode(v);
                    if (!vNode) continue;

                    edges.push({
                        from: u,
                        to: v,
                        fromLat: uNode.lat,
                        fromLon: uNode.lon,
                        toLat: vNode.lat,
                        toLon: vNode.lon
                    });
                }
            }
        }

        res.json({ edges, total: edges.length });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};
