const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

function getUserIdHeader(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
        const raw = localStorage.getItem("ecowatch_user");
        if (!raw) return {};
        const user = JSON.parse(raw);
        return user?.id ? { "X-User-Id": String(user.id) } : {};
    } catch {
        return {};
    }
}

export async function api(path: string, opts: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
        ...getUserIdHeader(),
        ...(opts.headers as Record<string, string> | undefined),
    };

    // Only set JSON Content-Type when the body is a string (not FormData).
    if (opts.body && typeof opts.body === "string" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_URL}${path}`, { ...opts, headers });

    let data: any = null;
    const text = await res.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { detail: text };
        }
    }

    if (!res.ok) {
        const msg = data?.detail || `Request failed (${res.status})`;
        throw new ApiError(res.status, typeof msg === "string" ? msg : JSON.stringify(msg));
    }

    return data;
}

export { API_URL };
