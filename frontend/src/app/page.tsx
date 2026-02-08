"use client";

import dynamic from "next/dynamic";
import RoutePanel from "@/components/route-panel";

const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading map...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden relative">
      <div className="absolute inset-0 z-0">
        <MapView />
      </div>
      <div className="absolute top-0 left-0 right-0 z-10 p-3 md:p-4">
        <RoutePanel />
      </div>
    </main>
  );
}
