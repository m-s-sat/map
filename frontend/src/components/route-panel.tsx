"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { setSource, setDestination, fetchRoute, clearRoute } from "@/redux/slices/map-slice";
import PlaceSearch from "./place-search";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Place {
    id: number;
    name: string;
    type: string;
    lat: number;
    lon: number;
    nodeId: number;
}

export default function RoutePanel() {
    const dispatch = useDispatch<AppDispatch>();
    const { route, loading, error } = useSelector((state: RootState) => state.map);
    const [sourcePlace, setSourcePlace] = useState<Place | null>(null);
    const [destPlace, setDestPlace] = useState<Place | null>(null);
    const [sourceName, setSourceName] = useState("");
    const [destName, setDestName] = useState("");
    const [isExpanded, setIsExpanded] = useState(false);

    const handleSourceSelect = (place: Place) => {
        setSourcePlace(place);
        setSourceName(place.name);
        dispatch(setSource(place.nodeId));
    };

    const handleDestSelect = (place: Place) => {
        setDestPlace(place);
        setDestName(place.name);
        dispatch(setDestination(place.nodeId));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sourcePlace && destPlace) {
            dispatch(fetchRoute({ source: sourcePlace.nodeId, destination: destPlace.nodeId }));
            setIsExpanded(false);
        }
    };

    const handleClear = () => {
        setSourcePlace(null);
        setDestPlace(null);
        setSourceName("");
        setDestName("");
        dispatch(setSource(null));
        dispatch(setDestination(null));
        dispatch(clearRoute());
    };

    return (
        <div className="max-w-md mx-auto md:mx-0">
            <div className="bg-white rounded-xl shadow-xl overflow-visible">
                <form onSubmit={handleSubmit}>
                    <div className="p-3 space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <div className="w-0.5 h-6 bg-slate-300" />
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <PlaceSearch
                                    placeholder="Starting point"
                                    onSelect={handleSourceSelect}
                                    value={sourceName}
                                />
                                <PlaceSearch
                                    placeholder="Destination"
                                    onSelect={handleDestSelect}
                                    value={destName}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="px-3 pb-3 flex gap-2">
                        <button
                            type="submit"
                            disabled={loading || !sourcePlace || !destPlace}
                            className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Finding...
                                </span>
                            ) : (
                                "Find Route"
                            )}
                        </button>
                        {(sourcePlace || destPlace || route) && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors text-sm"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </form>

                {error && (
                    <div className="mx-3 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {route && (
                    <div className="mx-3 mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-800 font-semibold text-lg">{route.distance.toFixed(1)} km</p>
                                <p className="text-green-600 text-xs">{route.path.length} waypoints</p>
                            </div>
                            {sourcePlace && destPlace && (
                                <div className="text-right text-xs text-green-600">
                                    <p>{sourcePlace.name}</p>
                                    <p>↓</p>
                                    <p>{destPlace.name}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
