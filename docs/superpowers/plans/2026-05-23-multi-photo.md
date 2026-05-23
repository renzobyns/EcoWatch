# Multi-Photo Reports & Cleanup Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow citizens to upload 1–5 evidence photos per report and cleaners/barangay to upload 1–5 cleanup proof photos; AI runs ANY-wins aggregation across all photos in the batch.

**Architecture:** Two new SQLAlchemy tables (`report_photos`, `cleanup_photos`) store multi-photo rows. Three background tasks are updated to query these tables instead of single `image_url` columns. Old single-photo records are backfilled by a startup migration. Existing columns (`image_url`, `cleanup_image_url`) are kept for backward compatibility and populated with the first photo.

**Tech Stack:** FastAPI (Python), SQLAlchemy (SQLite/PostgreSQL), Next.js 16 / React 19 / TypeScript / Tailwind v4

---

## File Map

| File | Change |
|------|--------|
| `backend/models.py` | Add `ReportPhoto` and `CleanupPhoto` ORM classes; add relationships on `Report` |
| `backend/main.py` | Add startup migration; update `ReportResponse`; update 3 endpoints + 3 BG tasks + track endpoint |
| `frontend/app/report/page.tsx` | Multi-file picker + preview strip; update FormData key |
| `frontend/components/portal/CleanerJobDrawer.tsx` | Multi-file picker; update `onComplete` prop signature |
| `frontend/app/cleaner/page.tsx` | Update `handleComplete` signature; update FormData loop |
| `frontend/app/track/[id]/page.tsx` | Render `photos` array when present |

---

## Task 1 — Add ORM models to `backend/models.py`

**Files:**
- Modify: `backend/models.py:89-90` (Report's work_orders relationship)
- Modify: `backend/models.py:157` (end of file — add after last class)

- [ ] **Step 1: Add `report_photos` and `cleanup_photos` relationships to `Report`**

In `backend/models.py`, find lines 88–89 (the `work_orders` relationship on `Report`) and add two more relationship lines directly after:

```python
    # Work orders (one Report can have multiple work orders if a cleanup fails and is re-dispatched)
    work_orders = relationship("WorkOrder", back_populates="report", cascade="all, delete-orphan")
    report_photos = relationship("ReportPhoto", back_populates="report", cascade="all, delete-orphan")
    cleanup_photos = relationship("CleanupPhoto", back_populates="report", cascade="all, delete-orphan")
```

- [ ] **Step 2: Append two new model classes at end of `backend/models.py`**

Add after line 157 (the last line of `Notification`):

```python


class ReportPhoto(Base):
    """One row per evidence photo uploaded by a citizen for a report."""
    __tablename__ = "report_photos"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    ai_confidence = Column(Float, nullable=True)
    ai_verified = Column(Boolean, nullable=True)
    ai_mask_path = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("Report", back_populates="report_photos")


class CleanupPhoto(Base):
    """One row per cleanup proof photo. work_order_id is null for direct barangay resolves."""
    __tablename__ = "cleanup_photos"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True, index=True)
    file_path = Column(String, nullable=False)
    ai_confidence = Column(Float, nullable=True)
    ai_verified = Column(Boolean, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("Report", back_populates="cleanup_photos")
```

- [ ] **Step 3: Verify syntax**

```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\backend"
.\venv\Scripts\python.exe -m py_compile models.py && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/models.py
git commit -m "feat(models): add ReportPhoto and CleanupPhoto tables"
```

---

## Task 2 — Add startup migration in `backend/main.py`

**Files:**
- Modify: `backend/main.py:63-76` (after `_seed_sla_config_defaults` definition and call)

The new tables are created automatically by `models.Base.metadata.create_all(bind=engine)` (line 44) since they are brand-new tables. No ALTER TABLE is needed. But old records have no `report_photos` rows — this migration backfills them.

- [ ] **Step 1: Add `_migrate_single_photos_to_tables` function**

Insert the following function definition **after line 76** (the `_seed_sla_config_defaults()` call), before `_log_orphan_pending_verifications`:

```python

def _migrate_single_photos_to_tables() -> None:
    """Backfill legacy single image_url / cleanup_image_url into new photo tables. Idempotent."""
    db = SessionLocal()
    try:
        # Evidence photos
        for report in db.query(models.Report).filter(models.Report.image_url.isnot(None)).all():
            exists = db.query(models.ReportPhoto).filter(
                models.ReportPhoto.report_id == report.id
            ).first()
            if not exists:
                db.add(models.ReportPhoto(
                    report_id=report.id,
                    file_path=report.image_url,
                    ai_confidence=report.ai_confidence,
                    ai_verified=(report.ai_confidence >= 0.5)
                        if report.ai_confidence is not None else None,
                    ai_mask_path=report.ai_mask_url,
                ))

        # Cleanup photos
        for report in db.query(models.Report).filter(models.Report.cleanup_image_url.isnot(None)).all():
            exists = db.query(models.CleanupPhoto).filter(
                models.CleanupPhoto.report_id == report.id
            ).first()
            if not exists:
                wo = (
                    db.query(models.WorkOrder)
                    .filter(models.WorkOrder.report_id == report.id)
                    .order_by(models.WorkOrder.created_at.desc())
                    .first()
                )
                db.add(models.CleanupPhoto(
                    report_id=report.id,
                    work_order_id=wo.id if wo else None,
                    file_path=report.cleanup_image_url,
                ))
        db.commit()
    except Exception:
        logger.exception("Startup migration: photo backfill failed")
        db.rollback()
    finally:
        db.close()


_migrate_single_photos_to_tables()

```

- [ ] **Step 2: Verify syntax**

```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\backend"
.\venv\Scripts\python.exe -m py_compile main.py && echo OK
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(main): startup migration backfills photo tables from legacy columns"
```

---

## Task 3 — Update `ReportResponse` and `GET /report/track/{tracking_slug}`

**Files:**
- Modify: `backend/main.py:226-247` (ReportResponse class)
- Modify: `backend/main.py:1376-1392` (track_report endpoint)

- [ ] **Step 1: Add `photos` field to `ReportResponse`**

In `backend/main.py`, find `ReportResponse` (line 226). Add `photos: List[dict] = []` as the last field before `class Config`:

```python
class ReportResponse(BaseModel):
    id: int
    lat: float
    lon: float
    barangay: Optional[str] = None
    reporter_id: Optional[int] = None
    image_url: Optional[str] = None
    ai_mask_url: Optional[str] = None
    cleanup_image_url: Optional[str] = None
    ai_confidence: Optional[float] = None
    status: str
    notes: Optional[str] = None
    deployment_notes: Optional[str] = None
    tracking_id: Optional[str] = None
    tracking_url: Optional[str] = None
    created_at: datetime
    deployed_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    verification_pending: bool = False
    photos: List[dict] = []

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Update `track_report` to populate `photos`**

Replace lines 1376–1392 (the entire `track_report` function):

```python
@app.get("/report/track/{tracking_slug}")
async def track_report(tracking_slug: str, db: Session = Depends(get_db)):
    """Get report status by tracking slug (public, no auth needed)."""
    report = db.query(models.Report).filter(
        models.Report.tracking_url == f"/track/{tracking_slug}"
    ).first()

    if not report:
        report = db.query(models.Report).filter(
            models.Report.tracking_id == tracking_slug
        ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    response = ReportResponse.model_validate(report)
    photo_rows = db.query(models.ReportPhoto).filter(
        models.ReportPhoto.report_id == report.id
    ).all()
    response.photos = [
        {
            "url": p.file_path,
            "ai_confidence": p.ai_confidence,
            "ai_verified": p.ai_verified,
        }
        for p in photo_rows
    ]
    return response
```

- [ ] **Step 3: Verify syntax**

```powershell
.\venv\Scripts\python.exe -m py_compile main.py && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(api): add photos array to track response"
```

---

## Task 4 — Update `_bg_verify_submit` and `POST /report/submit`

**Files:**
- Modify: `backend/main.py:1127-1171` (`_bg_verify_submit`)
- Modify: `backend/main.py:1313-1369` (`submit_report` endpoint)

- [ ] **Step 1: Replace `_bg_verify_submit` (lines 1127–1171)**

```python
async def _bg_verify_submit(report_id: int) -> None:
    """Background task: run Mask R-CNN on all evidence photos for a freshly-submitted report."""
    db = SessionLocal()
    try:
        report = db.query(models.Report).filter(models.Report.id == report_id).first()
        if not report:
            logger.warning("BG submit verify: report %s missing", report_id)
            return

        photo_rows = db.query(models.ReportPhoto).filter(
            models.ReportPhoto.report_id == report_id,
            models.ReportPhoto.ai_verified.is_(None),
        ).all()

        # Build list of (raw_bytes, db_row_or_None) pairs; skip missing files
        pairs: list[tuple[bytes, object]] = []
        if photo_rows:
            for row in photo_rows:
                try:
                    with open(_disk_path_for_upload_url(row.file_path), "rb") as f:
                        pairs.append((f.read(), row))
                except FileNotFoundError:
                    logger.warning("BG submit: missing file %s for report %s", row.file_path, report_id)
        elif report.image_url:
            # Legacy record — no photo table rows; fall back to image_url
            try:
                with open(_disk_path_for_upload_url(report.image_url), "rb") as f:
                    pairs.append((f.read(), None))
            except FileNotFoundError:
                logger.exception("BG submit: legacy image missing for report %s", report_id)

        if not pairs:
            report.status = models.ReportStatus.REJECTED
            report.verification_pending = False
            report.verification_kind = None
            db.commit()
            return

        results = await verify_images_async([b for b, _ in pairs])

        # ANY-wins: if any photo passes the threshold, the report is verified
        any_verified = any(r.get("verified") for r in results)
        best = max(results, key=lambda r: r.get("confidence", 0.0))

        # Update individual photo rows with per-photo AI results
        for (_, row), result in zip(pairs, results):
            if row is not None:
                row.ai_confidence = result.get("confidence")
                row.ai_verified = bool(result.get("verified", False))
                if result.get("verified") and result.get("mask_bytes"):
                    row.ai_mask_path = _save_mask_bytes(result.get("mask_bytes"))

        # Update report aggregate: use best passing result's mask (or best overall if none pass)
        report.ai_confidence = best.get("confidence")
        if any_verified:
            report.status = models.ReportStatus.VERIFIED
            passing = [
                (r, row)
                for r, (_, row) in zip(results, pairs)
                if r.get("verified")
            ]
            best_pass_result = max(passing, key=lambda x: x[0].get("confidence", 0.0))[0]
            report.ai_mask_url = _save_mask_bytes(best_pass_result.get("mask_bytes"))
        else:
            report.status = models.ReportStatus.REJECTED

        report.verification_pending = False
        report.verification_kind = None

        if report.reporter_id:
            emit_notification(
                db, report.reporter_id,
                "verified" if report.status == models.ReportStatus.VERIFIED else "rejected",
                f"Report {report.tracking_id} {report.status}",
                "AI verification complete." if report.status == models.ReportStatus.VERIFIED
                else "AI did not detect waste in the photo.",
                report_id=report.id,
            )
        db.commit()
    except Exception:
        logger.exception("BG submit verify failed for report %s", report_id)
        db.rollback()
    finally:
        db.close()
```

- [ ] **Step 2: Replace `submit_report` endpoint (lines 1313–1369)**

```python
@app.post("/report/submit", status_code=202)
async def submit_report(
    background_tasks: BackgroundTasks,
    lat: float = Form(...),
    lon: float = Form(...),
    notes: Optional[str] = Form(None),
    reporter_id: Optional[int] = Form(None),
    images: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """
    Citizen report submission. Accepts 1–5 evidence photos.
    Returns 202 immediately; Mask R-CNN runs in a background task.
    Frontend polls /report/track/{slug} until `verification_pending` flips to false.
    """
    if not (1 <= len(images) <= 5):
        raise HTTPException(status_code=422, detail="Upload between 1 and 5 photos.")

    # Save each photo; skip bad files but proceed if at least one succeeds
    saved_urls: list[str] = []
    for img in images:
        try:
            img_bytes = await img.read()
            url = await save_upload(img, prefix="report", contents=img_bytes)
            saved_urls.append(url)
        except HTTPException:
            pass  # skip invalid file; continue with the rest

    if not saved_urls:
        raise HTTPException(status_code=422, detail="No photos could be saved. Please try again.")

    spatial_result = spatial_utils.get_barangay_from_coords(lat, lon)
    barangay = spatial_result.get("barangay") if "error" not in spatial_result else "Unknown"

    tracking_id = generate_tracking_id(db)
    tracking_slug = generate_tracking_slug()
    tracking_url = f"/track/{tracking_slug}"

    new_report = models.Report(
        lat=lat,
        lon=lon,
        barangay=barangay,
        reporter_id=reporter_id,
        image_url=saved_urls[0],  # backward compat: first photo
        status=models.ReportStatus.PENDING,
        notes=notes,
        tracking_id=tracking_id,
        tracking_url=tracking_url,
        verification_pending=True,
        verification_kind="submit",
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    for url in saved_urls:
        db.add(models.ReportPhoto(report_id=new_report.id, file_path=url))
    db.commit()

    background_tasks.add_task(_bg_verify_submit, new_report.id)

    return {
        "success": True,
        "message": "Report received. AI verification is running in the background.",
        "report_id": new_report.id,
        "tracking_id": tracking_id,
        "tracking_url": tracking_url,
        "barangay_assigned": barangay,
        "status": new_report.status,
        "verification_pending": True,
    }
```

- [ ] **Step 3: Verify syntax**

```powershell
.\venv\Scripts\python.exe -m py_compile main.py && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(api): multi-photo submit — accept 1-5 images, ANY-wins AI aggregation"
```

---

## Task 5 — Update `_bg_verify_resolve` and `POST /report/{id}/resolve`

**Files:**
- Modify: `backend/main.py:1174-1211` (`_bg_verify_resolve`)
- Modify: `backend/main.py:1640-1681` (`resolve_report` endpoint)

- [ ] **Step 1: Replace `_bg_verify_resolve` (lines 1174–1211)**

```python
async def _bg_verify_resolve(report_id: int, user_id: int) -> None:
    """Background task: AI re-verifies barangay-uploaded cleanup photos.
    Inverted logic: AI detecting waste = cleanup FAILED."""
    db = SessionLocal()
    try:
        report = db.query(models.Report).filter(models.Report.id == report_id).first()
        if not report:
            return

        cleanup_rows = db.query(models.CleanupPhoto).filter(
            models.CleanupPhoto.report_id == report_id,
            models.CleanupPhoto.work_order_id.is_(None),
            models.CleanupPhoto.ai_verified.is_(None),
        ).all()

        pairs: list[tuple[bytes, object]] = []
        if cleanup_rows:
            for row in cleanup_rows:
                try:
                    with open(_disk_path_for_upload_url(row.file_path), "rb") as f:
                        pairs.append((f.read(), row))
                except FileNotFoundError:
                    logger.warning("BG resolve: missing file %s", row.file_path)
        elif report.cleanup_image_url:
            try:
                with open(_disk_path_for_upload_url(report.cleanup_image_url), "rb") as f:
                    pairs.append((f.read(), None))
            except FileNotFoundError:
                logger.exception("BG resolve: legacy cleanup image missing for report %s", report_id)

        if not pairs:
            report.verification_pending = False
            report.verification_kind = None
            db.commit()
            return

        results = await verify_images_async([b for b, _ in pairs])
        # ANY photo still showing waste = cleanup failed
        any_waste_detected = any(r.get("verified") for r in results)

        for (_, row), result in zip(pairs, results):
            if row is not None:
                row.ai_confidence = result.get("confidence")
                row.ai_verified = bool(result.get("verified", False))

        if any_waste_detected:
            report.status = models.ReportStatus.FAILED_CLEANUP
        else:
            report.status = models.ReportStatus.RESOLVED
            report.resolved_at = datetime.utcnow()
        report.verification_pending = False
        report.verification_kind = None

        write_audit(db, user_id, "resolve", report.id, {
            "tracking_id": report.tracking_id,
            "outcome": report.status,
        })
        db.commit()
    except Exception:
        logger.exception("BG resolve verify failed for report %s", report_id)
        db.rollback()
    finally:
        db.close()
```

- [ ] **Step 2: Replace `resolve_report` endpoint (lines 1640–1681)**

```python
@app.post("/report/{report_id}/resolve", status_code=202)
async def resolve_report(
    report_id: int,
    background_tasks: BackgroundTasks,
    cleanup_images: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("barangay")),
):
    """
    Barangay uploads cleanup photos (1–5). AI runs in background.
    Returns 202 immediately; frontend polls the report until
    `verification_pending` flips to false to see RESOLVED / FAILED_CLEANUP.
    """
    if not (1 <= len(cleanup_images) <= 5):
        raise HTTPException(status_code=422, detail="Upload between 1 and 5 photos.")

    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != models.ReportStatus.DEPLOYED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resolve. Report status is '{report.status}', must be 'deployed'."
        )

    saved_urls: list[str] = []
    for img in cleanup_images:
        try:
            img_bytes = await img.read()
            url = await save_upload(img, prefix="cleanup", contents=img_bytes)
            saved_urls.append(url)
        except HTTPException:
            pass

    if not saved_urls:
        raise HTTPException(status_code=422, detail="No photos could be saved. Please try again.")

    report.cleanup_image_url = saved_urls[0]  # backward compat
    report.verification_pending = True
    report.verification_kind = "resolve"
    db.commit()

    for url in saved_urls:
        db.add(models.CleanupPhoto(
            report_id=report.id,
            work_order_id=None,
            file_path=url,
        ))
    db.commit()
    db.refresh(report)

    background_tasks.add_task(_bg_verify_resolve, report.id, user.id)

    return {
        "success": True,
        "message": f"Cleanup photo received for {report.tracking_id}. AI verification running.",
        "status": report.status,
        "verification_pending": True,
        "report": ReportResponse.model_validate(report),
    }
```

- [ ] **Step 3: Verify syntax**

```powershell
.\venv\Scripts\python.exe -m py_compile main.py && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(api): multi-photo barangay resolve — accept 1-5 cleanup images"
```

---

## Task 6 — Update `_bg_verify_complete` and `PUT /work-orders/{id}/complete`

**Files:**
- Modify: `backend/main.py:1214-1267` (`_bg_verify_complete`)
- Modify: `backend/main.py:1848-1897` (`complete_work_order` endpoint)

- [ ] **Step 1: Replace `_bg_verify_complete` (lines 1214–1267)**

```python
async def _bg_verify_complete(work_order_id: int, user_id: int) -> None:
    """Background task: AI re-verifies cleaner-uploaded cleanup photos on a WO.
    Inverted logic: AI detecting waste = cleanup FAILED."""
    db = SessionLocal()
    try:
        wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
        if not wo or not wo.report:
            logger.warning("BG complete verify: work order %s missing context", work_order_id)
            return
        report = wo.report

        cleanup_rows = db.query(models.CleanupPhoto).filter(
            models.CleanupPhoto.work_order_id == work_order_id,
            models.CleanupPhoto.ai_verified.is_(None),
        ).all()

        pairs: list[tuple[bytes, object]] = []
        if cleanup_rows:
            for row in cleanup_rows:
                try:
                    with open(_disk_path_for_upload_url(row.file_path), "rb") as f:
                        pairs.append((f.read(), row))
                except FileNotFoundError:
                    logger.warning("BG complete: missing file %s", row.file_path)
        elif report.cleanup_image_url:
            try:
                with open(_disk_path_for_upload_url(report.cleanup_image_url), "rb") as f:
                    pairs.append((f.read(), None))
            except FileNotFoundError:
                logger.exception("BG complete: legacy cleanup image missing for WO %s", work_order_id)

        if not pairs:
            report.verification_pending = False
            report.verification_kind = None
            db.commit()
            return

        results = await verify_images_async([b for b, _ in pairs])
        any_waste_detected = any(r.get("verified") for r in results)

        for (_, row), result in zip(pairs, results):
            if row is not None:
                row.ai_confidence = result.get("confidence")
                row.ai_verified = bool(result.get("verified", False))

        if any_waste_detected:
            wo.status = models.WorkOrderStatus.NEEDS_REDO
            report.status = models.ReportStatus.FAILED_CLEANUP
            emit_notification(
                db, wo.assigned_cleaner_id, "needs_redo",
                f"Cleanup needs redo: {report.tracking_id}",
                "AI still detected waste. Please clean more thoroughly and try again.",
                work_order_id=wo.id, report_id=report.id,
            )
        else:
            wo.status = models.WorkOrderStatus.VERIFIED
            report.status = models.ReportStatus.RESOLVED
            report.resolved_at = datetime.utcnow()
            emit_notification(
                db, wo.assigned_cleaner_id, "verified",
                f"Job verified: {report.tracking_id}",
                "AI confirmed cleanup. Thank you!",
                work_order_id=wo.id, report_id=report.id,
            )
        report.verification_pending = False
        report.verification_kind = None

        write_audit(db, user_id, "complete_work_order", report.id, {
            "work_order_id": wo.id,
            "tracking_id": report.tracking_id,
            "outcome": wo.status,
        })
        db.commit()
    except Exception:
        logger.exception("BG complete verify failed for WO %s", work_order_id)
        db.rollback()
    finally:
        db.close()
```

- [ ] **Step 2: Replace `complete_work_order` endpoint (lines 1848–1897)**

```python
@app.put("/work-orders/{work_order_id}/complete", status_code=202)
async def complete_work_order(
    work_order_id: int,
    background_tasks: BackgroundTasks,
    cleanup_images: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("cleaner")),
):
    """
    Cleaner uploads cleanup photos (1–5). AI runs in background.
    Returns 202 immediately; WO stays IN_PROGRESS with `report_verification_pending=true`
    until the BG task flips it to VERIFIED or NEEDS_REDO.
    """
    if not (1 <= len(cleanup_images) <= 5):
        raise HTTPException(status_code=422, detail="Upload between 1 and 5 photos.")

    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.assigned_cleaner_id != user.id:
        raise HTTPException(status_code=403, detail="Can only complete your own work orders")

    if wo.status != models.WorkOrderStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete. Status is '{wo.status}', must be 'in_progress'."
        )

    report = wo.report
    if not report:
        raise HTTPException(status_code=404, detail="Associated report not found")

    saved_urls: list[str] = []
    for img in cleanup_images:
        try:
            img_bytes = await img.read()
            url = await save_upload(img, prefix="cleanup", contents=img_bytes)
            saved_urls.append(url)
        except HTTPException:
            pass

    if not saved_urls:
        raise HTTPException(status_code=422, detail="No photos could be saved. Please try again.")

    report.cleanup_image_url = saved_urls[0]  # backward compat
    report.verification_pending = True
    report.verification_kind = "complete"
    wo.completed_at = datetime.utcnow()
    db.commit()

    for url in saved_urls:
        db.add(models.CleanupPhoto(
            report_id=report.id,
            work_order_id=wo.id,
            file_path=url,
        ))
    db.commit()
    db.refresh(wo)
    db.refresh(report)

    background_tasks.add_task(_bg_verify_complete, wo.id, user.id)

    return {
        "success": True,
        "message": f"Cleanup photo received for {report.tracking_id}. AI verification running.",
        "verification_pending": True,
        "work_order": serialize_work_order(wo),
    }
```

- [ ] **Step 3: Verify syntax**

```powershell
.\venv\Scripts\python.exe -m py_compile main.py && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(api): multi-photo cleaner complete — accept 1-5 cleanup images"
```

---

## Task 7 — Smoke test the backend

- [ ] **Step 1: Start the backend**

```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\backend"
.\venv\Scripts\uvicorn.exe main:app --reload --port 8765
```

Watch for startup output: no Python exceptions. Tables `report_photos` and `cleanup_photos` should be mentioned in SQLAlchemy's create_all output (or silently created if they already exist).

- [ ] **Step 2: Submit a single-photo report (backward compat)**

Open a new terminal and run:

```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\backend"
$boundary = "----FormBoundary$(New-Guid)"
# Create a minimal valid JPEG in memory
$jpegHex = "FFD8FFE000104A46494600010100000100010000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30313434341F27393D38323C2E333432FFDB0043010909090C0B0C180D0D1832211C213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232FFC00011080001000103012200021101031101FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFC400B5100002010303020403050504040000017D01020300041105122131410613516107227114328191A1082342B1C11552D1F02433627282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A737475767778797A838485868788898A929394959697989990A2A3A4A5A6A7A8A9AAABACADAEAFB2B3B4B5B6B7B8B9BABBBCBDBEBFC2C3C4C5C6C7C8C9CACBCCCDCECFD2D3D4D5D6D7D8D9DADBE2E3E4E5E6E7E8E9EAEBECEDEEEFF2F3F4F5F6F7F8F9FAFBFCFDFEFF"
$jpegBytes = [byte[]] ($jpegHex -split '(..)' -ne '' | ForEach-Object { [Convert]::ToByte($_, 16) })
[System.IO.File]::WriteAllBytes("$env:TEMP\test.jpg", $jpegBytes)

# Submit with 1 photo
$resp = Invoke-WebRequest -Uri "http://127.0.0.1:8765/report/submit" -Method POST -Form @{
    lat = "14.83"
    lon = "121.04"
    images = Get-Item "$env:TEMP\test.jpg"
} -ContentType "multipart/form-data"
$resp.StatusCode  # expect 202
($resp.Content | ConvertFrom-Json).tracking_url  # expect /track/...
```

Expected: status 202, JSON with `tracking_url`.

- [ ] **Step 3: Submit with 2 photos**

```powershell
# Reuse the same test.jpg for both slots — just submit same file twice
$resp2 = Invoke-WebRequest -Uri "http://127.0.0.1:8765/report/submit" -Method POST -ContentType "multipart/form-data; boundary=testboundary" -Body (
    "--testboundary`r`nContent-Disposition: form-data; name=`"lat`"`r`n`r`n14.83`r`n" +
    "--testboundary`r`nContent-Disposition: form-data; name=`"lon`"`r`n`r`n121.04`r`n" +
    "--testboundary--"
)
```

**Alternative simpler test:** Open `http://127.0.0.1:8765/docs` in the browser → try `POST /report/submit` with 2 files attached. Confirm 202 and that `report_photos` has 2 rows (check with SQLite viewer or add a `/debug` endpoint temporarily).

- [ ] **Step 4: Confirm DB rows**

```powershell
.\venv\Scripts\python.exe -c "
from database import SessionLocal
from models import ReportPhoto
db = SessionLocal()
rows = db.query(ReportPhoto).all()
for r in rows:
    print(r.report_id, r.file_path, r.ai_verified)
db.close()
"
```
Expected: rows appear for any test submissions.

---

## Task 8 — Frontend: `frontend/app/report/page.tsx` (multi-file picker)

**Files:**
- Modify: `frontend/app/report/page.tsx`

Context: current file uses `image: File | null` state, single `<input type="file">`, and `formData.append("image", image)`.

- [ ] **Step 1: Replace state declarations (lines 36–37)**

Replace:
```typescript
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
```
With:
```typescript
    const [images, setImages] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
```

- [ ] **Step 2: Replace `handleImageChange` (lines 45–52)**

Replace:
```typescript
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setError(null);
        }
    };
```
With:
```typescript
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        const total = images.length + files.length;
        if (total > 5) {
            setError("Maximum 5 photos allowed.");
            return;
        }
        setImages((prev) => [...prev, ...files]);
        setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
        setError(null);
        e.target.value = "";  // reset input so same file can be re-added after removal
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    };
```

- [ ] **Step 3: Update `handleSubmit` guard (line 57)**

Replace:
```typescript
        if (!lat || !lon || !image) {
```
With:
```typescript
        if (!lat || !lon || images.length === 0) {
```

- [ ] **Step 4: Update FormData (around lines 68–69)**

Replace:
```typescript
        formData.append("image", image);
```
With:
```typescript
        images.forEach((img) => formData.append("images", img));
```

- [ ] **Step 5: Replace Step 2 camera UI (lines 176–218)**

Replace the entire `step === 2` block content (the inner `<div className="animate-in ...">` block, keeping outer braces) with:

```tsx
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-md shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-1.5">Capture Evidence</h2>
                        <p className="text-sm text-foreground/60 font-medium mb-5">
                            Take up to 5 clear photos of the illegal waste. Our AI will verify before submission.
                        </p>

                        {/* Photo strip */}
                        {previewUrls.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                                {previewUrls.map((url, i) => (
                                    <div key={i} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-border group">
                                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(i)}
                                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                {previewUrls.length < 5 && (
                                    <label className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex items-center justify-center text-foreground/40 hover:text-primary transition-colors">
                                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    </label>
                                )}
                            </div>
                        )}

                        {previewUrls.length === 0 && (
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <label className="cursor-pointer glass rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all p-5 flex flex-col items-center justify-center gap-2.5 group">
                                    <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleImageChange} />
                                    <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground/70 text-center">Open Camera</span>
                                </label>
                                <label className="cursor-pointer glass rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all p-5 flex flex-col items-center justify-center gap-2.5 group">
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                                    <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/50 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground/70 text-center">Open Gallery</span>
                                </label>
                            </div>
                        )}

                        <Button
                            onClick={() => setStep(3)}
                            disabled={images.length === 0}
                            size="lg"
                            className="w-full"
                        >
                            Continue to Review ({images.length} photo{images.length !== 1 ? "s" : ""})
                        </Button>
                    </div>
```

- [ ] **Step 6: Update Step 3 preview thumbnail (line 236 area)**

In step 3's review section, the thumbnail currently shows `<img src={previewUrl!} ...>`. Update to show only the first preview:

Replace:
```tsx
                                <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover" />
```
With:
```tsx
                                <img src={previewUrls[0]} alt="Preview" className="w-full h-full object-cover" />
                                {images.length > 1 && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        +{images.length - 1}
                                    </div>
                                )}
```

Note: the parent `<div className="w-20 h-20 ...">` already has `relative` positioning; if it doesn't, add `relative` to its className.

- [ ] **Step 7: TypeScript check**

```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\frontend"
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors in `app/report/page.tsx`.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/report/page.tsx
git commit -m "feat(report): multi-photo evidence upload (up to 5 photos)"
```

---

## Task 9 — Frontend: `frontend/components/portal/CleanerJobDrawer.tsx`

**Files:**
- Modify: `frontend/components/portal/CleanerJobDrawer.tsx`

Context: prop `onComplete: (workOrderId: number, image: File)`, state `cleanupImage: File | null`, `cleanupPreview: string | null`.

- [ ] **Step 1: Update prop interface (line 16)**

Replace:
```typescript
    onComplete: (workOrderId: number, image: File) => Promise<void> | void;
```
With:
```typescript
    onComplete: (workOrderId: number, images: File[]) => Promise<void> | void;
```

- [ ] **Step 2: Replace state declarations (lines 30–31)**

Replace:
```typescript
    const [cleanupImage, setCleanupImage] = useState<File | null>(null);
    const [cleanupPreview, setCleanupPreview] = useState<string | null>(null);
```
With:
```typescript
    const [cleanupImages, setCleanupImages] = useState<File[]>([]);
    const [cleanupPreviews, setCleanupPreviews] = useState<string[]>([]);
```

- [ ] **Step 3: Replace `handlePickImage` (lines 61–72)**

Replace:
```typescript
    const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
            toast.error("Image must be 10 MB or smaller.");
            return;
        }
        setCleanupImage(file);
        const reader = new FileReader();
        reader.onload = (ev) => setCleanupPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };
```
With:
```typescript
    const handlePickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        const oversized = files.filter((f) => f.size > MAX_UPLOAD_BYTES);
        if (oversized.length > 0) {
            toast.error("Each image must be 10 MB or smaller.");
            return;
        }
        const total = cleanupImages.length + files.length;
        if (total > 5) {
            toast.error("Maximum 5 cleanup photos allowed.");
            return;
        }
        setCleanupImages((prev) => [...prev, ...files]);
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) =>
                setCleanupPreviews((prev) => [...prev, ev.target?.result as string]);
            reader.readAsDataURL(file);
        });
        e.target.value = "";
    };

    const removeCleanupImage = (index: number) => {
        setCleanupImages((prev) => prev.filter((_, i) => i !== index));
        setCleanupPreviews((prev) => prev.filter((_, i) => i !== index));
    };
```

- [ ] **Step 4: Update `handleSubmitPhoto` (lines 74–83)**

Replace:
```typescript
    const handleSubmitPhoto = async () => {
        if (!cleanupImage) {
            toast.error("Please choose a photo first.");
            return;
        }
        await onComplete(workOrder.id, cleanupImage);
        setCleanupImage(null);
        setCleanupPreview(null);
        setPhotoModalOpen(false);
    };
```
With:
```typescript
    const handleSubmitPhoto = async () => {
        if (cleanupImages.length === 0) {
            toast.error("Please choose at least one photo.");
            return;
        }
        await onComplete(workOrder.id, cleanupImages);
        setCleanupImages([]);
        setCleanupPreviews([]);
        setPhotoModalOpen(false);
    };
```

- [ ] **Step 5: Update `closePhotoModal` (lines 85–89)**

Replace:
```typescript
    const closePhotoModal = () => {
        setPhotoModalOpen(false);
        setCleanupImage(null);
        setCleanupPreview(null);
    };
```
With:
```typescript
    const closePhotoModal = () => {
        setPhotoModalOpen(false);
        setCleanupImages([]);
        setCleanupPreviews([]);
    };
```

- [ ] **Step 6: Replace the After panel in the photo modal (lines 326–345)**

The "After" `<label>` currently shows a single preview. Replace it with a multi-preview strip:

Replace:
```tsx
                            {/* AFTER */}
                            <label className="rounded-xl overflow-hidden border-2 border-dashed border-foreground/20 hover:border-primary/60 bg-black/20 cursor-pointer relative group">
                                <div className="text-[10px] uppercase tracking-widest font-bold text-foreground/50 p-2 border-b border-border/50">After</div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handlePickImage}
                                />
                                {cleanupPreview ? (
                                    <img src={cleanupPreview} alt="After preview" className="w-full h-32 object-cover" />
                                ) : (
                                    <div className="w-full h-32 flex items-center justify-center text-center px-2">
                                        <div>
                                            <Camera className="size-6 mx-auto mb-1 text-foreground/40 group-hover:text-primary transition-colors" />
                                            <p className="text-[10px] font-bold text-foreground/50">Tap to capture</p>
                                        </div>
                                    </div>
                                )}
                            </label>
```
With:
```tsx
                            {/* AFTER — multi-photo */}
                            <div className="rounded-xl overflow-hidden border border-border bg-black/30">
                                <div className="text-[10px] uppercase tracking-widest font-bold text-foreground/50 p-2 border-b border-border bg-black/20">
                                    After ({cleanupImages.length}/5)
                                </div>
                                {cleanupPreviews.length === 0 ? (
                                    <label className="w-full h-32 flex items-center justify-center cursor-pointer group">
                                        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePickImages} />
                                        <div className="text-center">
                                            <Camera className="size-6 mx-auto mb-1 text-foreground/40 group-hover:text-primary transition-colors" />
                                            <p className="text-[10px] font-bold text-foreground/50">Tap to capture</p>
                                        </div>
                                    </label>
                                ) : (
                                    <div className="flex gap-1 overflow-x-auto p-1">
                                        {cleanupPreviews.map((url, i) => (
                                            <div key={i} className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden group">
                                                <img src={url} alt={`After ${i + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCleanupImage(i)}
                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                        {cleanupImages.length < 5 && (
                                            <label className="shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-foreground/20 hover:border-primary/50 cursor-pointer flex items-center justify-center text-foreground/40 hover:text-primary transition-colors">
                                                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePickImages} />
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
```

- [ ] **Step 7: Update Submit button disabled condition (line 364)**

Replace:
```tsx
                                disabled={!cleanupImage || actionLoading}
```
With:
```tsx
                                disabled={cleanupImages.length === 0 || actionLoading}
```

- [ ] **Step 8: TypeScript check**

```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\frontend"
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors in `CleanerJobDrawer.tsx`.

- [ ] **Step 9: Commit**

```bash
git add frontend/components/portal/CleanerJobDrawer.tsx
git commit -m "feat(drawer): multi-photo cleanup upload (up to 5 photos)"
```

---

## Task 10 — Frontend: `frontend/app/cleaner/page.tsx`

**Files:**
- Modify: `frontend/app/cleaner/page.tsx:149-173`

- [ ] **Step 1: Update `handleComplete` signature and FormData (lines 149–173)**

Replace:
```typescript
    const handleComplete = async (workOrderId: number, image: File) => {
        setActionLoading(true);
        const formData = new FormData();
        formData.append("cleanup_image", image);
```
With:
```typescript
    const handleComplete = async (workOrderId: number, images: File[]) => {
        setActionLoading(true);
        const formData = new FormData();
        images.forEach((img) => formData.append("cleanup_images", img));
```

- [ ] **Step 2: TypeScript check**

```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\frontend"
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors in `cleaner/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/cleaner/page.tsx
git commit -m "feat(cleaner): wire multi-photo cleanup to updated handleComplete"
```

---

## Task 11 — Frontend: `frontend/app/track/[id]/page.tsx` (photo strip)

**Files:**
- Modify: `frontend/app/track/[id]/page.tsx`

Context: `report` object comes from `GET /report/track/{slug}` which now includes a `photos` array. Currently, only `report.image_url` is shown.

- [ ] **Step 1: Add photo strip below the main evidence photo**

In `track/[id]/page.tsx`, find the closing `</>` of the evidence photo block (around line 189, after the AI confidence badge `</div>`). Insert a photo strip before the closing `</>`:

After the closing `</div>` of the AI confidence badge section (which ends around line 201), and before the closing `</div>` of the main photo container, add a photo strip. The exact insertion is after the AI confidence badge block and before the closing `</div>` of `className="w-full aspect-square rounded-2xl overflow-hidden..."`:

Actually, insert it **after the entire `className="w-full aspect-square..."` div** (after line 201 `</div>`):

```tsx
                                {/* Multi-photo strip — shown when report has >1 evidence photo */}
                                {Array.isArray(report.photos) && report.photos.length > 1 && (
                                    <div className="mt-3">
                                        <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-2">
                                            All Evidence Photos ({report.photos.length})
                                        </p>
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                            {report.photos.map((photo: any, i: number) => (
                                                <div key={i} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border">
                                                    <img
                                                        src={`${API_URL}${photo.url}`}
                                                        alt={`Evidence ${i + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {photo.ai_verified != null && (
                                                        <div className={`absolute bottom-0 inset-x-0 text-center text-[9px] font-bold py-0.5 ${photo.ai_verified ? 'bg-primary/80 text-white' : 'bg-red-500/80 text-white'}`}>
                                                            {photo.ai_verified ? "✓ Pass" : "✕ Fail"}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
```

- [ ] **Step 2: TypeScript check**

```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\frontend"
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors in `track/[id]/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/track/[id]/page.tsx
git commit -m "feat(track): show multi-photo evidence strip with per-photo AI verdict"
```

---

## Task 12 — End-to-end manual test

- [ ] **Step 1: Start both servers**

Terminal 1 (backend):
```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\backend"
.\venv\Scripts\uvicorn.exe main:app --reload
```

Terminal 2 (frontend):
```powershell
cd "c:\Users\Renzo Boyonas\OneDrive\Documents\3rd YR 2nd SEM\EcoWatch\frontend"
npm run dev
```

- [ ] **Step 2: Test citizen multi-photo report**

1. Open `http://localhost:3000/report`
2. Pin a location → Next
3. Upload 2–3 photos via gallery → confirm strip shows thumbnails, remove button works
4. "Continue to Review" button label shows count, e.g. "Continue (3 photos)"
5. Submit → redirected to `/track/...`
6. Track page shows "AI Verifying…" spinner, then resolves to Verified or Rejected
7. Track page shows photo strip with "All Evidence Photos (3)"

- [ ] **Step 3: Test cleaner multi-photo cleanup**

1. Log in as cleaner (`cleaner@test.com` / `password123`)
2. Open a job in `in_progress` state → "Upload Cleanup Photo"
3. In the modal: Before shows citizen photo, After shows a multi-photo uploader
4. Add 2 cleanup photos → verify strip appears, remove works
5. Submit → toast "AI verifying…" appears
6. After ~3–5 seconds, status updates (VERIFIED or NEEDS_REDO)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: multi-photo reports and cleanup verification complete"
git push
```

---

## Quick Reference: What Changed Where

| Original | New |
|----------|-----|
| `image: UploadFile` in submit | `images: List[UploadFile]` |
| `cleanup_image: UploadFile` in resolve/complete | `cleanup_images: List[UploadFile]` |
| `formData.append("image", img)` | `images.forEach(img => formData.append("images", img))` |
| `formData.append("cleanup_image", img)` | `imgs.forEach(img => formData.append("cleanup_images", img))` |
| `onComplete(id, image: File)` | `onComplete(id, images: File[])` |
| BG tasks read `report.image_url` | BG tasks query `report_photos` / `cleanup_photos` tables |
| Single AI result | ANY-wins aggregation across batch |
