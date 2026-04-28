"use client";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

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

export default function MiniMap({ lat, lon }: { lat: number, lon: number }) {
    useEffect(() => {
        fixLeafletIcons();
    }, []);

    return (
        <MapContainer 
            center={[lat, lon]} 
            zoom={15} 
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
            className="w-full h-full z-0"
        >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Marker position={[lat, lon]} icon={customIcon} />
        </MapContainer>
    );
}
