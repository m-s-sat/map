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

let nodesBuffer: Buffer | null = null;
let offsetBuffer: Buffer | null = null;
let targetsBuffer: Buffer | null = null;
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

function loadData(): void {
    if (isLoaded) return;

    if (!fs.existsSync(nodesBinFile)) {
        isLoaded = true;
        return;
    }

    const nodeBuffer = fs.readFileSync(nodesBinFile);
    if (nodeBuffer.length % 16 !== 0) {
        isLoaded = true;
        return;
    }

    nodesBuffer = nodeBuffer;
    nodeCount = nodeBuffer.length / 16;

    if (!fs.existsSync(offsetFile) || !fs.existsSync(targetsFile)) {
        isLoaded = true;
        return;
    }

    offsetBuffer = fs.readFileSync(offsetFile);
    targetsBuffer = fs.readFileSync(targetsFile);
    isLoaded = true;
}

setTimeout(() => loadData(), 500);

export const getEdges = async (req: Request, res: Response) => {
    try {
        if (!isLoaded || !nodesBuffer || !offsetBuffer || !targetsBuffer) {
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
        const maxEdges = 2000;

        const sampleRate = Math.max(1, Math.floor(nodeCount / 50000));

        for (let u = 0; u < nodeCount; u += sampleRate) {
            const uOffset = u * 16;
            const uLat = nodesBuffer.readDoubleLE(uOffset);
            const uLon = nodesBuffer.readDoubleLE(uOffset + 8);

            if (uLat >= bounds.minLat && uLat <= bounds.maxLat &&
                uLon >= bounds.minLon && uLon <= bounds.maxLon) {

                const startOff = offsetBuffer.readUInt32LE(u * 4);
                const endOff = offsetBuffer.readUInt32LE((u + 1) * 4);

                for (let i = startOff; i < endOff; i++) {
                    const vToken = i * 4;
                    if (vToken + 4 > targetsBuffer.length) break;

                    const v = targetsBuffer.readInt32LE(vToken);

                    if (v < nodeCount) {
                        const vOffset = v * 16;
                        const vLat = nodesBuffer.readDoubleLE(vOffset);
                        const vLon = nodesBuffer.readDoubleLE(vOffset + 8);

                        edges.push({
                            from: u,
                            to: v,
                            fromLat: uLat,
                            fromLon: uLon,
                            toLat: vLat,
                            toLon: vLon
                        });

                        if (edges.length >= maxEdges) break;
                    }
                }
                if (edges.length >= maxEdges) break;
            }
        }

        res.json({
            edges,
            total: edges.length
        });

    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};
