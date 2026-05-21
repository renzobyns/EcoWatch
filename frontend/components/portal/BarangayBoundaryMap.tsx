"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useTheme } from "@/components/ThemeProvider";

function FitBounds({ feature }: { feature: any }) {
    const map = useMap();
    useEffect(() => {
        if (!feature) return;
        try {
            const layer = L.geoJSON(feature);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
            }
        } catch {
            // Invalid geometry — leave at default view
        }
    }, [feature, map]);
    return null;
}

export default function BarangayBoundaryMap({ feature }: { feature: any }) {
    const { theme } = useTheme();
    const tileUrl = theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    return (
        <MapContainer
            center={[14.82, 121.05]}
            zoom={12}
            scrollWheelZoom={false}
            zoomControl
            attributionControl={false}
            className="w-full h-full z-0"
        >
            <TileLayer key={theme} url={tileUrl} />
            {feature && (
                <GeoJSON
                    key={feature?.properties?.ADM4_EN}
                    data={feature}
                    style={{ color: "#22c55e", weight: 2.5, fillOpacity: 0.12, fillColor: "#22c55e" }}
                />
            )}
            <FitBounds feature={feature} />
        </MapContainer>
    );
}
