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
    html: `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 bg-primary/20 rounded-full animate-ping"></div>
            <div class="absolute w-6 h-6 bg-primary/40 rounded-full animate-pulse"></div>
            <div class="relative w-4 h-4 bg-primary rounded-full border-2 border-white shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
        </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
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
    initialLat, 
    initialLon,
    onLocationChange
}: { 
    initialLat: number | null, 
    initialLon: number | null,
    onLocationChange: (lat: number, lon: number) => void
}) {
    // Start with null or provided props
    const [position, setPosition] = useState<[number, number] | null>(
        initialLat && initialLon ? [initialLat, initialLon] : null
    );

    useEffect(() => {
        fixLeafletIcons();
    }, []);

    // Sync from parent (e.g. GPS button) BUT avoid loops
    useEffect(() => {
        if (initialLat && initialLon) {
            // Only update if it's actually a different coordinate than internal state
            if (!position || initialLat !== position[0] || initialLon !== position[1]) {
                setPosition([initialLat, initialLon]);
            }
        }
    }, [initialLat, initialLon]);

    // Only report back to parent if we have a valid position
    useEffect(() => {
        if (position) {
            onLocationChange(position[0], position[1]);
        }
    }, [position]);

    return (
        <div className="w-full h-full rounded-2xl overflow-hidden border border-white/20 relative">
            <MapContainer 
                center={[14.82, 121.05]} // Default view of SJDM
                zoom={13} 
                scrollWheelZoom={true}
                className="w-full h-full z-0"
            >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <MapEvents setPosition={(pos) => setPosition(pos)} />
                {position && <LocationMarker position={position} setPosition={setPosition} />}
            </MapContainer>
            
            {!position && (
                <div className="absolute inset-0 z-[1001] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-6 text-center pointer-events-none">
                    <div className="glass p-4 rounded-2xl border border-white/10 animate-in fade-in zoom-in duration-300">
                        <p className="text-xs font-bold text-white uppercase tracking-widest">
                            No location selected
                        </p>
                        <p className="text-[10px] text-white/50 mt-1">
                            Click the map or "Use my location" to begin
                        </p>
                    </div>
                </div>
            )}

            {position && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] glass px-4 py-2 rounded-full text-[10px] font-bold text-white shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-top-4">
                    Drag pin to fine-tune location
                </div>
            )}
        </div>
    );
}
