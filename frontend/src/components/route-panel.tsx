"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import {
    setSource,
    setDestination,
    setSourceName as setSourcePlaceName,
    setDestinationName as setDestPlaceName,
    fetchRoute,
    clearRoute,
} from "@/redux/slices/map-slice";
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

function formatDuration(km: number): string {
    const avgSpeedKmh = 45;
    const hours = km / avgSpeedKmh;
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export default function RoutePanel() {
    const dispatch = useDispatch<AppDispatch>();
    const { route, loading, error } = useSelector((state: RootState) => state.map);
    const [sourcePlace, setSourcePlace] = useState<Place | null>(null);
    const [destPlace, setDestPlace] = useState<Place | null>(null);
    const [sourceName, setSourceName] = useState("");
    const [destName, setDestName] = useState("");

    const handleSourceSelect = (place: Place) => {
        setSourcePlace(place);
        setSourceName(place.name);
        dispatch(setSource(place.nodeId));
        dispatch(setSourcePlaceName(place.name));
    };

    const handleDestSelect = (place: Place) => {
        setDestPlace(place);
        setDestName(place.name);
        dispatch(setDestination(place.nodeId));
        dispatch(setDestPlaceName(place.name));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sourcePlace && destPlace) {
            dispatch(fetchRoute({ source: sourcePlace.nodeId, destination: destPlace.nodeId }));
        }
    };

    const handleClear = () => {
        setSourcePlace(null);
        setDestPlace(null);
        setSourceName("");
        setDestName("");
        dispatch(setSource(null));
        dispatch(setDestination(null));
        dispatch(setSourcePlaceName(null));
        dispatch(setDestPlaceName(null));
        dispatch(clearRoute());
    };

    return (
        <div id="route-panel" className="w-full max-w-sm mx-auto md:mx-0">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[var(--shadow-panel-lg)] ring-1 ring-slate-900/5 overflow-hidden animate-panel-in">
                <div className="flex items-center gap-2.5 px-4 pt-4 pb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm shadow-brand-600/30">
                        <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="none" strokeWidth={2.2}>
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-[13px] font-semibold text-slate-900 leading-tight tracking-tight">RoutePath</h1>
                        <p className="text-[11px] text-slate-400 leading-tight">India road network routing</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="px-4 pt-3 pb-2">
                        <div className="flex items-stretch gap-3">
                            <div className="flex flex-col items-center pt-3 pb-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 shrink-0" />
                                <div className="w-0.5 flex-1 min-h-[22px] bg-slate-300 my-1 rounded-full" />
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-red-50 shrink-0" />
                            </div>
                            <div className="flex-1 space-y-2 min-w-0">
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

                    <div className="px-4 pb-4 flex gap-2">
                        <button
                            type="submit"
                            disabled={loading || !sourcePlace || !destPlace}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 active:scale-[0.98] text-white font-medium rounded-xl shadow-sm shadow-brand-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 text-sm"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Finding route...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-1.5">
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" strokeWidth={2.2}>
                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                                    </svg>
                                    Find Route
                                </span>
                            )}
                        </button>
                        {(sourcePlace || destPlace || route) && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-600 font-medium rounded-xl transition-all text-sm"
                                aria-label="Clear route"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" strokeWidth={2.2}>
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </form>

                {error && (
                    <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-start gap-2 animate-fade-in">
                        <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth={2}>
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78a1.5 1.5 0 001.29-2.25L13.71 3.86a1.5 1.5 0 00-2.42 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {route && (
                    <div className="mx-4 mb-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-50/40 border border-emerald-100 overflow-hidden animate-fade-in">
                        <div className="px-3.5 py-3 flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                                <svg className="h-4.5 w-4.5 text-emerald-600" viewBox="0 0 24 24" fill="none" strokeWidth={2.4}>
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                    <p className="text-lg font-bold text-emerald-900 leading-tight">{route.distance.toFixed(1)}</p>
                                    <span className="text-xs font-medium text-emerald-700">km</span>
                                    <span className="text-slate-300 text-xs mx-0.5">&bull;</span>
                                    <p className="text-sm font-medium text-emerald-800">~{formatDuration(route.distance)}</p>
                                </div>
                                {sourcePlace && destPlace && (
                                    <p className="text-[11px] text-emerald-700/70 truncate mt-0.5">
                                        {sourcePlace.name} <span className="mx-0.5">→</span> {destPlace.name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
