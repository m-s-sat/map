import { Router } from "express";
import { getEdges } from "../controllers/edge.controller";

const router = Router();

router.get("/", getEdges);

export default router;
