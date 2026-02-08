import { Router } from "express";
import { getNodes, getNodeStats } from "../controllers/node.controller";

const router = Router();

router.get("/", getNodes);
router.get("/stats", getNodeStats);

export default router;
