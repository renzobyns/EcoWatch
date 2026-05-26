export type LngLat = [number, number];
export type LinearRing = LngLat[];
export type PolygonCoords = LinearRing[];
export type MultiPolygonCoords = PolygonCoords[];

export interface BarangayProperties {
    ADM4_EN: string;
    ADM4_PCODE: string;
    ADM3_EN?: string;
}

export interface BarangayFeature {
    type: "Feature";
    properties: BarangayProperties;
    geometry: {
        type: "Polygon" | "MultiPolygon";
        coordinates: PolygonCoords | MultiPolygonCoords;
    };
}

export interface BarangayFeatureCollection {
    type: "FeatureCollection";
    features: BarangayFeature[];
}

export interface NearbyBarangay {
    name: string;
    pcode: string;
    distanceKm: number;
    centroidLat: number;
    centroidLon: number;
}

let cache: BarangayFeatureCollection | null = null;
let pending: Promise<BarangayFeatureCollection> | null = null;
const centroidCache = new Map<string, [number, number]>();

export async function loadBarangays(): Promise<BarangayFeatureCollection> {
    if (cache) return cache;
    if (pending) return pending;
    pending = fetch("/data/sjdm_barangays.geojson")
        .then((res) => {
            if (!res.ok) throw new Error(`Failed to load barangay boundaries (${res.status})`);
            return res.json() as Promise<BarangayFeatureCollection>;
        })
        .then((fc) => {
            cache = fc;
            pending = null;
            return fc;
        });
    return pending;
}

function pointInRing(lon: number, lat: number, ring: LinearRing): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const intersect =
            yi > lat !== yj > lat &&
            lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

function pointInPolygonRings(lon: number, lat: number, rings: PolygonCoords): boolean {
    if (rings.length === 0) return false;
    if (!pointInRing(lon, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
        if (pointInRing(lon, lat, rings[i])) return false;
    }
    return true;
}

export function pointInBarangay(
    lat: number,
    lon: number,
    fc: BarangayFeatureCollection,
): { name: string; pcode: string } | null {
    for (const f of fc.features) {
        const g = f.geometry;
        if (g.type === "Polygon") {
            if (pointInPolygonRings(lon, lat, g.coordinates as PolygonCoords)) {
                return { name: f.properties.ADM4_EN, pcode: f.properties.ADM4_PCODE };
            }
        } else if (g.type === "MultiPolygon") {
            for (const poly of g.coordinates as MultiPolygonCoords) {
                if (pointInPolygonRings(lon, lat, poly)) {
                    return { name: f.properties.ADM4_EN, pcode: f.properties.ADM4_PCODE };
                }
            }
        }
    }
    return null;
}

function ringCentroid(ring: LinearRing): [number, number] {
    let sx = 0;
    let sy = 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
        sx += ring[i][0];
        sy += ring[i][1];
    }
    return [sx / n, sy / n];
}

export function barangayCentroid(f: BarangayFeature): [number, number] {
    const key = f.properties.ADM4_PCODE;
    const hit = centroidCache.get(key);
    if (hit) return hit;
    const g = f.geometry;
    let centroid: [number, number];
    if (g.type === "Polygon") {
        centroid = ringCentroid((g.coordinates as PolygonCoords)[0]);
    } else {
        let bestArea = -Infinity;
        let best: [number, number] = [0, 0];
        for (const poly of g.coordinates as MultiPolygonCoords) {
            const ring = poly[0];
            if (ring.length > bestArea) {
                bestArea = ring.length;
                best = ringCentroid(ring);
            }
        }
        centroid = best;
    }
    centroidCache.set(key, centroid);
    return centroid;
}

const EARTH_KM = 6371;
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearbyBarangays(
    lat: number,
    lon: number,
    fc: BarangayFeatureCollection,
    n: number,
    excludeName?: string | null,
): NearbyBarangay[] {
    const ranked: NearbyBarangay[] = [];
    for (const f of fc.features) {
        if (excludeName && f.properties.ADM4_EN === excludeName) continue;
        const [cLon, cLat] = barangayCentroid(f);
        ranked.push({
            name: f.properties.ADM4_EN,
            pcode: f.properties.ADM4_PCODE,
            distanceKm: haversineKm(lat, lon, cLat, cLon),
            centroidLat: cLat,
            centroidLon: cLon,
        });
    }
    ranked.sort((a, b) => a.distanceKm - b.distanceKm);
    return ranked.slice(0, n);
}

export function findBarangayByName(
    name: string,
    fc: BarangayFeatureCollection,
): BarangayFeature | null {
    const q = name.toLowerCase();
    return fc.features.find((f) => f.properties.ADM4_EN.toLowerCase() === q) ?? null;
}
