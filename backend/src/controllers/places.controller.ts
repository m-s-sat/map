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
let loadProgress = 0;

const isProduction = process.env.NODE_ENV === 'production';
const binFile = isProduction
    ? path.join(process.cwd(), 'data/places.bin')
    : path.join(__dirname, "../../../data/places.bin");
const nodesBinFile = isProduction
    ? path.join(process.cwd(), 'data/nodes.bin')
    : path.join(__dirname, "../../../data/nodes.bin");

async function loadPlacesFromBinary(): Promise<void> {
    if (placesLoaded) return;

    console.log("[PLACES] Loading places from binary file...");
    const startTime = Date.now();

    if (!fs.existsSync(binFile)) {
        console.error("[PLACES] Binary file not found:", binFile);
        console.error("[PLACES] Run: python scripts/convert_places_to_bin.py");
        placesLoaded = true;
        return;
    }

    const buffer = fs.readFileSync(binFile);
    const placeCount = buffer.readUInt32LE(0);

    // Safety check for file size vs count
    const minExpectedSize = 4 + (placeCount * 97); // Header + records (approx)
    if (buffer.length < minExpectedSize) {
        console.error(`[PLACES] Binary file too small. Expected at least ${minExpectedSize} bytes, got ${buffer.length}.`);
        console.error(`[PLACES] File likely corrupt or download failed.`);
        placesLoaded = true;
        return;
    }
    console.log(`[PLACES] Reading ${placeCount.toLocaleString()} places...`);

    const RECORD_SIZE = 97;
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

        if ((i + 1) % 10000 === 0) {
            loadProgress = i + 1;
        }
    }

    if (fs.existsSync(nodesBinFile)) {
        console.log("[PLACES] Mapping places to nearest nodes...");
        const nodesBuffer = fs.readFileSync(nodesBinFile);
        const nodeCount = nodesBuffer.length / 16;

        for (const place of placesIndex) {
            let minDist = Infinity;
            let nearestNode = 0;

            const searchStart = Math.max(0, Math.floor(place.lat * 100000) - 1000);
            const searchEnd = Math.min(nodeCount, searchStart + 20000);

            for (let i = searchStart; i < searchEnd; i++) {
                const nodeOffset = i * 16;
                const nodeLat = nodesBuffer.readDoubleLE(nodeOffset);
                const nodeLon = nodesBuffer.readDoubleLE(nodeOffset + 8);

                const dist = Math.abs(nodeLat - place.lat) + Math.abs(nodeLon - place.lon);
                if (dist < minDist) {
                    minDist = dist;
                    nearestNode = i;
                }
            }
            place.nodeId = nearestNode;
        }
    }

    placesLoaded = true;
    console.log(`[PLACES] Loaded ${placesIndex.length.toLocaleString()} places in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
}

setTimeout(() => loadPlacesFromBinary(), 500);

export const searchPlaces = async (req: Request, res: Response) => {
    try {
        if (!placesLoaded) {
            return res.json({ places: [], loading: true, progress: loadProgress });
        }

        const queryParam = req.query.q;
        const query = (typeof queryParam === "string" ? queryParam : "").toLowerCase().trim();
        const limitParam = req.query.limit;
        const limit = parseInt(typeof limitParam === "string" ? limitParam : "20") || 20;
        const offsetParam = req.query.offset;
        const offset = parseInt(typeof offsetParam === "string" ? offsetParam : "0") || 0;

        let filtered: Place[];

        if (!query || query.length < 2) {
            filtered = placesIndex;
        } else {
            filtered = placesIndex.filter(p => p.name.toLowerCase().includes(query));
            filtered.sort((a, b) => {
                const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
                const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
                return aStarts - bStarts || a.name.localeCompare(b.name);
            });
        }

        const paged = filtered.slice(offset, offset + limit);
        const hasMore = offset + limit < filtered.length;

        res.json({
            places: paged,
            total: filtered.length,
            hasMore,
            offset,
        });
    } catch (err) {
        console.error("[PLACES] Search error:", err);
        res.status(500).json({ error: "Search failed" });
    }
};

export const getPlaceNode = async (req: Request, res: Response) => {
    try {
        const placeId = parseInt(req.params.id as string);
        const place = placesIndex.find(p => p.id === placeId);

        if (!place) {
            return res.status(404).json({ error: "Place not found" });
        }

        res.json({
            place,
            nodeId: place.nodeId,
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to get place" });
    }
};
