"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default leaflet icons in Next.js
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

interface MapProps {
    height?: string;
    onLocationSelect?: (lat: number, lon: number) => void;
}

export default function SJDMMap({ height = "500px", onLocationSelect }: MapProps) {
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
                const layer = e.target;
                layer.setStyle({
                    fillOpacity: 0.7,
                    weight: 3,
                    color: "#22c55e",
                });
            },
            mouseout: (e: any) => {
                const layer = e.target;
                layer.setStyle({
                    fillOpacity: 0.2,
                    weight: 1,
                    color: "#22c55e",
                });
            },
            click: (e: any) => {
                if (onLocationSelect) {
                    onLocationSelect(e.latlng.lat, e.latlng.lng);
                }
            }
        });
    };

    if (loading) {
        return (
            <div style={{ height }} className="w-full glass flex items-center justify-center animate-pulse">
                <p className="text-primary font-bold">Loading Interactive Map...</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
            <MapContainer
                center={[14.82, 121.05]}
                zoom={12}
                scrollWheelZoom={false}
                style={{ height, width: "100%", background: "#09090b" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {geoData && (
                    <GeoJSON
                        data={geoData}
                        style={{
                            fillColor: "#22c55e",
                            weight: 1,
                            opacity: 1,
                            color: "#22c55e",
                            fillOpacity: 0.2,
                        }}
                        onEachFeature={onEachBarangay}
                    />
                )}
            </MapContainer>

            {error && (
                <div className="absolute top-4 left-4 z-[1000] glass px-3 py-1.5 rounded-lg text-[10px] font-bold text-yellow-400 border border-yellow-500/20 bg-yellow-500/5">
                    {error}
                </div>
            )}

            <div className="absolute bottom-4 right-4 z-[1000] glass px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-primary/80 pointer-events-none">
                SJDM Spatial Engine v1.0
            </div>
        </div>
    );
}
