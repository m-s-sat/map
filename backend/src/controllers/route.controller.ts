import { Request, Response } from "express";
import routeService from "../services/route.service";
import fs from "fs";
import path from "path";

interface NodeData {
  id: number;
  lat: number;
  lon: number;
}

let nodesData: NodeData[] | null = null;

function loadNodes(): NodeData[] {
  if (nodesData) return nodesData;

  const isProduction = process.env.NODE_ENV === 'production';
  const nodesBinFile = isProduction
    ? path.join(process.cwd(), 'data/nodes.bin')
    : path.join(__dirname, "../../../data/nodes.bin");

  if (!fs.existsSync(nodesBinFile)) {
    return [];
  }

  const buffer = fs.readFileSync(nodesBinFile);
  const nodeCount = buffer.length / 16;

  const nodes: NodeData[] = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    const offset = i * 16;
    nodes[i] = {
      id: i,
      lat: buffer.readDoubleLE(offset),
      lon: buffer.readDoubleLE(offset + 8),
    };
  }

  nodesData = nodes;
  return nodes;
}

export const getRoute = async (req: Request, res: Response) => {
  try {
    const { source, destination } = req.body;

    if (source === undefined || destination === undefined) {
      return res.status(400).json({
        error: "source and destination required",
      });
    }

    const result = await routeService.getRoute(source, destination);

    if (!result) {
      return res.status(404).json({
        error: "No path found between source and destination",
      });
    }

    const nodes = loadNodes();
    const coordinates: { lat: number; lon: number }[] = [];

    for (const nodeId of result.path) {
      if (nodeId < nodes.length && nodes[nodeId]) {
        coordinates.push({
          lat: nodes[nodeId].lat,
          lon: nodes[nodeId].lon,
        });
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
    res.status(500).json({
      error: "Routing failed",
    });
  }
};
