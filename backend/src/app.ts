import express from "express";
import cors from "cors";
import routeRouter from "./routes/route.routes";
import nodeRouter from "./routes/node.routes";
import edgeRouter from "./routes/edge.routes";
import placesRouter from "./routes/places.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        name: "Map API",
        status: "running",
        endpoints: ["/api/nodes", "/api/edges", "/api/places", "/api/route"]
    });
});

app.use("/api/route", routeRouter);
app.use("/api/nodes", nodeRouter);
app.use("/api/edges", edgeRouter);
app.use("/api/places", placesRouter);

export default app;

