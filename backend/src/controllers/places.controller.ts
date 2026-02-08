import { Request, Response } from "express";
import fs from "fs";
import path from "path";

interface Place {
    id: number;
    name: string;
    type: string;
    lat: number;
    lon: number;
    nodeId: number;
}

let placesIndex: Place[] = [];
let placesLoaded = false;

const isProduction = process.env.NODE_ENV === 'production';
const binFile = isProduction
    ? path.join(process.cwd(), 'data/places.bin')
    : path.join(__dirname, "../../../data/places.bin");
const nodesBinFile = isProduction
    ? path.join(process.cwd(), 'data/nodes.bin')
    : path.join(__dirname, "../../../data/nodes.bin");

async function loadPlacesFromBinary(): Promise<void> {
    if (placesLoaded) return;

    if (!fs.existsSync(binFile)) {
        placesLoaded = true;
        return;
    }

    const buffer = fs.readFileSync(binFile);
    if (buffer.length < 4) {
        placesLoaded = true;
        return;
    }
    const placeCount = buffer.readUInt32LE(0);

    const minExpectedSize = 4 + (placeCount * 97);
    if (buffer.length < minExpectedSize) {
        placesLoaded = true;
        return;
    }

    let offset = 4;

    for (let i = 0; i < placeCount; i++) {
        const nameLen = buffer.readUInt8(offset);
        offset += 1;

        const nameBytes = buffer.subarray(offset, offset + nameLen);
        const name = nameBytes.toString("utf-8");
        offset += 64;

        const typeBytes = buffer.subarray(offset, offset + 16);
        const type = typeBytes.toString("utf-8").replace(/\x00/g, "");
        offset += 16;

        const lat = buffer.readDoubleLE(offset);
        offset += 8;

        const lon = buffer.readDoubleLE(offset);
        offset += 8;

        placesIndex.push({
            id: i,
            name,
            type,
            lat,
            lon,
            nodeId: -1,
        });
    }

    if (fs.existsSync(nodesBinFile)) {
        const nodesBuffer = fs.readFileSync(nodesBinFile);
        const nodeCount = nodesBuffer.length / 16;

        const GRID_SIZE = 0.01;
        const grid = new Map<string, number[]>();

        const getGridKey = (lat: number, lon: number): string => {
            const latIdx = Math.floor(lat / GRID_SIZE);
            const lonIdx = Math.floor(lon / GRID_SIZE);
            return `${latIdx},${lonIdx}`;
        };

        const addToGrid = (key: string, placeIdx: number) => {
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key)!.push(placeIdx);
        };

        const placeDistances = new Float64Array(placesIndex.length).fill(Infinity);

        for (let i = 0; i < placesIndex.length; i++) {
            const p = placesIndex[i];
            const baseLatIdx = Math.floor(p.lat / GRID_SIZE);
            const baseLonIdx = Math.floor(p.lon / GRID_SIZE);

            for (let dLat = -1; dLat <= 1; dLat++) {
                for (let dLon = -1; dLon <= 1; dLon++) {
                    const key = `${baseLatIdx + dLat},${baseLonIdx + dLon}`;
                    addToGrid(key, i);
                }
            }
        }

        for (let i = 0; i < nodeCount; i++) {
            const offset = i * 16;
            const lat = nodesBuffer.readDoubleLE(offset);
            const lon = nodesBuffer.readDoubleLE(offset + 8);

            const key = getGridKey(lat, lon);
            const relevantPlaces = grid.get(key);

            if (relevantPlaces) {
                for (const placeIdx of relevantPlaces) {
                    const p = placesIndex[placeIdx];
                    const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;

                    if (d < placeDistances[placeIdx]) {
                        placeDistances[placeIdx] = d;
                        p.nodeId = i;
                    }
                }
            }
        }
    }

    placesLoaded = true;
}

setTimeout(() => loadPlacesFromBinary(), 1000);

export const searchPlaces = async (req: Request, res: Response) => {
    try {
        const { q = "", limit = "20", offset = "0" } = req.query;
        const query = (typeof q === 'string' ? q : "").toLowerCase();
        const limitNum = parseInt(limit as string) || 20;
        const offsetNum = parseInt(offset as string) || 0;

        const filtered = query
            ? placesIndex.filter(p => p.name.toLowerCase().includes(query))
            : placesIndex;

        const results = filtered.slice(offsetNum, offsetNum + limitNum);

        res.json({
            places: results,
            total: filtered.length,
            hasMore: offsetNum + limitNum < filtered.length
        });
    } catch (error) {
        res.status(500).json({ error: "Search failed" });
    }
};

export const getPlaceNode = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const placeId = parseInt(id as string);

        const place = placesIndex.find(p => p.id === placeId);
        if (!place) {
            return res.status(404).json({ error: "Place not found" });
        }

        res.json({ nodeId: place.nodeId });
    } catch (error) {
        res.status(500).json({ error: "Internal error" });
    }
};
