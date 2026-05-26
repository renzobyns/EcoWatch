# CENRO Report Detail Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small centered "Oversight" modal on the CENRO Global Report Queue with a 480px right-side sliding drawer (mirroring `BarangayDetailDrawer.tsx`), make the entire queue row clickable, and remove the Action column.

**Architecture:** Backend gets one new endpoint (`GET /reports/{id}/detail`) that bundles photos, cleanup_photos, and work_orders in one payload, plus an optional `target_id` filter on the existing `/audit-log` endpoint. Frontend adds a single new component `ReportDetailDrawer.tsx` with four tabs (Overview / Evidence / Work Orders / Timeline), and `cenro/page.tsx` is edited to drop the Action column, make rows clickable, and mount the new drawer in place of the old modal.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, lucide-react, FastAPI, SQLAlchemy, Pydantic.

> **Note on TDD:** This project has no pytest infrastructure — the existing backend tests are standalone smoke scripts (`backend/test_auth.py`, `backend/test_analytics.py`). Backend tasks follow that pattern: a standalone script that hits the dev server with `requests`. Frontend has no test suite at all per [CLAUDE.md](CLAUDE.md); visual verification against the running dev server (`npm run dev`, then click reports in `/cenro` → Reports tab) substitutes for automated tests there.

---

## Files

| Action | File | Purpose |
|---|---|---|
| Modify | `backend/main.py` | Add `/reports/{id}/detail` endpoint; add `target_id` param to `/audit-log` |
| Create | `backend/test_report_detail.py` | Smoke test for both new/changed endpoints (existing-style standalone script) |
| Create | `frontend/components/portal/ReportDetailDrawer.tsx` | The drawer component (header, tabs, footer, sub-tab views) |
| Modify | `frontend/app/cenro/page.tsx` | Drop Action column; clickable rows; delete old modal; mount new drawer |

No new packages. No new env vars. No DB migration (the `target_id` column already exists and is indexed on `AuditLog`).

---

### Task 1: Backend — add `target_id` filter to `/audit-log`

**Files:**
- Modify: `backend/main.py:2504-2538`

- [ ] **Step 1: Open the endpoint and add the optional parameter**

Find lines 2504-2519 (the function signature and query):

```python
@app.get("/audit-log")
async def get_audit_log(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """Newest-first audit trail of override actions."""
    rows = (
        db.query(models.AuditLog, models.User.email)
        .outerjoin(models.User, models.AuditLog.user_id == models.User.id)
        .order_by(models.AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
```

Replace with:

```python
@app.get("/audit-log")
async def get_audit_log(
    limit: int = 50,
    offset: int = 0,
    target_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """Newest-first audit trail of override actions.

    Optional `target_id` filters to entries about a single report (or other target).
    """
    query = (
        db.query(models.AuditLog, models.User.email)
        .outerjoin(models.User, models.AuditLog.user_id == models.User.id)
    )
    if target_id is not None:
        query = query.filter(models.AuditLog.target_id == target_id)
    rows = (
        query.order_by(models.AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
```

The rest of the function (rows → entries serialization) stays unchanged.

- [ ] **Step 2: Verify syntax**

Run from `backend/`:
```powershell
python -m py_compile main.py
```
Expected: no output (success).

- [ ] **Step 3: Commit**

```powershell
git add backend/main.py
git commit -m "feat(audit-log): add target_id filter for per-report timeline"
```

---

### Task 2: Backend — add `GET /reports/{id}/detail` endpoint

**Files:**
- Modify: `backend/main.py` — add a new endpoint just after the existing `/reports/sla-breaches` block (around line 1731, before `/reports/export`).

- [ ] **Step 1: Add the endpoint**

Insert this block after the closing of the `/reports/sla-breaches` endpoint and before `@app.get("/reports/export")`:

```python
@app.get("/reports/{report_id}/detail")
async def get_report_detail(
    report_id: int,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_role("cenro")),
):
    """Hydrated detail payload for the CENRO Report Detail Drawer.

    Bundles the report, all citizen photos, all cleanup proof photos, and
    all work orders (with assigned cleaner) in one round-trip.
    """
    report = (
        db.query(models.Report)
        .options(
            joinedload(models.Report.reporter),
            joinedload(models.Report.report_photos),
            joinedload(models.Report.cleanup_photos),
            joinedload(models.Report.work_orders).joinedload(models.WorkOrder.assigned_cleaner),
        )
        .filter(models.Report.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Hydrate the base ReportResponse with photos[] (same shape as /track/{slug})
    response = ReportResponse.model_validate(report)
    response.photos = [
        {
            "url": p.file_path,
            "mask_url": p.ai_mask_path,
            "ai_confidence": p.ai_confidence,
            "ai_verified": p.ai_verified,
            "trust_score": getattr(p, "trust_score", None),
            "failing_signals": json.loads(getattr(p, "trust_signals", None) or "{}").get("failing_signals", []),
        }
        for p in report.report_photos
    ]
    response.failing_signals = _get_report_failing_signals(list(report.report_photos))

    # Cleanup photos (proof of resolution)
    cleanup_photos = []
    for cp in report.cleanup_photos:
        wo = next((w for w in report.work_orders if w.id == cp.work_order_id), None)
        cleaner = wo.assigned_cleaner if wo else None
        cleanup_photos.append({
            "id": cp.id,
            "url": cp.file_path,
            "ai_confidence": cp.ai_confidence,
            "ai_verified": cp.ai_verified,
            "uploaded_at": cp.uploaded_at,
            "work_order_id": cp.work_order_id,
            "cleaner": (
                {"id": cleaner.id, "full_name": cleaner.full_name, "email": cleaner.email}
                if cleaner else None
            ),
        })

    # Work orders (newest first)
    work_orders = [
        serialize_work_order(wo)
        for wo in sorted(report.work_orders, key=lambda w: w.created_at, reverse=True)
    ]

    # Reporter info (None for anonymous reports)
    reporter = None
    if report.reporter:
        reporter = {
            "id": report.reporter.id,
            "full_name": report.reporter.full_name,
            "email": report.reporter.email,
            "phone_number": report.reporter.phone_number,
        }

    return {
        "report": response.model_dump(mode="json"),
        "reporter": reporter,
        "cleanup_photos": cleanup_photos,
        "work_orders": work_orders,
    }
```

- [ ] **Step 2: Verify syntax**

```powershell
python -m py_compile backend/main.py
```
Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add backend/main.py
git commit -m "feat(reports): add /reports/{id}/detail bundling photos + work orders"
```

---

### Task 3: Backend — smoke test the two endpoints

**Files:**
- Create: `backend/test_report_detail.py`

- [ ] **Step 1: Write the smoke test script**

Create the file with these contents:

```python
"""
Smoke test for /reports/{id}/detail and /audit-log?target_id=…

Run while the dev server is up:
    uvicorn main:app --reload
    python test_report_detail.py
"""
import requests
import sys

BASE = "http://127.0.0.1:8000"


def login_cenro() -> str:
    resp = requests.post(
        f"{BASE}/auth/login",
        json={"email": "cenro@test.com", "password": "password123"},
    )
    resp.raise_for_status()
    return resp.json()["user"]["id"], resp.json().get("token", "")


def get_first_report_id() -> int:
    resp = requests.get(f"{BASE}/reports/recent?limit=1")
    resp.raise_for_status()
    reports = resp.json()
    assert reports, "No reports in DB — run `python seed_test_data.py` first."
    return reports[0]["id"]


def test_report_detail(report_id: int, headers: dict) -> None:
    resp = requests.get(f"{BASE}/reports/{report_id}/detail", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "report" in body
    assert "cleanup_photos" in body
    assert "work_orders" in body
    assert body["report"]["id"] == report_id
    assert isinstance(body["cleanup_photos"], list)
    assert isinstance(body["work_orders"], list)
    print(f"OK /reports/{report_id}/detail — {len(body['work_orders'])} work orders, "
          f"{len(body['cleanup_photos'])} cleanup photos")


def test_report_detail_404(headers: dict) -> None:
    resp = requests.get(f"{BASE}/reports/99999999/detail", headers=headers)
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
    print("OK /reports/{nonexistent}/detail returns 404")


def test_audit_log_filter(report_id: int, headers: dict) -> None:
    resp = requests.get(f"{BASE}/audit-log?target_id={report_id}", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "entries" in body
    # Every returned row must be about this report (or zero rows if no actions yet)
    for entry in body["entries"]:
        assert entry["target_id"] == report_id, f"Entry leaked: {entry}"
    print(f"OK /audit-log?target_id={report_id} — {len(body['entries'])} scoped entries")


if __name__ == "__main__":
    # Session-based auth: log in, reuse cookies.
    session = requests.Session()
    login = session.post(
        f"{BASE}/auth/login",
        json={"email": "cenro@test.com", "password": "password123"},
    )
    if login.status_code != 200:
        print(f"CENRO login failed ({login.status_code}). Did you run seed_test_data.py?")
        sys.exit(1)

    # Replace the bare `requests` calls above with the authenticated session
    rid = session.get(f"{BASE}/reports/recent?limit=1").json()[0]["id"]
    headers = {}

    # Run tests with session
    r = session.get(f"{BASE}/reports/{rid}/detail")
    assert r.status_code == 200, f"detail: {r.status_code} {r.text}"
    body = r.json()
    assert body["report"]["id"] == rid
    assert "cleanup_photos" in body and "work_orders" in body
    assert "reporter" in body, "Payload missing 'reporter' field"
    # reporter is None for anonymous; otherwise must have full_name + email
    if body["reporter"] is not None:
        assert "full_name" in body["reporter"] and "email" in body["reporter"]
    print(f"OK /reports/{rid}/detail — {len(body['work_orders'])} WOs, "
          f"{len(body['cleanup_photos'])} cleanup photos, "
          f"reporter={'anonymous' if body['reporter'] is None else body['reporter']['email']}")

    r = session.get(f"{BASE}/reports/99999999/detail")
    assert r.status_code == 404, f"404 test: {r.status_code}"
    print("OK /reports/99999999/detail returns 404")

    r = session.get(f"{BASE}/audit-log?target_id={rid}")
    assert r.status_code == 200, f"audit filter: {r.status_code} {r.text}"
    body = r.json()
    for e in body["entries"]:
        assert e["target_id"] == rid
    print(f"OK /audit-log?target_id={rid} — {len(body['entries'])} entries")

    print("\nAll smoke tests passed.")
```

- [ ] **Step 2: Run the test against a live dev server**

Open one terminal:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

Open another terminal:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python seed_test_data.py     # only if DB is empty
python test_report_detail.py
```

Expected output:
```
OK /reports/<id>/detail — <N> WOs, <M> cleanup photos
OK /reports/99999999/detail returns 404
OK /audit-log?target_id=<id> — <K> entries

All smoke tests passed.
```

- [ ] **Step 3: Commit**

```powershell
git add backend/test_report_detail.py
git commit -m "test(reports): smoke test for /reports/{id}/detail and audit-log filter"
```

---

### Task 4: Frontend — `ReportDetailDrawer.tsx` scaffold (header, tabs, footer, no tab bodies)

**Files:**
- Create: `frontend/components/portal/ReportDetailDrawer.tsx`

This task lays down the shell and the four empty tab functions. Subsequent tasks fill each tab body.

- [ ] **Step 1: Create the file with the scaffold**

Create `frontend/components/portal/ReportDetailDrawer.tsx` with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { X, FileText, Camera, Shield, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawerTab = "overview" | "evidence" | "work_orders" | "timeline";

export interface QueueReport {
    id: number;
    tracking_id: string | null;
    barangay: string | null;
    status: string;
    lat: number;
    lon: number;
    reporter_id: number | null;
    image_url: string | null;
    ai_mask_url: string | null;
    ai_confidence: number | null;
    notes: string | null;
    deployment_notes: string | null;
    trust_score: string | null;
    needs_human_review: boolean;
    failing_signals: string[];
    created_at: string;
    deployed_at: string | null;
    resolved_at: string | null;
    verification_pending: boolean;
}

export interface ReportDetailPayload {
    report: QueueReport & {
        photos: Array<{
            url: string;
            mask_url: string | null;
            ai_confidence: number | null;
            ai_verified: boolean | null;
            trust_score: string | null;
            failing_signals: string[];
        }>;
    };
    reporter: {
        id: number;
        full_name: string;
        email: string;
        phone_number: string | null;
    } | null;
    cleanup_photos: Array<{
        id: number;
        url: string;
        ai_confidence: number | null;
        ai_verified: boolean | null;
        uploaded_at: string;
        work_order_id: number | null;
        cleaner: { id: number; full_name: string; email: string } | null;
    }>;
    work_orders: Array<{
        id: number;
        priority: "low" | "medium" | "high";
        status: "assigned" | "in_progress" | "completed" | "verified" | "needs_redo";
        sla_deadline: string;
        notes: string | null;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
        assigned_cleaner_name: string | null;
        assigned_cleaner_email: string | null;
    }>;
}

export interface AuditEntry {
    id: number;
    user_id: number | null;
    user_email: string | null;
    action: string;
    target_type: string;
    target_id: number | null;
    details: Record<string, unknown>;
    created_at: string;
}

interface Props {
    open: boolean;
    report: QueueReport | null;
    barangays: string[];
    newBarangay: string;
    setNewBarangay: (b: string) => void;
    actionLoading: boolean;
    onClose: () => void;
    onReassign: () => void;
    onForceClose: () => void;
}

// ─── Pill maps ────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
    pending: "bg-red-500/20 text-red-400",
    verified: "bg-orange-500/20 text-orange-400",
    assigned: "bg-yellow-500/20 text-yellow-400",
    in_progress: "bg-blue-500/20 text-blue-400",
    resolved: "bg-green-500/20 text-green-400",
    rejected: "bg-foreground/5 text-foreground/40",
    failed_cleanup: "bg-red-900/30 text-red-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function titleCase(s: string): string {
    return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function TabLoading() {
    return (
        <div className="space-y-2 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 glass rounded-xl animate-pulse" />
            ))}
        </div>
    );
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-red-400">{message}</p>
            <button
                onClick={onRetry}
                className="px-4 py-2 glass border border-border rounded-lg text-xs font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-colors"
            >
                Retry
            </button>
        </div>
    );
}

function TabEmpty({ message }: { message: string }) {
    return (
        <div className="py-12 text-center text-foreground/40">
            <p className="text-sm">{message}</p>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportDetailDrawer({
    open, report, barangays, newBarangay, setNewBarangay,
    actionLoading, onClose, onReassign, onForceClose,
}: Props) {
    const [activeTab, setActiveTab] = useState<DrawerTab>("overview");

    const [detail, setDetail] = useState<ReportDetailPayload | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailFetched, setDetailFetched] = useState(false);

    const [audit, setAudit] = useState<AuditEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [auditFetched, setAuditFetched] = useState(false);

    // Reset lazy data when report changes
    useEffect(() => {
        setActiveTab("overview");
        setDetail(null); setDetailFetched(false); setDetailError(null);
        setAudit([]); setAuditFetched(false); setAuditError(null);
    }, [report?.id]);

    const fetchDetail = async () => {
        if (!report) return;
        setDetailLoading(true);
        setDetailError(null);
        try {
            const data = await api(`/reports/${report.id}/detail`);
            setDetail(data);
            setDetailFetched(true);
        } catch (err) {
            setDetailError(err instanceof ApiError ? err.message : "Failed to load report detail.");
        } finally {
            setDetailLoading(false);
        }
    };

    const fetchAudit = async () => {
        if (!report) return;
        setAuditLoading(true);
        setAuditError(null);
        try {
            const data = await api(`/audit-log?target_id=${report.id}&limit=50`);
            setAudit(data.entries || []);
            setAuditFetched(true);
        } catch (err) {
            setAuditError(err instanceof ApiError ? err.message : "Failed to load timeline.");
        } finally {
            setAuditLoading(false);
        }
    };

    // Lazy-load on tab switch (Overview, Evidence, Work Orders all share /reports/{id}/detail)
    useEffect(() => {
        if (!open || !report) return;
        const needsDetail = activeTab === "overview" || activeTab === "evidence" || activeTab === "work_orders";
        if (needsDetail && !detailFetched && !detailLoading) {
            fetchDetail();
        }
        if (activeTab === "timeline" && !auditFetched && !auditLoading) {
            fetchAudit();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, open, report?.id]);

    if (!report) return null;

    const TABS: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
        { key: "overview",    label: "Overview",    icon: <FileText size={12} /> },
        { key: "evidence",    label: "Evidence",    icon: <Camera size={12} /> },
        { key: "work_orders", label: "Work Orders", icon: <Shield size={12} /> },
        { key: "timeline",    label: "Timeline",    icon: <Clock size={12} /> },
    ];

    const statusPillClass = STATUS_PILL[report.status] ?? "bg-foreground/10 text-foreground";

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                onClick={onClose}
            />

            {/* Drawer panel */}
            <div
                className={`fixed inset-y-0 right-0 z-[2001] w-full max-w-[480px] flex flex-col glass border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
                    open ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-4 border-b border-border shrink-0">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-foreground leading-tight">
                                Report {report.tracking_id ?? `#${report.id}`}
                            </h2>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${statusPillClass}`}>
                                {report.status.replace("_", " ")}
                            </span>
                        </div>
                        <p className="text-[11px] text-foreground/40 mt-0.5">
                            {report.barangay ?? "Unassigned"} · Reported {formatDate(report.created_at)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-foreground/10 text-foreground/40 hover:text-foreground transition-colors shrink-0 ml-3"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tab strip */}
                <div className="flex gap-0.5 px-4 pt-3 border-b border-border shrink-0 overflow-x-auto scrollbar-hide">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors rounded-t-lg border ${
                                activeTab === t.key
                                    ? "bg-primary/15 border-primary/30 border-b-transparent text-primary"
                                    : "text-foreground/40 hover:text-foreground hover:bg-foreground/5 border-transparent"
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                    {activeTab === "overview" && (
                        <OverviewTab
                            report={report}
                            detail={detail}
                            loading={detailLoading}
                            error={detailError}
                            onRetry={fetchDetail}
                        />
                    )}
                    {activeTab === "evidence" && (
                        <EvidenceTab
                            report={report}
                            detail={detail}
                            loading={detailLoading}
                            error={detailError}
                            onRetry={fetchDetail}
                        />
                    )}
                    {activeTab === "work_orders" && (
                        <WorkOrdersTab
                            detail={detail}
                            loading={detailLoading}
                            error={detailError}
                            onRetry={fetchDetail}
                        />
                    )}
                    {activeTab === "timeline" && (
                        <TimelineTab
                            entries={audit}
                            loading={auditLoading}
                            error={auditError}
                            onRetry={fetchAudit}
                        />
                    )}
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t border-border shrink-0 flex flex-col gap-2">
                    <div className="flex gap-2">
                        <select
                            value={newBarangay}
                            onChange={(e) => setNewBarangay(e.target.value)}
                            className="flex-1 bg-foreground/5 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                        >
                            {barangays.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <button
                            onClick={onReassign}
                            disabled={actionLoading || newBarangay === report.barangay}
                            className="px-4 py-2.5 bg-primary hover:bg-emerald-400 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                            Update Route
                        </button>
                    </div>
                    <button
                        onClick={onForceClose}
                        disabled={actionLoading || report.status === "resolved"}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg disabled:opacity-50 transition-colors"
                    >
                        Force Close Ticket
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Tab placeholders (filled in later tasks) ────────────────────────────────

function OverviewTab(props: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    return <TabEmpty message="Overview tab — pending Task 5." />;
}

function EvidenceTab(props: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Evidence tab — pending Task 6." />;
}

function WorkOrdersTab(props: {
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Work Orders tab — pending Task 7." />;
}

function TimelineTab(props: {
    entries: AuditEntry[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Timeline tab — pending Task 8." />;
}
```

- [ ] **Step 2: Type-check by importing it into the page**

This step happens in Task 9 (the integration). For now, just ensure the file parses:
```powershell
cd frontend
npx tsc --noEmit
```
Expected: no errors mentioning `ReportDetailDrawer.tsx`. (Other pre-existing errors, if any, are out of scope.)

- [ ] **Step 3: Commit**

```powershell
git add frontend/components/portal/ReportDetailDrawer.tsx
git commit -m "feat(cenro): scaffold ReportDetailDrawer (header, tabs, footer)"
```

---

### Task 5: Frontend — fill in the **Overview** tab

**Files:**
- Modify: `frontend/components/portal/ReportDetailDrawer.tsx` (`OverviewTab` function)

- [ ] **Step 1: Add imports for icons at the top of the file**

In the existing `import { X, FileText, Camera, Shield, Clock } from "lucide-react";` line, extend to:

```tsx
import { X, FileText, Camera, Shield, Clock, MapPin, User, Mail, Phone, ExternalLink } from "lucide-react";
```

- [ ] **Step 2: Add `TrustBadge` import**

Add right after the `api` import:

```tsx
import { TrustBadge } from "@/components/TrustBadge";
```

- [ ] **Step 3: Replace the `OverviewTab` placeholder**

Find (the placeholder added in Task 4):
```tsx
function OverviewTab(props: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    return <TabEmpty message="Overview tab — pending Task 5." />;
}
```

Replace with:

```tsx
function OverviewTab({ report, detail, loading, error, onRetry }: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    const mapsUrl = `https://www.google.com/maps?q=${report.lat},${report.lon}`;
    const reporter = detail?.reporter ?? null;

    return (
        <div className="flex flex-col gap-4">
            {/* Status / IDs */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">Status & IDs</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Tracking ID</div>
                        <div className="font-mono font-bold text-foreground">{report.tracking_id ?? `#${report.id}`}</div>
                    </div>
                    <div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Barangay</div>
                        <div className="font-bold text-emerald-300">{report.barangay ?? "Unassigned"}</div>
                    </div>
                    <div>
                        <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Reported</div>
                        <div className="text-foreground/80">{formatDate(report.created_at)}</div>
                    </div>
                    {report.deployed_at && (
                        <div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Deployed</div>
                            <div className="text-foreground/80">{formatDate(report.deployed_at)}</div>
                        </div>
                    )}
                    {report.resolved_at && (
                        <div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest">Resolved</div>
                            <div className="text-foreground/80">{formatDate(report.resolved_at)}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Reporter */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">Reporter</div>
                {report.reporter_id === null ? (
                    <div className="flex items-center gap-3 text-foreground/50">
                        <div className="w-10 h-10 rounded-full bg-foreground/5 border border-border flex items-center justify-center shrink-0">
                            <User size={16} className="opacity-50" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">Anonymous Report</span>
                    </div>
                ) : loading && !reporter ? (
                    <div className="h-12 glass rounded-xl animate-pulse" />
                ) : error && !reporter ? (
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                        <span className="text-red-400">Couldn't load reporter info.</span>
                        <button onClick={onRetry} className="px-2 py-1 glass border border-border rounded text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-colors">Retry</button>
                    </div>
                ) : reporter ? (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-foreground/10 border border-border flex items-center justify-center text-sm font-bold text-foreground/60 shrink-0">
                            {reporter.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground text-sm">{reporter.full_name}</div>
                            <div className="text-[11px] text-foreground/50 flex items-center gap-1 mt-0.5">
                                <Mail size={10} /> {reporter.email}
                            </div>
                            {reporter.phone_number && (
                                <div className="text-[11px] text-foreground/50 flex items-center gap-1 mt-0.5">
                                    <Phone size={10} /> {reporter.phone_number}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-[11px] text-foreground/40">Reporter info unavailable.</div>
                )}
            </div>

            {/* Location */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">Location</div>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm text-foreground/80">
                            <MapPin size={14} className="text-foreground/40 shrink-0" />
                            <span className="font-mono">{report.lat.toFixed(6)}, {report.lon.toFixed(6)}</span>
                        </div>
                    </div>
                    <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 glass border border-border rounded-lg text-[10px] font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground transition-colors shrink-0"
                    >
                        <ExternalLink size={10} /> Maps
                    </a>
                </div>
            </div>

            {/* AI Verification */}
            <div className="glass-pro rounded-2xl border border-border p-4">
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-3">AI Verification</div>
                <TrustBadge
                    trust_score={report.trust_score}
                    failing_signals={report.failing_signals}
                    needs_human_review={report.needs_human_review}
                />
                {report.ai_confidence !== null && (
                    <div className="mt-3 text-xs text-foreground/60">
                        Confidence: <span className="font-bold text-foreground">{(report.ai_confidence * 100).toFixed(1)}%</span>
                    </div>
                )}
                {report.verification_pending && (
                    <div className="mt-2 text-[11px] text-amber-300">AI verification still running…</div>
                )}
            </div>

            {/* Notes */}
            {(report.notes || report.deployment_notes) && (
                <div className="glass-pro rounded-2xl border border-border p-4 space-y-3">
                    <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold">Notes</div>
                    {report.notes && (
                        <div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest mb-1">Citizen</div>
                            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{report.notes}</p>
                        </div>
                    )}
                    {report.deployment_notes && (
                        <div>
                            <div className="text-[9px] text-foreground/40 uppercase tracking-widest mb-1">Deployment</div>
                            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{report.deployment_notes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Type-check**

```powershell
cd frontend
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/portal/ReportDetailDrawer.tsx
git commit -m "feat(cenro): Overview tab for ReportDetailDrawer"
```

---

### Task 6: Frontend — fill in the **Evidence** tab

**Files:**
- Modify: `frontend/components/portal/ReportDetailDrawer.tsx` (`EvidenceTab` function)

- [ ] **Step 1: Replace the `EvidenceTab` placeholder**

Find:
```tsx
function EvidenceTab(props: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Evidence tab — pending Task 6." />;
}
```

Replace with:

```tsx
function EvidenceTab({
    report, detail, loading, error, onRetry,
}: {
    report: QueueReport;
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    const [lightbox, setLightbox] = useState<string | null>(null);

    if (loading) return <TabLoading />;
    if (error) return <TabError message={error} onRetry={onRetry} />;

    const photos = detail?.report.photos ?? [];
    const cleanupPhotos = detail?.cleanup_photos ?? [];

    // Fall back to single image_url if the photos[] array is empty (legacy data)
    const legacyFallback = photos.length === 0 && report.image_url
        ? [{
            url: report.image_url,
            mask_url: report.ai_mask_url,
            ai_confidence: report.ai_confidence,
            ai_verified: null,
            trust_score: report.trust_score,
            failing_signals: report.failing_signals,
          }]
        : [];
    const citizenPhotos = photos.length > 0 ? photos : legacyFallback;

    const isEmpty = citizenPhotos.length === 0 && cleanupPhotos.length === 0;

    if (isEmpty) {
        return (
            <TabEmpty
                message={report.verification_pending
                    ? "AI verification still running…"
                    : "No evidence uploaded yet."}
            />
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Citizen photos + AI mask */}
            {citizenPhotos.length > 0 && (
                <div>
                    <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">Citizen Evidence</div>
                    <div className="flex flex-col gap-4">
                        {citizenPhotos.map((p, i) => (
                            <div key={i} className="glass-pro rounded-xl border border-border p-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setLightbox(p.url)}
                                        className="aspect-square rounded-lg overflow-hidden bg-foreground/5 border border-border hover:border-primary/40 transition-colors"
                                    >
                                        <img src={p.url} alt="Citizen photo" className="w-full h-full object-cover" />
                                    </button>
                                    <button
                                        onClick={() => p.mask_url && setLightbox(p.mask_url)}
                                        disabled={!p.mask_url}
                                        className="aspect-square rounded-lg overflow-hidden bg-foreground/5 border border-border hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {p.mask_url ? (
                                            <img src={p.mask_url} alt="AI mask" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[10px] text-foreground/40 uppercase tracking-widest">No mask</span>
                                        )}
                                    </button>
                                </div>
                                {p.ai_confidence !== null && (
                                    <div className="mt-2 text-[11px] text-foreground/60">
                                        AI confidence: <span className="font-bold text-foreground">{(p.ai_confidence * 100).toFixed(1)}%</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cleanup proof */}
            {cleanupPhotos.length > 0 && (
                <div>
                    <div className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">Cleanup Proof</div>
                    <div className="flex flex-col gap-2">
                        {cleanupPhotos.map((cp) => (
                            <div key={cp.id} className="glass-pro rounded-xl border border-border p-3 flex gap-3">
                                <button
                                    onClick={() => setLightbox(cp.url)}
                                    className="w-20 h-20 rounded-lg overflow-hidden bg-foreground/5 border border-border shrink-0 hover:border-primary/40 transition-colors"
                                >
                                    <img src={cp.url} alt="Cleanup proof" className="w-full h-full object-cover" />
                                </button>
                                <div className="min-w-0 flex-1 text-xs">
                                    <div className="font-semibold text-foreground truncate">
                                        {cp.cleaner?.full_name ?? "Unknown cleaner"}
                                    </div>
                                    <div className="text-[11px] text-foreground/50 truncate">{cp.cleaner?.email ?? ""}</div>
                                    <div className="text-[10px] text-foreground/40 mt-1">Uploaded {formatRelative(cp.uploaded_at)}</div>
                                    {cp.ai_confidence !== null && (
                                        <div className="text-[10px] text-foreground/60 mt-0.5">
                                            AI: <span className="font-bold">{(cp.ai_confidence * 100).toFixed(0)}%</span>
                                            {cp.ai_verified === true && <span className="ml-2 text-emerald-400">Verified</span>}
                                            {cp.ai_verified === false && <span className="ml-2 text-red-400">Failed</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center p-6 cursor-zoom-out"
                >
                    <img src={lightbox} alt="Enlarged" className="max-w-full max-h-full rounded-xl shadow-2xl" />
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Add `Esc`-to-close for the lightbox**

Inside the `EvidenceTab` function body, right after the `useState<string | null>(null)` line, add:

```tsx
useEffect(() => {
    if (!lightbox) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
}, [lightbox]);
```

- [ ] **Step 3: Type-check**

```powershell
cd frontend
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/portal/ReportDetailDrawer.tsx
git commit -m "feat(cenro): Evidence tab with lightbox for ReportDetailDrawer"
```

---

### Task 7: Frontend — fill in the **Work Orders** tab

**Files:**
- Modify: `frontend/components/portal/ReportDetailDrawer.tsx` (`WorkOrdersTab` function)

- [ ] **Step 1: Add pill constants near the existing `STATUS_PILL` map**

Just below the existing `STATUS_PILL` constant, add:

```tsx
const WO_STATUS_PILL: Record<string, string> = {
    assigned: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    in_progress: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
    completed: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    verified: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
    needs_redo: "bg-red-500/15 border-red-500/30 text-red-300",
};

const WO_PRIORITY_PILL: Record<string, string> = {
    low: "bg-foreground/10 border-border text-foreground/50",
    medium: "bg-yellow-500/15 border-yellow-500/30 text-yellow-300",
    high: "bg-red-500/15 border-red-500/30 text-red-300",
};
```

- [ ] **Step 2: Replace the `WorkOrdersTab` placeholder**

Find:
```tsx
function WorkOrdersTab(props: {
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Work Orders tab — pending Task 7." />;
}
```

Replace with:

```tsx
function WorkOrdersTab({ detail, loading, error, onRetry }: {
    detail: ReportDetailPayload | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (loading) return <TabLoading />;
    if (error) return <TabError message={error} onRetry={onRetry} />;

    const workOrders = detail?.work_orders ?? [];
    if (workOrders.length === 0) {
        return <TabEmpty message="No work orders assigned to this report yet." />;
    }

    return (
        <div className="flex flex-col gap-2">
            {workOrders.map((wo) => (
                <div key={wo.id} className="glass-pro rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${WO_PRIORITY_PILL[wo.priority] ?? WO_PRIORITY_PILL.medium}`}>
                                {wo.priority}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${WO_STATUS_PILL[wo.status] ?? WO_STATUS_PILL.assigned}`}>
                                {wo.status.replace("_", " ")}
                            </span>
                        </div>
                        <span className="text-[10px] text-foreground/40 shrink-0">
                            {formatRelative(wo.created_at)}
                        </span>
                    </div>

                    <div className="text-xs text-foreground/80 font-semibold">
                        {wo.assigned_cleaner_name ?? "Unassigned"}
                    </div>
                    {wo.assigned_cleaner_email && (
                        <div className="text-[10px] text-foreground/50">{wo.assigned_cleaner_email}</div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                        <div>
                            <div className="text-foreground/40 uppercase tracking-widest">SLA due</div>
                            <div className="text-foreground/80">{formatDate(wo.sla_deadline)}</div>
                        </div>
                        {wo.started_at && (
                            <div>
                                <div className="text-foreground/40 uppercase tracking-widest">Started</div>
                                <div className="text-foreground/80">{formatRelative(wo.started_at)}</div>
                            </div>
                        )}
                        {wo.completed_at && (
                            <div>
                                <div className="text-foreground/40 uppercase tracking-widest">Completed</div>
                                <div className="text-foreground/80">{formatRelative(wo.completed_at)}</div>
                            </div>
                        )}
                    </div>

                    {wo.notes && (
                        <p className="mt-2 text-[11px] text-foreground/60 leading-relaxed whitespace-pre-wrap">{wo.notes}</p>
                    )}
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

```powershell
cd frontend
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/portal/ReportDetailDrawer.tsx
git commit -m "feat(cenro): Work Orders tab for ReportDetailDrawer"
```

---

### Task 8: Frontend — fill in the **Timeline** tab

**Files:**
- Modify: `frontend/components/portal/ReportDetailDrawer.tsx` (`TimelineTab` function)

- [ ] **Step 1: Replace the `TimelineTab` placeholder**

Find:
```tsx
function TimelineTab(props: {
    entries: AuditEntry[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (props.loading) return <TabLoading />;
    if (props.error) return <TabError message={props.error} onRetry={props.onRetry} />;
    return <TabEmpty message="Timeline tab — pending Task 8." />;
}
```

Replace with:

```tsx
function TimelineTab({ entries, loading, error, onRetry }: {
    entries: AuditEntry[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (loading) return <TabLoading />;
    if (error) return <TabError message={error} onRetry={onRetry} />;
    if (entries.length === 0) {
        return <TabEmpty message="No override actions recorded for this report." />;
    }

    return (
        <div className="flex flex-col gap-2">
            {entries.map((e) => {
                const detailKeys = Object.keys(e.details ?? {});
                return (
                    <div key={e.id} className="glass-pro rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-foreground uppercase tracking-widest">
                                {titleCase(e.action)}
                            </span>
                            <span className="text-[10px] text-foreground/40 shrink-0">
                                {formatRelative(e.created_at)}
                            </span>
                        </div>
                        <div className="text-[11px] text-foreground/60">
                            By <span className="font-semibold text-foreground/80">{e.user_email ?? "System"}</span>
                        </div>
                        {detailKeys.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 gap-0.5">
                                {detailKeys.map((k) => (
                                    <div key={k} className="text-[10px] text-foreground/60">
                                        <span className="text-foreground/40 uppercase tracking-widest mr-1">{k.replace(/_/g, " ")}:</span>
                                        <span className="text-foreground/80 break-all">{String(e.details[k])}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

```powershell
cd frontend
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```powershell
git add frontend/components/portal/ReportDetailDrawer.tsx
git commit -m "feat(cenro): Timeline tab for ReportDetailDrawer"
```

---

### Task 9: Frontend — wire the drawer into `cenro/page.tsx`; drop Action column; make row clickable; delete old modal

**Files:**
- Modify: `frontend/app/cenro/page.tsx`

This is the integration task. It does four things: (a) import the new component, (b) make rows clickable & remove Action column, (c) mount the drawer near the existing `<BarangayDetailDrawer />`, (d) delete the old centered modal JSX.

- [ ] **Step 1: Add the import**

Near the top of the file, in the imports block (search for `BarangayDetailDrawer` or other `@/components/portal/...` imports), add:

```tsx
import { ReportDetailDrawer } from "@/components/portal/ReportDetailDrawer";
```

- [ ] **Step 2: Remove the Action column header**

In [cenro/page.tsx:1306-1314](frontend/app/cenro/page.tsx#L1306-L1314), find:
```tsx
<tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-widest bg-black/20 sticky top-0 z-10">
    <th className="p-4">Tracking ID</th>
    <th className="p-4">Barangay</th>
    <th className="p-4">Status</th>
    <th className="p-4">Open</th>
    <th className="p-4">Date Reported</th>
    <th className="p-4 text-right">Action</th>
</tr>
```

Replace with:
```tsx
<tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-widest bg-black/20 sticky top-0 z-10">
    <th className="p-4">Tracking ID</th>
    <th className="p-4">Barangay</th>
    <th className="p-4">Status</th>
    <th className="p-4">Open</th>
    <th className="p-4">Date Reported</th>
</tr>
```

- [ ] **Step 3: Update skeleton row column count**

In the same area (lines ~1318-1323), find:
```tsx
{queueLoading ? (
    Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
            {Array.from({ length: 6 }).map((__, j) => (
                <td key={j} className="p-4"><div className="h-3 bg-foreground/10 rounded animate-pulse" /></td>
            ))}
        </tr>
    ))
) : displayedQueueReports.length === 0 ? (
    <tr><td colSpan={6} className="p-12 text-center text-foreground/50 font-bold">No reports match the current filters.</td></tr>
```

Replace with (change `6` → `5` in both the skeleton `length` and `colSpan`):
```tsx
{queueLoading ? (
    Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
            {Array.from({ length: 5 }).map((__, j) => (
                <td key={j} className="p-4"><div className="h-3 bg-foreground/10 rounded animate-pulse" /></td>
            ))}
        </tr>
    ))
) : displayedQueueReports.length === 0 ? (
    <tr><td colSpan={5} className="p-12 text-center text-foreground/50 font-bold">No reports match the current filters.</td></tr>
```

- [ ] **Step 4: Make the row clickable & remove Action cell**

In the same map block (lines ~1328-1370), find the entire `<tr>` for a single report row, which ends with the `<td className="p-4 text-right">` wrapping the Oversight button. Replace the whole `<tr>` with:

```tsx
<tr
    key={report.id}
    onClick={() => {
        setSelectedReport(report);
        setNewBarangay(report.barangay ?? "");
    }}
    className="border-b border-border hover:bg-foreground/5 transition-colors cursor-pointer"
>
    <td className="p-4 font-mono text-sm text-foreground font-bold">{report.tracking_id}</td>
    <td className="p-4 text-sm font-bold text-emerald-300">{report.barangay}</td>
    <td className="p-4">
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
            report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
            report.status === 'assigned' ? 'bg-yellow-500/20 text-yellow-400' :
            report.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
            report.status === 'verified' ? 'bg-orange-500/20 text-orange-400' :
            report.status === 'pending' ? 'bg-red-500/20 text-red-400' :
            report.status === 'failed_cleanup' ? 'bg-red-900/30 text-red-400' :
            report.status === 'rejected' ? 'bg-foreground/5 text-foreground/40' :
            'bg-foreground/10 text-foreground'
        }`}>
            {report.status}
        </span>
    </td>
    <td className="p-4">
        {sla ? (
            <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${SLA_PILL_CLASSES[sla.color]}`}>{sla.days}d</span>
        ) : (
            <span className="text-foreground/30 text-sm">—</span>
        )}
    </td>
    <td className="p-4 text-sm text-foreground/60">
        {new Date(report.created_at).toLocaleDateString()}
    </td>
</tr>
```

The Action cell with the Oversight button is gone.

- [ ] **Step 5: Delete the old centered modal**

Find the block at [cenro/page.tsx:1757-1827](frontend/app/cenro/page.tsx#L1757-L1827) — it starts with the comment `{/* Oversight Detail Modal */}` and ends with the matching `)}`. Delete the entire block (the `{selectedReport && ( <div ...> ... </div> )}` JSX).

- [ ] **Step 6: Mount the new drawer**

In the same area where you just deleted the modal (or adjacent — anywhere inside the main JSX return tree, alongside other modals/drawers), insert:

```tsx
<ReportDetailDrawer
    open={selectedReport !== null}
    report={selectedReport}
    barangays={BARANGAYS}
    newBarangay={newBarangay}
    setNewBarangay={setNewBarangay}
    actionLoading={actionLoading}
    onClose={() => setSelectedReport(null)}
    onReassign={() => selectedReport && handleReassign(selectedReport.id)}
    onForceClose={() => selectedReport && handleForceClose(selectedReport.id)}
/>
```

- [ ] **Step 7: Type-check**

```powershell
cd frontend
npx tsc --noEmit
```
Expected: no new errors related to the changes.

- [ ] **Step 8: Visual verification in the dev server**

Start both servers:

Terminal A (backend):
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

Terminal B (frontend):
```powershell
cd frontend
npm run dev
```

Open http://localhost:3000, log in as `cenro@test.com` / `password123`, go to the **Reports** tab (Global Report Queue).

Verify each acceptance criterion:

1. The **Action** column is gone — the rightmost column is now "Date Reported".
2. Hovering over any row shows a `cursor-pointer` and a subtle background change.
3. Clicking any cell (Tracking ID, Barangay, Status, Open, Date Reported) opens the drawer from the right.
4. Drawer header reads `Report EW-XXXX` + status pill + `Barangay · Reported <date>`.
5. **Overview** tab shows Status & IDs, Reporter card (full name + email + phone; or "Anonymous Report" for null reporter_id), Location with Maps link, AI Verification with TrustBadge + confidence %, Notes (if any). The reporter card briefly shows a skeleton while `/reports/{id}/detail` is loading.
6. **Evidence** tab: switching to it reuses the already-fetched `/reports/{id}/detail` payload (no new network request — verify in DevTools). Citizen photo + AI mask render side-by-side. Clicking a photo opens the lightbox; pressing Esc or clicking the backdrop closes it.
7. **Work Orders** tab: shows all WOs for the report or "No work orders assigned…" empty state. Uses the same cached `/reports/{id}/detail` response (no second request when switching from Evidence to Work Orders).
8. **Timeline** tab: triggers a request to `/audit-log?target_id=<id>`. Shows entries scoped to this report only, or empty state.
9. Footer: select dropdown defaults to current barangay, Update Route is disabled until you pick a different one; clicking it calls the reassign handler (toast appears, list refreshes, drawer stays open or closes per existing handler).
10. Force Close button is disabled when status is `resolved`; otherwise clicking it works as before.
11. Closing the drawer (✕, Esc, or backdrop click) returns to the queue unchanged.

- [ ] **Step 9: Commit**

```powershell
git add frontend/app/cenro/page.tsx
git commit -m "feat(cenro): wire ReportDetailDrawer; drop Action column; delete old oversight modal"
```

---

## Self-review checklist (for the implementer)

After all tasks, do a final sweep:

- [ ] No references to "Oversight" button or the old modal remain in `cenro/page.tsx`.
- [ ] `selectedReport`, `newBarangay`, `handleReassign`, `handleForceClose`, `actionLoading` are all still wired (now into the drawer instead of the modal).
- [ ] Esc-to-close works for both the lightbox and the drawer.
- [ ] No new TypeScript errors in `npx tsc --noEmit`.
- [ ] Backend smoke test still passes.
- [ ] No new unused imports remain (lint with `npm run lint` if available).

---

## Notes & follow-ups (intentionally out of scope)

- `ReportDetailDrawer.tsx` ends up ~700 lines with tab subcomponents inlined, mirroring `BarangayDetailDrawer.tsx` (731 lines). If it grows further, extracting each tab to its own file is straightforward — but for now matching the existing pattern keeps everything one file/one read.
- `TabLoading` / `TabError` / `TabEmpty` are duplicated between `BarangayDetailDrawer` and `ReportDetailDrawer`. Extracting them to `frontend/components/portal/_drawer-helpers.tsx` is a cleanup PR, not part of this work.
