"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Rectangle, useMap, useMapEvents, Marker, Tooltip } from "react-leaflet";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/redux/store";
import { setNodes } from "@/redux/slices/map-slice";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const startIcon = new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background: linear-gradient(160deg, #34d399, #10b981); width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 3px 10px rgba(16,185,129,0.45); display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white; font-weight: 700; font-size: 12px; font-family: system-ui, sans-serif;">A</div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
});

const endIcon = new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background: linear-gradient(160deg, #f87171, #ef4444); width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 3px 10px rgba(239,68,68,0.45); display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white; font-weight: 700; font-size: 12px; font-family: system-ui, sans-serif;">B</div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Edge {
    from: number;
    to: number;
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
}

interface MapStats {
    count: number;
    bounds: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    };
    center: {
        lat: number;
        lon: number;
    };
    loading?: boolean;
}

function MapController({ stats }: { stats: MapStats | null }) {
    const dispatch = useDispatch<AppDispatch>();
    const route = useSelector((state: RootState) => state.map.route);
    const sourceName = useSelector((state: RootState) => state.map.sourceName);
    const destinationName = useSelector((state: RootState) => state.map.destinationName);
    const map = useMap();
    const lastBoundsRef = useRef<string>("");
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const initialFitDone = useRef(false);
    const [zoomLevel, setZoomLevel] = useState(13);

    useEffect(() => {
        if (stats && stats.bounds && !initialFitDone.current && !stats.loading) {
            const bounds: L.LatLngBoundsExpression = [
                [stats.bounds.minLat, stats.bounds.minLon],
                [stats.bounds.maxLat, stats.bounds.maxLon],
            ];
            map.fitBounds(bounds, { padding: [20, 20] });
            initialFitDone.current = true;
        }
    }, [stats, map]);

    const fetchDataInBounds = useCallback(async () => {
        const zoom = map.getZoom();
        setZoomLevel(zoom);

        if (zoom < 10) {
            setEdges([]);
            return;
        }

        const bounds = map.getBounds();
        const boundsKey = `${bounds.getSouth().toFixed(3)},${bounds.getNorth().toFixed(3)},${bounds.getWest().toFixed(3)},${bounds.getEast().toFixed(3)},${zoom}`;

        if (boundsKey === lastBoundsRef.current) return;
        lastBoundsRef.current = boundsKey;
        setIsLoading(true);

        const params = `minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLon=${bounds.getWest()}&maxLon=${bounds.getEast()}`;
        const edgeLimit = zoom >= 15 ? 5000 : zoom >= 13 ? 2000 : 1000;

        try {
            const edgesRes = await fetch(`${API_BASE}/api/edges?${params}&limit=${edgeLimit}`);
            const edgesData = await edgesRes.json();

            if (edgesData.edges) {
                setEdges(edgesData.edges);
            }
        } catch (error) {
            console.error("Failed to fetch map data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [map]);

    const debouncedFetch = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            fetchDataInBounds();
        }, 300);
    }, [fetchDataInBounds]);

    useMapEvents({
        moveend: debouncedFetch,
        zoomend: debouncedFetch,
    });

    useEffect(() => {
        if (initialFitDone.current) {
            debouncedFetch();
        }
    }, [debouncedFetch]);

    useEffect(() => {
        if (route && route.coordinates && route.coordinates.length > 0) {
            const pathCoords: [number, number][] = route.coordinates.map(c => [c.lat, c.lon]);
            if (pathCoords.length > 0) {
                // The floating route panel sits over the top-left of the map, so a
                // uniform padding can still leave a start/end marker hidden behind
                // it. Reserve real space for the panel's actual rendered size
                // instead of guessing, falling back to a reasonable default.
                const panelRect = document.getElementById("route-panel")?.getBoundingClientRect();
                const paddingTopLeft: [number, number] = panelRect
                    ? [panelRect.right + 24, panelRect.bottom + 24]
                    : [340, 300];

                map.fitBounds(pathCoords as L.LatLngBoundsExpression, {
                    paddingTopLeft,
                    paddingBottomRight: [40, 40],
                });
            }
        }
    }, [route, map]);

    const pathCoords: [number, number][] = useMemo(() => {
        return route?.coordinates?.map(c => [c.lat, c.lon]) || [];
    }, [route]);

    const edgeElements = useMemo(() => {
        if (zoomLevel < 10) return null;

        return edges.map((edge, idx) => (
            <Polyline
                key={`edge-${idx}`}
                positions={[
                    [edge.fromLat, edge.fromLon],
                    [edge.toLat, edge.toLon],
                ]}
                pathOptions={{
                    color: "#94a3b8",
                    weight: zoomLevel >= 15 ? 2.5 : 1.5,
                    opacity: 0.55,
                }}
            />
        ));
    }, [edges, zoomLevel]);

    return (
        <>
            {edgeElements}

            {pathCoords.length > 0 && (
                <>
                    <Polyline
                        positions={pathCoords}
                        pathOptions={{
                            color: "#ffffff",
                            weight: 9,
                            opacity: 1,
                        }}
                    />
                    <Polyline
                        positions={pathCoords}
                        pathOptions={{
                            color: "#2a4fd6",
                            weight: 5,
                            opacity: 0.95,
                        }}
                    />
                    <Marker
                        position={pathCoords[0]}
                        icon={startIcon}
                        eventHandlers={{ click: (e) => e.target.openTooltip() }}
                    >
                        <Tooltip direction="top" offset={[0, -30]} opacity={1}>
                            {sourceName || "Start"}
                        </Tooltip>
                    </Marker>
                    <Marker
                        position={pathCoords[pathCoords.length - 1]}
                        icon={endIcon}
                        eventHandlers={{ click: (e) => e.target.openTooltip() }}
                    >
                        <Tooltip direction="top" offset={[0, -30]} opacity={1}>
                            {destinationName || "Destination"}
                        </Tooltip>
                    </Marker>
                </>
            )}

            {isLoading && (
                <div className="absolute top-4 right-4 z-[1000] bg-slate-900/85 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-white flex items-center gap-2 shadow-lg animate-fade-in">
                    <div className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    Loading roads...
                </div>
            )}

            {zoomLevel < 10 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/85 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-slate-200 shadow-lg animate-fade-in">
                    Zoom in to see road network
                </div>
            )}
        </>
    );
}

export default function MapView() {
    const [isClient, setIsClient] = useState(false);
    const [stats, setStats] = useState<MapStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isBackendLoading, setIsBackendLoading] = useState(true);

    useEffect(() => {
        setIsClient(true);
        let pollInterval: NodeJS.Timeout;

        const checkStats = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/nodes/stats`);
                if (!res.ok) throw new Error("Failed to fetch stats");
                const data = await res.json();

                if (data.loading) {
                    setStats({ ...data, loading: true });
                    setIsBackendLoading(true);
                } else if (data.count > 0) {
                    setStats(data);
                    setIsBackendLoading(false);
                    if (pollInterval) clearInterval(pollInterval);
                } else {
                    setIsBackendLoading(true);
                    setStats(null);
                }
            } catch (err) {
                setError(`Backend connection failed`);
                setIsBackendLoading(false);
            }
        };

        checkStats();
        pollInterval = setInterval(checkStats, 2000);

        return () => clearInterval(pollInterval);
    }, []);

    if (!isClient) {
        return (
            <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                <div className="animate-pulse text-slate-500 text-sm font-medium">Initializing...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                <div className="text-center p-6 max-w-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                        <svg className="h-6 w-6 text-red-400" viewBox="0 0 24 24" fill="none" strokeWidth={2}>
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78a1.5 1.5 0 001.29-2.25L13.71 3.86a1.5 1.5 0 00-2.42 0z" />
                        </svg>
                    </div>
                    <div className="text-slate-200 font-semibold mb-1.5">Connection Error</div>
                    <div className="text-slate-500 text-sm">{error}</div>
                    <div className="text-slate-600 text-xs mt-4">
                        Make sure backend is running: <code className="bg-slate-800 text-slate-400 px-2 py-1 rounded-md">cd backend && npm run dev</code>
                    </div>
                </div>
            </div>
        );
    }

    if (isBackendLoading || !stats || stats.loading) {
        return (
            <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-11 h-11 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-slate-300 font-medium text-sm">Loading map data...</div>
                    {stats?.count && (
                        <div className="text-slate-500 text-xs mt-2">
                            {stats.count.toLocaleString()} nodes ready
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const defaultCenter: [number, number] = stats?.center
        ? [stats.center.lat, stats.center.lon]
        : [28.6139, 77.209];

    return (
        <MapContainer
            center={defaultCenter}
            zoom={12}
            className="w-full h-full rounded-xl"
            style={{ background: "#f8fafc" }}
        >
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController stats={stats} />
        </MapContainer>
    );
}

