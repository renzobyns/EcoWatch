"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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
    html: `<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #ef4444; animation: pulse 2s infinite;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

function MapEvents({ setPosition }: { setPosition: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });
    return null;
}

function LocationMarker({ position, setPosition }: { position: [number, number], setPosition: (pos: [number, number]) => void }) {
    const markerRef = useRef<any>(null);
    const map = useMap();

    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    const latLng = marker.getLatLng();
                    setPosition([latLng.lat, latLng.lng]);
                }
            },
        }),
        [setPosition]
    );

    useEffect(() => {
        map.flyTo(position, map.getZoom(), { animate: true, duration: 0.5 });
    }, [position, map]);

    return (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
            icon={customIcon}
        />
    );
}

export default function LocationPickerMap({ 
    initialLat = 14.82, 
    initialLon = 121.05,
    onLocationChange
}: { 
    initialLat?: number, 
    initialLon?: number,
    onLocationChange: (lat: number, lon: number) => void
}) {
    const [position, setPosition] = useState<[number, number]>([initialLat, initialLon]);

    useEffect(() => {
        fixLeafletIcons();
    }, []);

    useEffect(() => {
        onLocationChange(position[0], position[1]);
    }, [position, onLocationChange]);

    return (
        <div className="w-full h-full rounded-2xl overflow-hidden border border-white/20 relative">
            <MapContainer 
                center={position} 
                zoom={14} 
                scrollWheelZoom={true}
                className="w-full h-full z-0"
            >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <MapEvents setPosition={setPosition} />
                <LocationMarker position={position} setPosition={setPosition} />
            </MapContainer>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] glass px-4 py-2 rounded-full text-xs font-bold text-white shadow-xl whitespace-nowrap pointer-events-none">
                Drag pin or click map to select
            </div>
        </div>
    );
}
