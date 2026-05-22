"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

// Fix for default leaflet icons
const fixLeafletIcons = () => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// --- Custom Icons ---
const createCustomIcon = (color: string) => {
    return new L.DivIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
};

const icons = {
    pending: createCustomIcon('#ef4444'), // Red
    verified: createCustomIcon('#ef4444'), // Red
    deployed: createCustomIcon('#eab308'), // Yellow
    resolved: createCustomIcon('#22c55e'), // Green
    failed_cleanup: createCustomIcon('#ef4444'), // Red
};

// Priority-coloured icons for the cleaner Map View
const priorityIcons = {
    high: createCustomIcon('#ef4444'),   // Red
    medium: createCustomIcon('#eab308'), // Yellow
    low: createCustomIcon('#3b82f6'),    // Blue
};

// WorkOrder status-coloured icons (fallback when pinColorBy="status")
const workOrderStatusIcons = {
    assigned: createCustomIcon('#eab308'),    // Yellow
    in_progress: createCustomIcon('#3b82f6'), // Blue
    needs_redo: createCustomIcon('#ef4444'),  // Red
    verified: createCustomIcon('#22c55e'),    // Green
    completed: createCustomIcon('#22c55e'),   // Green
};

// --- Map Controller for Zooming ---
function MapController({ focusedBarangay, geoData }: { focusedBarangay: string | null, geoData: any }) {
    const map = useMap();

    useEffect(() => {
        if (!focusedBarangay) {
            // Reset to city view
            map.setView([14.82, 121.05], 12);
            return;
        }

        if (geoData) {
            const feature = geoData.features.find((f: any) => f.properties.ADM4_EN === focusedBarangay);
            if (feature) {
                const layer = L.geoJSON(feature);
                map.fitBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 15 });
            }
        }
    }, [focusedBarangay, geoData, map]);

    return null;
}


interface MapProps {
    height?: string;
    reports?: any[];
    heatmaps?: any[];
    focusedBarangay?: string | null;
    onBarangayClick?: (barangay: string | null) => void;
    // Cleaner additions:
    workOrders?: any[];                  // when provided, render WO pins instead of report pins
    pinColorBy?: "status" | "priority";  // default "priority" for workOrders, "status" for reports
    onPinClick?: (item: any) => void;    // called with the clicked WO or report
}

export default function SJDMMap({
    height = "100vh",
    reports = [],
    heatmaps = [],
    focusedBarangay = null,
    onBarangayClick,
    workOrders,
    pinColorBy,
    onPinClick,
}: MapProps) {
    const { theme } = useTheme();
    const [geoData, setGeoData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fixLeafletIcons();
        const controller = new AbortController();

        const fetchGeoData = async () => {
            try {
                const res = await fetch(`${API_URL}/spatial/barangays`, {
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                const data = await res.json();
                setGeoData(data);
            } catch (err: any) {
                if (err.name !== "AbortError") {
                    console.error("Failed to load GeoJSON:", err);
                    setError("Backend unavailable — map overlay disabled.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchGeoData();
        return () => controller.abort();
    }, []);

    const onEachBarangay = (feature: any, layer: any) => {
        const barangayName = feature.properties.ADM4_EN;
        layer.bindTooltip(barangayName, { sticky: true, className: "glass-tooltip" });

        layer.on({
            mouseover: (e: any) => {
                const l = e.target;
                l.setStyle({
                    fillOpacity: 0.5,
                    weight: 2,
                    color: focusedBarangay === barangayName ? "#10b981" : "#ffffff",
                });
            },
            mouseout: (e: any) => {
                const l = e.target;
                l.setStyle({
                    fillOpacity: focusedBarangay === barangayName ? 0.4 : 0.1,
                    weight: focusedBarangay === barangayName ? 3 : 1,
                    color: focusedBarangay === barangayName ? "#10b981" : "#22c55e",
                });
            },
            click: () => {
                if (onBarangayClick) {
                    onBarangayClick(barangayName);
                }
            }
        });
    };

    const tileUrl = theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const mapBg = theme === "dark" ? "#09090b" : "#e8efe9";

    if (loading) {
        return (
            <div style={{ height }} className="w-full bg-background flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                <p className="text-primary font-bold animate-pulse uppercase tracking-widest text-sm">Initializing Map Engine...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full" style={{ background: mapBg }}>
            <MapContainer
                center={[14.82, 121.05]}
                zoom={12}
                zoomControl={false}
                scrollWheelZoom={true}
                style={{ height, width: "100%", background: mapBg }}
            >
                <MapController focusedBarangay={focusedBarangay} geoData={geoData} />

                <TileLayer
                    key={theme}
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url={tileUrl}
                />
                
                {/* GeoJSON Boundaries */}
                {geoData && (
                    <GeoJSON
                        data={geoData}
                        style={(feature: any) => {
                            const isFocused = focusedBarangay === feature.properties.ADM4_EN;
                            return {
                                fillColor: isFocused ? "#10b981" : "#22c55e",
                                weight: isFocused ? 3 : 1,
                                opacity: 1,
                                color: isFocused ? "#10b981" : "#22c55e",
                                fillOpacity: isFocused ? 0.4 : 0.1,
                            };
                        }}
                        onEachFeature={onEachBarangay}
                    />
                )}

                {/* Heatmap Clusters */}
                {heatmaps.map((cluster, idx) => (
                    <CircleMarker
                        key={`heat-${idx}`}
                        center={[cluster.lat, cluster.lon]}
                        radius={cluster.intensity * 15}
                        pathOptions={{
                            fillColor: "#ef4444",
                            fillOpacity: 0.3,
                            color: "transparent",
                        }}
                    />
                ))}

                {/* Work-Order Pins (Cleaner Map View) — takes precedence over report pins */}
                {workOrders && workOrders.map((wo) => {
                    if (wo.report_lat == null || wo.report_lon == null) return null;
                    const colorMode = pinColorBy ?? "priority";
                    let icon;
                    if (colorMode === "priority") {
                        icon = priorityIcons[wo.priority as keyof typeof priorityIcons] || priorityIcons.medium;
                    } else {
                        icon = workOrderStatusIcons[wo.status as keyof typeof workOrderStatusIcons] || workOrderStatusIcons.assigned;
                    }
                    return (
                        <Marker
                            key={`wo-${wo.id}`}
                            position={[wo.report_lat, wo.report_lon]}
                            icon={icon}
                            eventHandlers={onPinClick ? { click: () => onPinClick(wo) } : undefined}
                        >
                            <Popup className="custom-popup">
                                <div className="p-1 min-w-[200px]">
                                    {wo.report_image_url && (
                                        <div className="w-full h-32 rounded-lg bg-black/50 mb-3 overflow-hidden">
                                            <img
                                                src={`${API_URL}${wo.report_image_url}`}
                                                alt="Report"
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                                            ${wo.priority === 'high' ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                                              wo.priority === 'low' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                                              'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'}`}>
                                            {wo.priority}
                                        </span>
                                        <span className="text-xs text-gray-400 font-medium">{wo.status}</span>
                                    </div>
                                    <p className="text-sm font-bold text-foreground mb-1">{wo.report_tracking_id}</p>
                                    <p className="text-xs text-gray-300 mb-3">{wo.report_barangay}</p>
                                    {onPinClick && (
                                        <button
                                            type="button"
                                            onClick={() => onPinClick(wo)}
                                            className="block w-full py-2 text-center rounded bg-primary/20 hover:bg-primary/40 text-primary text-xs font-bold transition-colors"
                                        >
                                            Open Job →
                                        </button>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Report Pins (only when workOrders is NOT provided) */}
                {!workOrders && reports.map((report) => {
                    // Skip showing reports that aren't in the focused barangay
                    if (focusedBarangay && report.barangay !== focusedBarangay) return null;

                    const status = report.status as keyof typeof icons;
                    const icon = icons[status] || icons.pending;

                    return (
                        <Marker
                            key={report.id}
                            position={[report.lat, report.lon]}
                            icon={icon}
                            eventHandlers={onPinClick ? { click: () => onPinClick(report) } : undefined}
                        >
                            <Popup className="custom-popup">
                                <div className="p-1 min-w-[200px]">
                                    {report.image_url && (
                                        <div className="w-full h-32 rounded-lg bg-black/50 mb-3 overflow-hidden">
                                            <img
                                                src={`${API_URL}${report.image_url}`}
                                                alt="Report"
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                                            ${report.status === 'resolved' ? 'bg-green-500/20 text-green-500 border border-green-500/30' :
                                              report.status === 'deployed' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                                              'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                                            {report.status}
                                        </span>
                                        <span className="text-xs text-gray-400 font-medium">{new Date(report.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm font-bold text-foreground mb-1">{report.barangay}</p>
                                    {report.notes && <p className="text-xs text-gray-300 mb-3 line-clamp-2">{report.notes}</p>}

                                    <Link href={report.tracking_url || "#"} className="block w-full py-2 text-center rounded bg-primary/20 hover:bg-primary/40 text-primary text-xs font-bold transition-colors">
                                        View Full Report →
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {/* Back to City View Button */}
            {focusedBarangay && (
                <button
                    onClick={() => onBarangayClick && onBarangayClick(null)}
                    className="absolute top-24 left-4 z-[1000] glass px-4 py-2 rounded-full text-xs font-bold text-foreground hover:bg-foreground/10 transition-colors flex items-center gap-2 shadow-xl shadow-black/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Back to City View
                </button>
            )}

            {error && (
                <div className="absolute top-24 left-4 z-[1000] glass px-3 py-1.5 rounded-lg text-[10px] font-bold text-yellow-400 border border-yellow-500/20 bg-yellow-500/5">
                    {error}
                </div>
            )}
        </div>
    );
}
