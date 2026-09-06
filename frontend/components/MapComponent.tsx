"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { formatDate } from "@/lib/date-utils";
import { Filter, Calendar, X, ChevronDown, RefreshCw } from "lucide-react";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://renzobyns-ecowatch-backend.hf.space";

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
    pending: createCustomIcon('#ef4444'),       // Red
    verified: createCustomIcon('#f97316'),      // Orange
    assigned: createCustomIcon('#eab308'),      // Yellow
    in_progress: createCustomIcon('#3b82f6'),   // Blue
    resolved: createCustomIcon('#22c55e'),      // Green
    failed_cleanup: createCustomIcon('#b91c1c'), // Dark Red
    rejected: createCustomIcon('#6b7280'),      // Gray
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


const EMPTY_REPORTS: any[] = [];
const EMPTY_HEATMAPS: any[] = [];

export type DateFilterType = "all" | "1w" | "1m" | "6m" | "1y" | "custom";

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
    loading?: boolean;                   // manually control the loading state (e.g. for demo/testing)
    onMapReady?: () => void;             // notify parent that map geo data has loaded
    showDateFilter?: boolean;            // default true
    filterClassName?: string;            // custom position/classes for filter control
    onDateFilterChange?: (filter: { preset: DateFilterType; days?: number; startDate?: string; endDate?: string }) => void;
}

export default function SJDMMap({
    height = "100vh",
    reports = EMPTY_REPORTS,
    heatmaps = EMPTY_HEATMAPS,
    focusedBarangay = null,
    onBarangayClick,
    workOrders,
    pinColorBy,
    onPinClick,
    loading: externalLoading,
    onMapReady,
    showDateFilter = true,
    filterClassName,
    onDateFilterChange,
}: MapProps) {
    const { theme } = useTheme();
    const [geoData, setGeoData] = useState<any>(null);
    const [internalLoading, setInternalLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Date Filter State
    const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");
    const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);
    const [isCustomOpen, setIsCustomOpen] = useState<boolean>(false);
    const [filteredHeatmaps, setFilteredHeatmaps] = useState<any[] | null>(null);
    const [isHeatmapLoading, setIsHeatmapLoading] = useState<boolean>(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const onDateFilterChangeRef = useRef(onDateFilterChange);
    onDateFilterChangeRef.current = onDateFilterChange;

    const activeHeatmaps = (dateFilter === "all" || !filteredHeatmaps) ? heatmaps : filteredHeatmaps;

    const loading = externalLoading !== undefined ? externalLoading : internalLoading;

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
                setInternalLoading(false);
                if (onMapReady) onMapReady();
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

    // Re-fetch DBSCAN heatmap clusters dynamically when date filter changes
    useEffect(() => {
        if (workOrders || dateFilter === "all") {
            setFilteredHeatmaps(null);
            if (onDateFilterChangeRef.current) {
                onDateFilterChangeRef.current({ preset: "all" });
            }
            return;
        }

        let isCancelled = false;
        let queryParam = "";
        let days: number | undefined;

        if (dateFilter === "1w") {
            days = 7;
            queryParam = "?days=7";
        } else if (dateFilter === "1m") {
            days = 30;
            queryParam = "?days=30";
        } else if (dateFilter === "6m") {
            days = 180;
            queryParam = "?days=180";
        } else if (dateFilter === "1y") {
            days = 365;
            queryParam = "?days=365";
        } else if (dateFilter === "custom") {
            if (!customStartDate) return;
            queryParam = `?date_from=${customStartDate}${customEndDate ? `&date_to=${customEndDate}` : ""}`;
        } else {
            return;
        }

        setIsHeatmapLoading(true);
        fetch(`${API_URL}/spatial/heatmaps${queryParam}`)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (!isCancelled && data && Array.isArray(data.hotspots)) {
                    setFilteredHeatmaps(data.hotspots);
                }
            })
            .catch((err) => {
                console.error("Failed to fetch filtered heatmaps:", err);
            })
            .finally(() => {
                if (!isCancelled) setIsHeatmapLoading(false);
            });

        if (onDateFilterChangeRef.current) {
            onDateFilterChangeRef.current({
                preset: dateFilter,
                days,
                startDate: customStartDate || undefined,
                endDate: customEndDate || undefined,
            });
        }

        return () => {
            isCancelled = true;
        };
    }, [dateFilter, customStartDate, customEndDate, workOrders]);

    // Dismiss expanded filter on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterExpanded(false);
                setIsCustomOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Filter reports based on created_at and selected timeframe
    const filteredReports = useMemo(() => {
        let result = reports;
        if (focusedBarangay) {
            result = result.filter((r) => r.barangay === focusedBarangay);
        }
        if (dateFilter === "all") return result;

        const now = Date.now();
        let cutoffMs = 0;
        if (dateFilter === "1w") cutoffMs = now - 7 * 86400000;
        else if (dateFilter === "1m") cutoffMs = now - 30 * 86400000;
        else if (dateFilter === "6m") cutoffMs = now - 180 * 86400000;
        else if (dateFilter === "1y") cutoffMs = now - 365 * 86400000;
        else if (dateFilter === "custom" && customStartDate) {
            const startMs = new Date(customStartDate).getTime();
            const endMs = customEndDate ? new Date(customEndDate).getTime() + 86400000 : Infinity;
            return result.filter((r) => {
                if (!r.created_at) return false;
                const t = new Date(r.created_at).getTime();
                return !isNaN(t) && t >= startMs && t <= endMs;
            });
        }

        return result.filter((r) => {
            if (!r.created_at) return false;
            const t = new Date(r.created_at).getTime();
            return !isNaN(t) && t >= cutoffMs;
        });
    }, [reports, focusedBarangay, dateFilter, customStartDate, customEndDate]);

    // Filter workOrders for cleaner map view
    const filteredWorkOrders = useMemo(() => {
        if (!workOrders) return [];
        if (dateFilter === "all") return workOrders;

        const now = Date.now();
        let cutoffMs = 0;
        if (dateFilter === "1w") cutoffMs = now - 7 * 86400000;
        else if (dateFilter === "1m") cutoffMs = now - 30 * 86400000;
        else if (dateFilter === "6m") cutoffMs = now - 180 * 86400000;
        else if (dateFilter === "1y") cutoffMs = now - 365 * 86400000;
        else if (dateFilter === "custom" && customStartDate) {
            const startMs = new Date(customStartDate).getTime();
            const endMs = customEndDate ? new Date(customEndDate).getTime() + 86400000 : Infinity;
            return workOrders.filter((w) => {
                const raw = w.created_at || w.assigned_at;
                if (!raw) return false;
                const t = new Date(raw).getTime();
                return !isNaN(t) && t >= startMs && t <= endMs;
            });
        }

        return workOrders.filter((w) => {
            const raw = w.created_at || w.assigned_at;
            if (!raw) return false;
            const t = new Date(raw).getTime();
            return !isNaN(t) && t >= cutoffMs;
        });
    }, [workOrders, dateFilter, customStartDate, customEndDate]);

    const visibleCount = workOrders ? filteredWorkOrders.length : filteredReports.length;
    const totalCount = workOrders
        ? workOrders.length
        : (focusedBarangay ? reports.filter((r) => r.barangay === focusedBarangay).length : reports.length);

    const tileUrl = theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const mapBg = theme === "dark" ? "#09090b" : "#e8efe9";

    if (loading) {
        return null;
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
                {activeHeatmaps.map((cluster, idx) => (
                    <CircleMarker
                        key={`heat-${idx}-${dateFilter}`}
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
                {workOrders && filteredWorkOrders.map((wo) => {
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
                {!workOrders && filteredReports.map((report) => {
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
                                              report.status === 'assigned' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                                              report.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                              report.status === 'verified' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                              report.status === 'failed_cleanup' ? 'bg-red-900/30 text-red-400 border border-red-900/40' :
                                              report.status === 'rejected' ? 'bg-foreground/10 text-foreground/40 border border-foreground/20' :
                                              'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                                            {report.status}
                                        </span>
                                        <span className="text-xs text-gray-400 font-medium">{formatDate(report.created_at)}</span>
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

            {/* Floating Animated Date Filter Control */}
            {showDateFilter && (
                <div
                    ref={filterRef}
                    className={`absolute z-[1000] ${
                        filterClassName || "top-4 right-4 sm:top-4 sm:right-6"
                    } select-none transition-all duration-300 ease-out`}
                >
                    {!isFilterExpanded ? (
                        /* Collapsed Filter Pill — Premium Glass Companion */
                        <button
                            type="button"
                            onClick={() => setIsFilterExpanded(true)}
                            className="glass-pro px-3.5 py-2 rounded-2xl flex items-center gap-3 text-foreground transition-all shadow-xl hover:shadow-2xl hover:border-primary/40 group cursor-pointer active:scale-95 select-none"
                            title="Filter reports by date range"
                        >
                            <div className="relative w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm border border-primary/20">
                                <Filter className="w-4 h-4" />
                                {dateFilter !== "all" && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-background animate-pulse" />
                                )}
                            </div>
                            <div className="text-left hidden xs:block pr-0.5">
                                <div className="text-[9px] text-primary font-bold uppercase tracking-[0.16em] flex items-center gap-1">
                                    <span>Timeframe</span>
                                    {dateFilter !== "all" && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                </div>
                                <div className="text-xs font-bold text-foreground/90">
                                    {dateFilter === "all" && "All Time"}
                                    {dateFilter === "1w" && "Past 7 Days"}
                                    {dateFilter === "1m" && "Past 30 Days"}
                                    {dateFilter === "6m" && "Past 6 Months"}
                                    {dateFilter === "1y" && "Past 1 Year"}
                                    {dateFilter === "custom" && "Custom Range"}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 pl-1">
                                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-extrabold border border-primary/20">
                                    {visibleCount}
                                </span>
                                <div className="w-5 h-5 rounded-full bg-foreground/5 group-hover:bg-foreground/10 flex items-center justify-center transition-colors">
                                    <ChevronDown className="w-3.5 h-3.5 text-foreground/70 group-hover:text-foreground transition-transform duration-200" />
                                </div>
                            </div>
                        </button>
                    ) : (
                        /* Expanded Animated Filter Container — Modern Floating Dock */
                        <div className="glass-pro p-3.5 rounded-2xl shadow-2xl border border-primary/25 bg-background/90 dark:bg-zinc-950/90 backdrop-blur-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200 max-w-[94vw] sm:max-w-md">
                            {/* Header Row */}
                            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/60">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-foreground leading-none">Date Range Filter</h4>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Showing <span className="font-bold text-primary">{visibleCount}</span> of {totalCount} {workOrders ? "jobs" : "reports"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {isHeatmapLoading && (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20">
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                            <span className="hidden sm:inline">Clustering...</span>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFilterExpanded(false);
                                            setIsCustomOpen(false);
                                        }}
                                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors flex items-center justify-center cursor-pointer"
                                        title="Close filter"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Segmented Preset Chips */}
                            <div className="bg-muted/60 dark:bg-zinc-900/80 p-1 rounded-xl grid grid-cols-3 sm:grid-cols-6 gap-1 border border-border/40">
                                {[
                                    { id: "all", label: "All Time", short: "All" },
                                    { id: "1w", label: "1 Week", short: "7D" },
                                    { id: "1m", label: "1 Month", short: "30D" },
                                    { id: "6m", label: "6 Mos", short: "6M" },
                                    { id: "1y", label: "1 Year", short: "1Y" },
                                    { id: "custom", label: "Custom", short: "📅" },
                                ].map((item) => {
                                    const isActive = dateFilter === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setDateFilter(item.id as DateFilterType);
                                                if (item.id === "custom") {
                                                    setIsCustomOpen(true);
                                                } else {
                                                    setIsCustomOpen(false);
                                                }
                                            }}
                                            className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all duration-200 text-center flex items-center justify-center gap-1 cursor-pointer select-none ${
                                                isActive
                                                    ? "eco-gradient text-white shadow-md shadow-primary/25 scale-[1.02] border border-white/20"
                                                    : "text-foreground/70 hover:text-foreground hover:bg-background/80 dark:hover:bg-zinc-800/80"
                                            }`}
                                        >
                                            <span className="hidden sm:inline">{item.label}</span>
                                            <span className="sm:hidden">{item.short}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom Date Range Tray */}
                            {isCustomOpen && (
                                <div className="p-2.5 rounded-xl bg-muted/40 dark:bg-zinc-900/50 border border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <div className="flex-1 flex flex-col gap-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</label>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</label>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
                                        />
                                    </div>
                                    {(customStartDate || customEndDate) && (
                                        <div className="sm:self-end flex items-center pt-1 sm:pt-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCustomStartDate("");
                                                    setCustomEndDate("");
                                                    setDateFilter("all");
                                                    setIsCustomOpen(false);
                                                }}
                                                className="w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors cursor-pointer"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Micro Footer Note */}
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 px-0.5">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Live DBSCAN clustering active
                                </span>
                                <span>Click outside to close</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Back to City View Button */}
            {focusedBarangay && onBarangayClick && (
                <button
                    onClick={() => onBarangayClick(null)}
                    className="absolute top-[84px] left-4 z-[1000] glass px-4 py-2 rounded-full text-xs font-bold text-foreground hover:bg-foreground/10 transition-colors flex items-center gap-2 shadow-xl shadow-black/50"
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
