"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Rectangle, useMap, useMapEvents, Marker } from "react-leaflet";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/redux/store";
import { setNodes } from "@/redux/slices/map-slice";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const startIcon = new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background: #22c55e; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white; font-weight: bold; font-size: 12px;">A</div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
});

const endIcon = new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background: #ef4444; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white; font-weight: bold; font-size: 12px;">B</div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
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
                map.fitBounds(pathCoords as L.LatLngBoundsExpression, { padding: [80, 80] });
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
                    color: "#3b82f6",
                    weight: zoomLevel >= 15 ? 3 : 2,
                    opacity: 0.6,
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
                            color: "#ef4444",
                            weight: 6,
                            opacity: 1,
                        }}
                    />
                    <Marker position={pathCoords[0]} icon={startIcon} />
                    <Marker position={pathCoords[pathCoords.length - 1]} icon={endIcon} />
                </>
            )}

            {isLoading && (
                <div className="absolute top-4 right-4 z-[1000] bg-slate-800/90 px-3 py-1 rounded-full text-xs text-white flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    Loading roads...
                </div>
            )}

            {zoomLevel < 10 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800/90 px-4 py-2 rounded-lg text-sm text-slate-300">
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
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                <div className="animate-pulse text-slate-400">Initializing...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                <div className="text-center p-6">
                    <div className="text-red-400 text-lg mb-2">Connection Error</div>
                    <div className="text-slate-500 text-sm">{error}</div>
                    <div className="text-slate-600 text-xs mt-4">
                        Make sure backend is running: <code className="bg-slate-800 px-2 py-1 rounded">cd backend && npm run dev</code>
                    </div>
                </div>
            </div>
        );
    }

    if (isBackendLoading || !stats || stats.loading) {
        return (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-slate-400">Loading map data...</div>
                    {stats?.count && (
                        <div className="text-slate-500 text-sm mt-2">
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
