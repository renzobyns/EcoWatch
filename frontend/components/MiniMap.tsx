"use client";

import { MapContainer, TileLayer, Marker, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState, useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const fixLeafletIcons = () => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
};

const customIcon = new L.DivIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="background-color: #22c55e; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #22c55e;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

// Fit map to barangay boundary when loaded
function FitBounds({ geoData }: { geoData: any }) {
    const map = useMap();

    useEffect(() => {
        if (geoData) {
            const layer = L.geoJSON(geoData);
            map.fitBounds(layer.getBounds(), { padding: [30, 30] });
        }
    }, [geoData, map]);

    return null;
}

interface MiniMapProps {
    lat: number;
    lon: number;
    barangay?: string;
}

export default function MiniMap({ lat, lon, barangay }: MiniMapProps) {
    const { theme } = useTheme();
    const [barangayGeo, setBarangayGeo] = useState<any>(null);

    useEffect(() => {
        fixLeafletIcons();
    }, []);

    // Fetch and filter GeoJSON for the specific barangay
    useEffect(() => {
        if (!barangay) return;

        const controller = new AbortController();
        fetch(`${API_URL}/spatial/barangays`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                const feature = data.features?.find(
                    (f: any) => f.properties.ADM4_EN?.toLowerCase() === barangay.toLowerCase()
                );
                if (feature) {
                    setBarangayGeo({
                        type: "FeatureCollection",
                        features: [feature],
                    });
                }
            })
            .catch(err => {
                if (err.name !== "AbortError") {
                    console.error("MiniMap: Failed to load barangay boundary:", err);
                }
            });

        return () => controller.abort();
    }, [barangay]);

    const tileUrl = theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const boundaryStyle = useMemo(() => ({
        color: "#10b981",
        weight: 2,
        opacity: 0.8,
        fillColor: "#10b981",
        fillOpacity: 0.08,
        dashArray: "6 4",
    }), []);

    return (
        <MapContainer
            center={[lat, lon]}
            zoom={15}
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
            className="w-full h-full z-0"
        >
            <TileLayer key={theme} url={tileUrl} />
            {barangayGeo && (
                <>
                    <GeoJSON
                        key={`boundary-${barangay}`}
                        data={barangayGeo}
                        style={() => boundaryStyle}
                    />
                    <FitBounds geoData={barangayGeo} />
                </>
            )}
            <Marker position={[lat, lon]} icon={customIcon} />
        </MapContainer>
    );
}
