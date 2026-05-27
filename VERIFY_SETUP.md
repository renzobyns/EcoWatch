# EcoWatch — Setup Verification Guide

> Run through this after a fresh setup. Two parts:
> 1. **Automated backend smoke test** (5 minutes) — proves every API workflow works
> 2. **Manual UI checklist** (10 minutes) — clicks through every portal tab + the parts the backend test can't see

Total time: ~15 minutes. If anything fails, the section that failed tells you exactly which file to look at.

---

## Part 1 — Automated Backend Smoke Test

**Prerequisites:**
- Backend running (`uvicorn main:app --reload`)
- Database seeded (`python seed_test_data.py`)

**Run it:**

```powershell
cd backend
.\venv_tf\Scripts\Activate.ps1
python smoke_test.py
```

**What it verifies** (41 individual checks across 9 sections):

| Section | What it tests | Why it matters |
|---|---|---|
| 1. Health + Auth | `/health`, login as all 4 quick-demo + 1 per-barangay account, wrong-password rejection | Confirms server is up, all seeded accounts work, bcrypt comparison is correct |
| 2. Ray-Casting | Known Muzon coords → "Muzon"; Dulong Bayan coords → "Dulong Bayan"; Quezon City coords → out-of-SJDM error; `/spatial/barangays` returns all 59 features | `spatial_utils.py` + GeoJSON file are both loading and the point-in-polygon math is correct |
| 3. DBSCAN | `/spatial/heatmaps` returns hotspot clusters; at least one centered near Muzon's seeded report cluster | `analytics.py` clustering + the eps/min_samples params are tuned to find the Muzon hotspot |
| 4. Report Submit | Posts a real image to `/report/submit`, polls until AI verification completes (≤30s), confirms tracking ID format, ray-cast result, ai_confidence in [0,1], file written to `uploads/`, final status is verified or rejected | **End-to-end pipeline**: image upload → Mask R-CNN inference → spatial routing → DB persistence → tracking lookup. All happens in one test. |
| 5. Public Tracking | `/report/track/{slug}` returns the submitted report | Public tracking page data source works |
| 6. RBAC | Mutation endpoint without auth → 401; citizen calling barangay-only endpoint → 403; audit log gated to CENRO only | Role enforcement on the privileged endpoints |
| 7. Cross-Portal | New report appears in both Muzon barangay queue AND CENRO city-wide feed (probing both default + `?status=rejected` in case AI rejected the test image) | Same data is reflected across all portals — the whole "report flows from citizen → barangay → CENRO" promise |
| 8. Work Orders | Cleaner's queue returns the seeded 3 WOs with correct statuses (assigned / in_progress / needs_redo); notifications endpoint responds | Cleaner workflow data is wired up |
| 9. Mask R-CNN Mode | Detects whether `mask_rcnn_garbage.h5` is on disk → reports MOCK vs REAL mode | Tester knows whether the AI verdicts in section 4 came from the real model or the mock |

**Expected output:**

```
SUMMARY
  Passed: 41
  Failed: 0

All workflows verified. The setup is good to go.
```

Anything red? Read the FAIL line — it gives you the endpoint, status code, and response body so you know exactly where to look.

---

## Part 2 — Manual UI Checklist

The smoke test can't see the browser. These are the things you have to click through yourself. Each box should take ~10 seconds.

**Prerequisites:**
- Backend running on `:8000`
- Frontend running on `:3000` (`cd frontend && npm run dev`)
- Smoke test passed

### Public / Citizen Flow

- [ ] Open `http://localhost:3000` — landing page loads, full-screen map renders
- [ ] Map shows 59 barangay polygon outlines (zoom into SJDM to see them)
- [ ] Report pins are visible on the map (colored by status: red/yellow/green)
- [ ] Click a pin → popup shows tracking ID + photo + status + "View" link
- [ ] Click "Share QR Code" → modal opens, QR image renders, "Save Image" downloads
- [ ] Navigate to `/report` → form renders, asks for GPS permission
- [ ] After allowing GPS, drop a pin on the map or use detected location
- [ ] Upload a photo (any JPG/PNG ≤10 MB) + add a note → click Submit
- [ ] Redirected to `/track/<slug>` → page shows your tracking ID, status, timeline
- [ ] Refresh after ~10 seconds → status updated (pending → verified or rejected)

### Barangay Portal (login as `barangay@test.com` / `password123`)

- [ ] Login redirects to `/barangay`
- [ ] Top bar shows: notification bell, profile dropdown, dark/light toggle
- [ ] Notification bell shows a number badge if there are unread notifications
- [ ] **Dashboard tab** (or main view): KPI cards render (pending count, deployed count, resolved count)
- [ ] Recent reports list appears with SLA badges (green ≤2d, yellow 3–4d, red ≥5d)
- [ ] Right-side map shows ONLY Muzon's polygon highlighted with Muzon's pins
- [ ] **Reports tab**: filter bar (status / search / date range) is visible
- [ ] Search debounces (~300ms) — typing doesn't fire an API call on every keystroke (check Network tab in DevTools)
- [ ] Click a `verified` report → drawer opens with photo + AI mask + assign-cleaner form
- [ ] Select a cleaner from dropdown + priority + click "Assign" → toast confirms, status flips to `assigned`
- [ ] Switch to the report's row → status pill shows `Assigned` and cleaner name appears
- [ ] Click "Export CSV" → file downloads with only Muzon's reports
- [ ] **My Team tab** (or equivalent): list of cleaners assigned to Muzon, with status

### Cleaner Portal (login as `cleaner@test.com` / `password123`)

- [ ] Login redirects to `/cleaner`
- [ ] **Dashboard tab**: shows summary stats for assigned work orders
- [ ] **Jobs tab**: shows 3 seeded WOs (one assigned, one in-progress, one needs-redo) — or whatever the barangay portal assigned in the previous step
- [ ] Click an `assigned` job → drawer opens with report photo + location map + Start button
- [ ] Click "Start" → status flips to `in_progress` + toast confirms
- [ ] Upload an "after cleanup" photo + click "Complete" → AI runs (~10s) → status flips to `resolved` or `needs_redo`
- [ ] **History tab**: completed jobs show in chronological list
- [ ] **Map tab**: assigned job pins are visible on map

### CENRO Portal (login as `cenro@test.com` / `password123`)

- [ ] Login redirects to `/cenro`
- [ ] **Dashboard tab**: KPI cards (Total Reports, Active, Deployed, Success Rate) render with numbers
- [ ] SLA Breaches widget appears with count (red if >0, green if 0)
- [ ] Today's Snapshot row shows New / Deployed / Resolved counts
- [ ] Barangay Rankings panel shows top 5
- [ ] Live City Feed panel shows recent reports
- [ ] **City Map tab**: full-screen map renders, shows ALL barangays' pins + heatmap circles
- [ ] Click a barangay polygon → zooms in + filters to that barangay
- [ ] **Reports tab**: filter bar (status / barangay dropdown / date / search) + report table
- [ ] Click a report row → ReportDetailDrawer opens with Overview / Evidence / Work Orders / Timeline tabs — all four tabs render with data
- [ ] Click "Reassign" → modal asks for new barangay + reason → submit → audit log gets the entry
- [ ] Click "Force Close" → modal asks for reason → submit → status flips to `resolved`
- [ ] **SLA Management tab**: Breach Monitor sub-tab lists overdue reports; Configuration sub-tab shows current SLA thresholds (editable)
- [ ] **Analytics tab**: date range picker + summary cards + trend line chart + barangay bar chart all render
- [ ] **Barangay Management tab**: table of all 59 barangays with stats; clicking a row opens drawer
- [ ] **Evidence Gallery tab**: photo grid renders, "Original / AI Detection / Cleanup Proof" thumbnails
- [ ] **Audit Log tab**: table of recent override actions (reassign, force-close, user mgmt)
- [ ] **Accounts tab**: user list, "+ Add Account" works, "Disable" button toggles status

### Cross-Portal Reflection (the most important workflow check)

- [ ] Submit a new report as anonymous citizen (Muzon GPS) → note the tracking ID
- [ ] Switch to Barangay portal (`barangay@test.com`) → that exact tracking ID appears in Muzon's queue
- [ ] Assign a cleaner to that report
- [ ] Switch to Cleaner portal (`cleaner@test.com`) → the new job appears in their Jobs tab
- [ ] Complete the cleanup with an after-photo
- [ ] Switch to Barangay portal → status now shows `resolved` (or `needs_redo`)
- [ ] Switch to CENRO portal → the report appears in Reports tab with final status; Audit Log shows the assignment + completion events

If all four boxes tick, the entire data flow is wired correctly across all portals.

---

## When something fails

| Symptom | Where to look |
|---|---|
| Smoke test section 1 fails (auth/login) | Did you run `python seed_test_data.py`? Is the backend on port 8000? |
| Section 2 fails (ray-casting) | Is `data/sjdm_barangays.geojson` present? Check `spatial_utils.py:6` for the path. |
| Section 3 fails (DBSCAN) | Did the seed run? `analytics.py` filter excludes RESOLVED + REJECTED — seed should have non-resolved reports. |
| Section 4 fails (AI verification timeout) | Mask R-CNN is loading slowly. Check `uvicorn` logs for either "Model loaded" or "Model not found". Retry — first run on a cold model can be 60s+. |
| Section 6 fails (RBAC) | Auth dependency in `main.py:323` or `require_role()` at `main.py:339` may have broken. |
| UI: portal redirects to home instead of opening | LocalStorage `ecowatch_user` is empty/corrupt. Clear it (DevTools → Application → Local Storage) and log in again. |
| UI: map doesn't render | Check browser console for Leaflet errors. The `NEXT_PUBLIC_API_URL` may be wrong — backend should be reachable at the URL the frontend is hitting. |
| UI: report submit gives "Network error" | Backend not running, CORS blocking, or wrong API URL. Check Network tab. |

---

## What this verification does NOT check

- **Real Mask R-CNN accuracy** — smoke test confirms the pipeline runs, but a tester would need labeled test images to verify accuracy.
- **Production deployment** — this is local-dev verification. Supabase + Railway + Vercel deployment has its own checklist in [`DEFENSE_PLAN.md`](DEFENSE_PLAN.md) §6.
- **Load testing** — single-user only. Not concurrent.
- **Mobile responsiveness** — UI checklist is desktop. Test on a phone separately if it matters.
