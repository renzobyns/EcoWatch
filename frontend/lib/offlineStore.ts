/**
 * EcoWatch SJDM — Offline Store (IndexedDB)
 *
 * Provides persistent client-side storage for:
 * 1. Citizen Report Drafts (preventing photo loss on page refresh or browser memory eviction)
 * 2. Cleaner Work Order Resolution Drafts
 * 3. Outbox Reports (queueing submissions made while offline or during connection drops)
 *
 * 100% native browser IndexedDB — zero external dependencies, SSR-safe.
 */

export interface StoredCitizenPhoto {
    blob: Blob;
    fileName: string;
    fileType: string;
    lat: number;
    lon: number;
    accuracy?: number;
    timestamp?: number;
    barangay: string | null;
    source: "camera" | "upload";
}

export interface CitizenDraft {
    id: "active_citizen_draft";
    photos: StoredCitizenPhoto[];
    notes: string;
    deviceLat?: number | null;
    deviceLon?: number | null;
    updatedAt: number;
}

export interface StoredCleanerPhoto {
    blob: Blob;
    fileName: string;
    fileType: string;
    lat: number;
    lon: number;
    accuracy: number;
    timestamp: number;
    distanceFromReport: number;
    source: "camera";
    guideUsed?: boolean;
    overlayStyle?: "ghost" | "corner" | "edge";
    sessionId?: string;
}

export interface CleanerDraft {
    workOrderId: number;
    photos: StoredCleanerPhoto[];
    updatedAt: number;
}

export interface OutboxReportItem {
    id: string;
    createdAt: number;
    lat: number;
    lon: number;
    deviceLat?: number | null;
    deviceLon?: number | null;
    notes?: string;
    barangay?: string | null;
    photos: Array<{
        blob: Blob;
        fileName: string;
        fileType: string;
    }>;
    reporterId: number;
    status: "pending" | "uploading" | "failed";
    retryCount: number;
    lastError?: string;
}

const DB_NAME = "ecowatch_offline_v1";
const DB_VERSION = 1;

const STORES = {
    CITIZEN_DRAFTS: "citizen_drafts",
    CLEANER_DRAFTS: "cleaner_drafts",
    OUTBOX_REPORTS: "outbox_reports",
} as const;

function isIndexedDBSupported(): boolean {
    return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!isIndexedDBSupported()) {
            return reject(new Error("IndexedDB is not supported in this environment"));
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORES.CITIZEN_DRAFTS)) {
                db.createObjectStore(STORES.CITIZEN_DRAFTS, { keyPath: "id" });
            }

            if (!db.objectStoreNames.contains(STORES.CLEANER_DRAFTS)) {
                db.createObjectStore(STORES.CLEANER_DRAFTS, { keyPath: "workOrderId" });
            }

            if (!db.objectStoreNames.contains(STORES.OUTBOX_REPORTS)) {
                db.createObjectStore(STORES.OUTBOX_REPORTS, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
    });
}

// ── Citizen Draft Operations ──────────────────────────────────────────

export async function saveCitizenDraft(
    photos: Array<{
        file: File | Blob;
        lat: number;
        lon: number;
        accuracy?: number;
        timestamp?: number;
        barangay: string | null;
        source: "camera" | "upload";
    }>,
    notes: string,
    deviceLat?: number | null,
    deviceLon?: number | null
): Promise<void> {
    if (!isIndexedDBSupported()) return;

    try {
        const db = await openDatabase();
        const storedPhotos: StoredCitizenPhoto[] = photos.map((p, idx) => ({
            blob: p.file,
            fileName: p.file instanceof File ? p.file.name : `report_photo_${idx + 1}.jpg`,
            fileType: p.file.type || "image/jpeg",
            lat: p.lat,
            lon: p.lon,
            accuracy: p.accuracy,
            timestamp: p.timestamp ?? Date.now(),
            barangay: p.barangay,
            source: p.source,
        }));

        const draft: CitizenDraft = {
            id: "active_citizen_draft",
            photos: storedPhotos,
            notes,
            deviceLat: deviceLat ?? null,
            deviceLon: deviceLon ?? null,
            updatedAt: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CITIZEN_DRAFTS, "readwrite");
            const store = tx.objectStore(STORES.CITIZEN_DRAFTS);
            const req = store.put(draft);

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("[offlineStore] Failed to save citizen draft:", err);
    }
}

export async function getCitizenDraft(): Promise<CitizenDraft | null> {
    if (!isIndexedDBSupported()) return null;

    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CITIZEN_DRAFTS, "readonly");
            const store = tx.objectStore(STORES.CITIZEN_DRAFTS);
            const req = store.get("active_citizen_draft");

            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("[offlineStore] Failed to retrieve citizen draft:", err);
        return null;
    }
}

export async function clearCitizenDraft(): Promise<void> {
    if (!isIndexedDBSupported()) return;

    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CITIZEN_DRAFTS, "readwrite");
            const store = tx.objectStore(STORES.CITIZEN_DRAFTS);
            const req = store.delete("active_citizen_draft");

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("[offlineStore] Failed to clear citizen draft:", err);
    }
}

// ── Cleaner Draft Operations ──────────────────────────────────────────

export async function saveCleanerDraft(
    workOrderId: number,
    photos: Array<{
        file: File | Blob;
        lat: number;
        lon: number;
        accuracy: number;
        timestamp: number;
        distanceFromReport: number;
        source: "camera";
        guideUsed?: boolean;
        overlayStyle?: "ghost" | "corner" | "edge";
        sessionId?: string;
    }>
): Promise<void> {
    if (!isIndexedDBSupported()) return;

    try {
        const db = await openDatabase();
        const storedPhotos: StoredCleanerPhoto[] = photos.map((p, idx) => ({
            blob: p.file,
            fileName: p.file instanceof File ? p.file.name : `cleanup_proof_${idx + 1}.jpg`,
            fileType: p.file.type || "image/jpeg",
            lat: p.lat,
            lon: p.lon,
            accuracy: p.accuracy,
            timestamp: p.timestamp,
            distanceFromReport: p.distanceFromReport,
            source: p.source,
            guideUsed: p.guideUsed,
            overlayStyle: p.overlayStyle,
            sessionId: p.sessionId,
        }));

        const draft: CleanerDraft = {
            workOrderId,
            photos: storedPhotos,
            updatedAt: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CLEANER_DRAFTS, "readwrite");
            const store = tx.objectStore(STORES.CLEANER_DRAFTS);
            const req = store.put(draft);

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("[offlineStore] Failed to save cleaner draft:", err);
    }
}

export async function getCleanerDraft(workOrderId: number): Promise<CleanerDraft | null> {
    if (!isIndexedDBSupported()) return null;

    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CLEANER_DRAFTS, "readonly");
            const store = tx.objectStore(STORES.CLEANER_DRAFTS);
            const req = store.get(workOrderId);

            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("[offlineStore] Failed to retrieve cleaner draft:", err);
        return null;
    }
}

export async function clearCleanerDraft(workOrderId: number): Promise<void> {
    if (!isIndexedDBSupported()) return;

    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.CLEANER_DRAFTS, "readwrite");
            const store = tx.objectStore(STORES.CLEANER_DRAFTS);
            const req = store.delete(workOrderId);

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("[offlineStore] Failed to clear cleaner draft:", err);
    }
}

// ── Outbox Reports Queue ──────────────────────────────────────────────

export async function addOutboxReport(
    item: Omit<OutboxReportItem, "id" | "createdAt" | "status" | "retryCount">
): Promise<string> {
    if (!isIndexedDBSupported()) throw new Error("IndexedDB not available");

    const db = await openDatabase();
    const id = `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const outboxItem: OutboxReportItem = {
        ...item,
        id,
        createdAt: Date.now(),
        status: "pending",
        retryCount: 0,
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.OUTBOX_REPORTS, "readwrite");
        const store = tx.objectStore(STORES.OUTBOX_REPORTS);
        const req = store.put(outboxItem);

        req.onsuccess = () => resolve(id);
        req.onerror = () => reject(req.error);
    });
}

export async function getOutboxReports(): Promise<OutboxReportItem[]> {
    if (!isIndexedDBSupported()) return [];

    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.OUTBOX_REPORTS, "readonly");
            const store = tx.objectStore(STORES.OUTBOX_REPORTS);
            const req = store.getAll();

            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("[offlineStore] Failed to read outbox reports:", err);
        return [];
    }
}

export async function removeOutboxReport(id: string): Promise<void> {
    if (!isIndexedDBSupported()) return;

    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.OUTBOX_REPORTS, "readwrite");
            const store = tx.objectStore(STORES.OUTBOX_REPORTS);
            const req = store.delete(id);

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("[offlineStore] Failed to remove outbox item:", err);
    }
}

export async function updateOutboxReportStatus(
    id: string,
    status: OutboxReportItem["status"],
    lastError?: string
): Promise<void> {
    if (!isIndexedDBSupported()) return;

    try {
        const db = await openDatabase();
        const tx = db.transaction(STORES.OUTBOX_REPORTS, "readwrite");
        const store = tx.objectStore(STORES.OUTBOX_REPORTS);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
            const item: OutboxReportItem | undefined = getReq.result;
            if (!item) return;

            item.status = status;
            if (status === "failed") {
                item.retryCount = (item.retryCount || 0) + 1;
                item.lastError = lastError;
            }
            store.put(item);
        };
    } catch (err) {
        console.warn("[offlineStore] Failed to update outbox item status:", err);
    }
}

/**
 * Utility to convert StoredCitizenPhoto back into standard browser File object
 */
export function storedPhotoToFile(photo: StoredCitizenPhoto | StoredCleanerPhoto): File {
    if (photo.blob instanceof File) {
        return photo.blob;
    }
    return new File([photo.blob], photo.fileName, {
        type: photo.fileType || "image/jpeg",
        lastModified: photo.timestamp || Date.now(),
    });
}
