import { Request, Response } from "express";
import routeService from "../services/route.service";
import fs from "fs";
import path from "path";

const isProduction = process.env.NODE_ENV === 'production';
const nodesBinFile = isProduction
  ? path.join(process.cwd(), 'data/nodes.bin')
  : path.join(__dirname, "../../../data/nodes.bin");

let nodesFd: number | null = null;
let nodeCount = 0;

function initNodes() {
  if (nodesFd) return;
  if (fs.existsSync(nodesBinFile)) {
    const stats = fs.statSync(nodesBinFile);
    nodeCount = stats.size / 16;
    nodesFd = fs.openSync(nodesBinFile, 'r');
  }
}

function readNode(index: number): { lat: number; lon: number } | null {
  if (!nodesFd || index < 0 || index >= nodeCount) return null;
  const buf = Buffer.alloc(16);
  fs.readSync(nodesFd, buf, 0, 16, index * 16);
  return { lat: buf.readDoubleLE(0), lon: buf.readDoubleLE(8) };
}

export const getRoute = async (req: Request, res: Response) => {
  try {
    const { source, destination } = req.body;

    if (source === undefined || destination === undefined) {
      return res.status(400).json({ error: "source and destination required" });
    }

    const result = await routeService.getRoute(source, destination);

    if (!result) {
      return res.status(503).json({
        error: "Routing service unavailable (disabled for low-memory mode)"
      });
    }

    initNodes();
    const coordinates: { lat: number; lon: number }[] = [];

    for (const nodeId of result.path) {
      const node = readNode(nodeId);
      if (node) {
        coordinates.push(node);
      }
    }

    res.json({
      success: true,
      distance: result.distance,
      path: result.path,
      coordinates: coordinates,
    });

  } catch (err) {
    console.error("Routing error:", err);
    res.status(500).json({ error: "Routing failed" });
  }
};
