import { Router } from "express";
import { searchPlaces, getPlaceNode } from "../controllers/places.controller";

const router = Router();

router.get("/search", searchPlaces);
router.get("/:id/node", getPlaceNode);

export default router;
