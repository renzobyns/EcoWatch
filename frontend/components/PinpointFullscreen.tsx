"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    GeoJSON,
    Tooltip,
    useMap,
    useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    loadBarangays,
    pointInBarangay,
    nearbyBarangays,
    findBarangayByName,
    type BarangayFeatureCollection,
    type NearbyBarangay,
} from "@/lib/geo";

const SJDM_CENTER: [number, number] = [14.82, 121.05];
const DEFAULT_ZOOM = 13;

const fixLeafletIcons = () => {
    // @ts-expect-error - leaflet internal
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
};

const pinIcon = new L.DivIcon({
    className: "pinpoint-marker",
    html: `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-14 h-14 rounded-full bg-primary/15 animate-ping"></div>
            <div class="absolute w-9 h-9 rounded-full bg-primary/30 animate-pulse"></div>
            <div class="relative w-10 h-10 rounded-full bg-primary border-2 border-white shadow-[0_0_22px_rgba(16,185,129,0.65)] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
            </div>
        </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
});

interface PinpointFullscreenProps {
    lat: number | null;
    lon: number | null;
    onLocationChange: (lat: number, lon: number) => void;
    onConfirm: () => void;
    onExit: () => void;
    onError?: (message: string) => void;
}

interface MapBridgeProps {
    onReady: (map: L.Map) => void;
    onClick: (lat: number, lon: number) => void;
}

function MapBridge({ onReady, onClick }: MapBridgeProps) {
    const map = useMap();
    useEffect(() => {
        onReady(map);
    }, [map, onReady]);
    useMapEvents({
        click(e) {
            onClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

interface DraggablePinProps {
    position: [number, number];
    onMove: (lat: number, lon: number) => void;
}

function DraggablePin({ position, onMove }: DraggablePinProps) {
    const ref = useRef<L.Marker | null>(null);
    return (
        <Marker
            draggable
            position={position}
            icon={pinIcon}
            ref={(r) => {
                ref.current = r;
            }}
            eventHandlers={{
                dragend() {
                    const m = ref.current;
                    if (!m) return;
                    const ll = m.getLatLng();
                    onMove(ll.lat, ll.lng);
                },
            }}
        >
            <Tooltip
                permanent
                direction="top"
                offset={[0, -22]}
                className="pinpoint-tooltip"
            >
                PINNING LOCATION
            </Tooltip>
        </Marker>
    );
}

export default function PinpointFullscreen({
    lat,
    lon,
    onLocationChange,
    onConfirm,
    onExit,
    onError,
}: PinpointFullscreenProps) {
    const { theme } = useTheme();
    const [fc, setFc] = useState<BarangayFeatureCollection | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [coordLat, setCoordLat] = useState("");
    const [coordLon, setCoordLon] = useState("");
    const [coordError, setCoordError] = useState<string | null>(null);
    const [coordDescription, setCoordDescription] = useState<string | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        fixLeafletIcons();
        loadBarangays()
            .then(setFc)
            .catch((err) => {
                console.error("Failed to load barangays:", err);
                onError?.("Unable to load barangay boundaries.");
            });
    }, [onError]);

    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const currentBarangay = useMemo(() => {
        if (!fc || lat == null || lon == null) return null;
        return pointInBarangay(lat, lon, fc);
    }, [fc, lat, lon]);

    const nearby = useMemo<NearbyBarangay[]>(() => {
        if (!fc || lat == null || lon == null) return [];
        return nearbyBarangays(lat, lon, fc, 4, currentBarangay?.name ?? null);
    }, [fc, lat, lon, currentBarangay]);

    const visibleList = useMemo(() => {
        if (!fc) return [];
        const q = searchQuery.trim().toLowerCase();
        if (!q) return nearby;
        return fc.features
            .filter((f) => f.properties.ADM4_EN.toLowerCase().includes(q))
            .slice(0, 6)
            .map<NearbyBarangay>((f) => {
                const centroid = ((): [number, number] => {
                    const ring =
                        f.geometry.type === "Polygon"
                            ? (f.geometry.coordinates as number[][][])[0]
                            : ((f.geometry.coordinates as number[][][][])[0]?.[0] ?? []);
                    let sx = 0;
                    let sy = 0;
                    for (const [x, y] of ring) {
                        sx += x;
                        sy += y;
                    }
                    const n = Math.max(1, ring.length);
                    return [sx / n, sy / n];
                })();
                const distKm =
                    lat != null && lon != null
                        ? Math.hypot(centroid[0] - lon, centroid[1] - lat) * 111
                        : 0;
                return {
                    name: f.properties.ADM4_EN,
                    pcode: f.properties.ADM4_PCODE,
                    distanceKm: distKm,
                    centroidLat: centroid[1],
                    centroidLon: centroid[0],
                };
            });
    }, [fc, searchQuery, nearby, lat, lon]);

    const tileUrl =
        theme === "dark"
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            onError?.("Your browser does not support Geolocation.");
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setIsLocating(false);
                onLocationChange(pos.coords.latitude, pos.coords.longitude);
                const m = mapRef.current;
                if (m) m.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 0.8 });
            },
            (err) => {
                setIsLocating(false);
                let msg = "Unable to get your location.";
                if (err.code === err.PERMISSION_DENIED)
                    msg = "Permission denied. Please allow location access.";
                else if (err.code === err.POSITION_UNAVAILABLE)
                    msg = "Location unavailable. Try moving to an open area.";
                else if (err.code === err.TIMEOUT)
                    msg = "Location request timed out. Drag the pin instead.";
                onError?.(msg);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    };

    const handleRecenter = () => {
        const m = mapRef.current;
        if (!m) return;
        if (lat != null && lon != null) m.flyTo([lat, lon], 16, { duration: 0.6 });
        else m.flyTo(SJDM_CENTER, DEFAULT_ZOOM, { duration: 0.6 });
    };

    const handleFlyTo = (toLat: number, toLon: number) => {
        const m = mapRef.current;
        if (m) m.flyTo([toLat, toLon], 15, { duration: 0.7 });
    };

    const handleSearchPick = (name: string) => {
        if (!fc) return;
        const f = findBarangayByName(name, fc);
        if (!f) return;
        const ring =
            f.geometry.type === "Polygon"
                ? (f.geometry.coordinates as number[][][])[0]
                : ((f.geometry.coordinates as number[][][][])[0]?.[0] ?? []);
        let sx = 0;
        let sy = 0;
        for (const [x, y] of ring) {
            sx += x;
            sy += y;
        }
        const n = Math.max(1, ring.length);
        handleFlyTo(sy / n, sx / n);
        setSearchQuery("");
    };

    const handleCoordSearch = () => {
        setCoordError(null);
        setCoordDescription(null);
        const la = parseFloat(coordLat.trim());
        const lo = parseFloat(coordLon.trim());
        if (isNaN(la) || isNaN(lo)) {
            setCoordError("Enter valid numbers for both fields.");
            return;
        }
        if (la < -90 || la > 90) { setCoordError("Latitude must be between -90 and 90."); return; }
        if (lo < -180 || lo > 180) { setCoordError("Longitude must be between -180 and 180."); return; }
        onLocationChange(la, lo);
        mapRef.current?.flyTo([la, lo], 17, { duration: 0.8 });
        const brgy = fc ? pointInBarangay(la, lo, fc) : null;
        if (brgy) {
            setCoordDescription(`📍 ${brgy.name}, San Jose del Monte, Bulacan`);
        } else {
            setCoordDescription(`📍 ${la.toFixed(5)}° N, ${lo.toFixed(5)}° E — outside SJDM`);
        }
    };

    const handleToggleFullscreen = () => {
        const el = wrapperRef.current;
        if (!el) return;
        if (!document.fullscreenElement) el.requestFullscreen?.();
        else document.exitFullscreen?.();
    };

    const inSJDM = !!currentBarangay;
    const hasPin = lat != null && lon != null;

    const boundaryStyle = (feature?: GeoJSON.Feature) => {
        const name = feature?.properties?.ADM4_EN as string | undefined;
        const isHighlighted = !!name && name === currentBarangay?.name;
        return {
            color: "#10b981",
            weight: isHighlighted ? 2.5 : 1,
            opacity: isHighlighted ? 0.95 : 0.45,
            fillColor: "#10b981",
            fillOpacity: isHighlighted ? 0.18 : 0.04,
            dashArray: isHighlighted ? undefined : "2 4",
        } as L.PathOptions;
    };

    return (
        <div
            ref={wrapperRef}
            className="fixed left-0 right-0 bottom-0 top-16 overflow-hidden bg-background"
        >
            <MapContainer
                center={SJDM_CENTER}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom
                zoomControl={false}
                className="w-full h-full z-0"
            >
                <TileLayer key={theme} url={tileUrl} />
                <MapBridge
                    onReady={(m) => {
                        mapRef.current = m;
                    }}
                    onClick={(la, lo) => onLocationChange(la, lo)}
                />
                {fc && (
                    <GeoJSON
                        key={`${theme}-${currentBarangay?.name ?? "none"}`}
                        data={fc as GeoJSON.FeatureCollection}
                        style={boundaryStyle}
                    />
                )}
                {hasPin && (
                    <DraggablePin
                        position={[lat!, lon!]}
                        onMove={(la, lo) => onLocationChange(la, lo)}
                    />
                )}
            </MapContainer>

            {/* Exit Map */}
            <button
                onClick={onExit}
                className="absolute top-4 left-4 z-[1000] glass-pro rounded-full pl-3 pr-4 py-2 flex items-center gap-2 text-sm font-semibold text-foreground"
                aria-label="Exit Map"
            >
                <span className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </span>
                Exit Map
            </button>

            {/* Left panel toggle (always visible when panel is closed) */}
            {!leftOpen && (
                <button
                    onClick={() => setLeftOpen(true)}
                    className="absolute top-20 left-4 z-[1001] glass-pro w-10 h-10 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                    title="Show location info"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                </button>
            )}

            {/* Jurisdiction Info Card */}
            {leftOpen && (
            <div className="absolute top-20 left-4 w-[320px] max-w-[calc(100vw-2rem)] z-[1000] animate-in fade-in slide-in-from-left-4 duration-300">
                <div
                    className={`glass-pro rounded-2xl p-4 ${
                        hasPin && inSJDM
                            ? "ring-2 ring-primary/50 shadow-[0_0_30px_-8px_rgba(16,185,129,0.5)]"
                            : ""
                    }`}
                >
                    {hasPin ? (
                        <>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mb-0.5">
                                        {inSJDM ? "Barangay" : "Outside SJDM"}
                                    </p>
                                    <h3 className="text-lg font-bold text-foreground leading-tight">
                                        {currentBarangay?.name ?? "Not in jurisdiction"}
                                    </h3>
                                </div>
                                <span
                                    className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                                        inSJDM
                                            ? "bg-primary/15 text-primary border border-primary/30"
                                            : "bg-red-500/15 text-red-400 border border-red-500/30"
                                    }`}
                                >
                                    {inSJDM ? "Lvl 1 Scope" : "Out of bounds"}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-wider">
                                <span
                                    className={`inline-flex items-center gap-1.5 ${
                                        inSJDM ? "text-primary" : "text-red-400"
                                    }`}
                                >
                                    {inSJDM ? (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    ) : (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    )}
                                    {inSJDM ? "Within Jurisdiction" : "Outside SJDM"}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-foreground/[0.04] rounded-lg px-3 py-2 border border-border">
                                    <p className="text-[9px] font-semibold text-foreground/40 uppercase tracking-wider">
                                        Latitude
                                    </p>
                                    <p className="text-sm font-bold text-foreground tabular-nums">
                                        {lat!.toFixed(4)}° N
                                    </p>
                                </div>
                                <div className="bg-foreground/[0.04] rounded-lg px-3 py-2 border border-border">
                                    <p className="text-[9px] font-semibold text-foreground/40 uppercase tracking-wider">
                                        Longitude
                                    </p>
                                    <p className="text-sm font-bold text-foreground tabular-nums">
                                        {lon!.toFixed(4)}° E
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2 text-xs text-foreground/60 bg-foreground/[0.03] rounded-lg px-3 py-2 border border-border">
                                <svg className="shrink-0 mt-0.5 text-primary" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <span>
                                    {inSJDM
                                        ? `Report will be routed to ${currentBarangay?.name} Barangay Hall.`
                                        : "Pin must be inside San Jose del Monte to submit a report."}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground mb-0.5">
                                    Pinpoint Location
                                </p>
                                <p className="text-xs text-foreground/60 leading-relaxed">
                                    Click anywhere on the map or tap{" "}
                                    <span className="text-primary font-semibold">Use Current Location</span>{" "}
                                    to begin.
                                </p>
                            </div>
                        </div>
                    )}
                    {/* Left panel hide button */}
                    <button
                        onClick={() => setLeftOpen(false)}
                        className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-foreground/10 hover:bg-foreground/20 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors"
                        title="Hide panel"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            )}

            {/* Right panel toggle (always visible when panel is closed) */}
            {!rightOpen && (
                <button
                    onClick={() => setRightOpen(true)}
                    className="absolute top-4 right-4 z-[1001] glass-pro w-10 h-10 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                    title="Show search"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                </button>
            )}

            {/* Search + Nearby */}
            {rightOpen && (
            <div className="absolute top-4 right-4 w-[340px] max-w-[calc(100vw-2rem)] z-[1000] animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="glass-pro rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1">Search</span>
                        <button
                            onClick={() => setRightOpen(false)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors"
                            title="Hide panel"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <div className="relative mb-3">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Barangay..."
                            className="pl-9 pr-12 h-10"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-foreground/40 bg-foreground/10 border border-border px-1.5 py-0.5 rounded">
                            ⌘ K
                        </span>
                    </div>

                    <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1 mb-2">
                        {searchQuery.trim()
                            ? "Search Results"
                            : hasPin
                            ? "Nearby Jurisdictions"
                            : "Available Barangays"}
                    </p>

                    <div className="max-h-[300px] overflow-y-auto scrollbar-hide space-y-1">
                        {visibleList.length === 0 ? (
                            <div className="text-xs text-foreground/50 px-2 py-4 text-center">
                                {hasPin ? "No barangays found." : "Drop a pin to see nearby."}
                            </div>
                        ) : (
                            visibleList.map((b) => (
                                <button
                                    key={b.pcode}
                                    onClick={() =>
                                        searchQuery.trim()
                                            ? handleSearchPick(b.name)
                                            : handleFlyTo(b.centroidLat, b.centroidLon)
                                    }
                                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 transition-colors text-left group"
                                >
                                    <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">
                                            Barangay {b.name}
                                        </p>
                                        <p className="text-[10px] text-foreground/50 truncate">
                                            San Jose del Monte, Bulacan
                                        </p>
                                    </div>
                                    {hasPin && (
                                        <span className="text-[11px] font-bold text-foreground/60 tabular-nums shrink-0">
                                            {b.distanceKm < 10
                                                ? b.distanceKm.toFixed(1)
                                                : Math.round(b.distanceKm)}
                                            km
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1 mb-2">
                            Go to Coordinates
                        </p>
                        <div className="flex gap-2 mb-1.5">
                            <Input
                                value={coordLat}
                                onChange={(e) => { setCoordLat(e.target.value); setCoordError(null); }}
                                onKeyDown={(e) => e.key === "Enter" && handleCoordSearch()}
                                placeholder="Latitude"
                                className="h-9 text-xs tabular-nums"
                            />
                            <Input
                                value={coordLon}
                                onChange={(e) => { setCoordLon(e.target.value); setCoordError(null); }}
                                onKeyDown={(e) => e.key === "Enter" && handleCoordSearch()}
                                placeholder="Longitude"
                                className="h-9 text-xs tabular-nums"
                            />
                            <button
                                onClick={handleCoordSearch}
                                className="shrink-0 h-9 px-3 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold transition-colors border border-primary/30"
                            >
                                Go
                            </button>
                        </div>
                        {coordError && (
                            <p className="text-[10px] text-red-400 px-1">{coordError}</p>
                        )}
                        {coordDescription && !coordError && (
                            <p className="text-[10px] text-primary px-1 mt-1 font-medium">{coordDescription}</p>
                        )}
                    </div>

                    <div className="mt-2 pt-2 px-1 border-t border-border">
                        <span className="text-[10px] font-medium text-foreground/40 italic">
                            Viewing SJDM Map Boundaries
                        </span>
                    </div>
                </div>
            </div>
            )}

            {/* Map Controls */}
            <div className="absolute right-4 bottom-36 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-[1000] flex flex-col gap-2">
                <MapControlButton
                    label="Zoom in"
                    onClick={() => mapRef.current?.zoomIn()}
                    icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    }
                />
                <MapControlButton
                    label="Zoom out"
                    onClick={() => mapRef.current?.zoomOut()}
                    icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    }
                />
                <MapControlButton
                    label="Recenter"
                    onClick={handleRecenter}
                    icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    }
                />
                <MapControlButton
                    label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    onClick={handleToggleFullscreen}
                    icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
                        </svg>
                    }
                />
            </div>

            {/* Bottom Action Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col sm:flex-row items-center gap-3 w-[min(560px,calc(100vw-2rem))]">
                <Button
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto flex-1 backdrop-blur-xl"
                >
                    {isLocating ? (
                        <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
                        </svg>
                    )}
                    {isLocating ? "Locating..." : "Use Current Location"}
                </Button>
                <Button
                    onClick={onConfirm}
                    disabled={!hasPin || !inSJDM}
                    size="lg"
                    className="w-full sm:w-auto flex-1"
                >
                    Confirm Report Location
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Button>
            </div>
        </div>
    );
}

function MapControlButton({
    label,
    onClick,
    icon,
}: {
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="glass-pro w-10 h-10 rounded-xl flex items-center justify-center text-foreground/80 hover:text-primary"
        >
            {icon}
        </button>
    );
}
