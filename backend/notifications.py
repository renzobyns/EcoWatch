"""In-app notification feed helper.

Called from main.py write-hooks whenever a WorkOrder state change affects a cleaner.
Caller owns the transaction — emit_notification only stages the insert (db.add),
the caller commits.
"""
from typing import Optional
from sqlalchemy.orm import Session

import models


def emit_notification(
    db: Session,
    user_id: int,
    kind: str,
    title: str,
    body: str,
    work_order_id: Optional[int] = None,
    report_id: Optional[int] = None,
) -> None:
    """Stage a notification insert. The caller commits.

    kind is a short slug used by the frontend for icon/colour selection:
      job_assigned | priority_changed | reassigned | needs_redo | verified | force_resolved
    """
    n = models.Notification(
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        work_order_id=work_order_id,
        report_id=report_id,
    )
    db.add(n)


def emit_to_barangay(
    db: Session,
    barangay_name: str,
    kind: str,
    title: str,
    body: str,
    work_order_id: Optional[int] = None,
    report_id: Optional[int] = None,
) -> None:
    """Broadcast to every active barangay user assigned to barangay_name."""
    users = db.query(models.User).filter(
        models.User.role == "barangay",
        models.User.barangay_assignment == barangay_name,
        models.User.is_active == True,  # noqa: E712
    ).all()
    for u in users:
        emit_notification(db, u.id, kind, title, body, work_order_id, report_id)


def emit_to_cenro(
    db: Session,
    kind: str,
    title: str,
    body: str,
    work_order_id: Optional[int] = None,
    report_id: Optional[int] = None,
) -> None:
    """Broadcast to every active CENRO user."""
    users = db.query(models.User).filter(
        models.User.role == "cenro",
        models.User.is_active == True,  # noqa: E712
    ).all()
    for u in users:
        emit_notification(db, u.id, kind, title, body, work_order_id, report_id)


# Module-level debounce timestamp — sweep at most once per 5 min per process.
import time as _time
_last_sla_sweep_ts: float = 0.0

def sweep_sla_notifications(db: Session) -> None:
    """Scan active work orders; emit sla_approaching / sla_breached idempotently.

    Idempotency: skip a WO if a notification of the same kind already exists for it.
    """
    global _last_sla_sweep_ts
    now_ts = _time.time()
    if now_ts - _last_sla_sweep_ts < 300:
        return
    _last_sla_sweep_ts = now_ts

    from datetime import datetime, timedelta
    now = datetime.utcnow()
    soon = now + timedelta(hours=24)

    active = db.query(models.WorkOrder).filter(
        models.WorkOrder.status.in_([
            models.WorkOrderStatus.ASSIGNED,
            models.WorkOrderStatus.IN_PROGRESS,
            models.WorkOrderStatus.NEEDS_REDO,
        ]),
    ).all()

    for wo in active:
        if not wo.sla_deadline or not wo.report or not wo.report.barangay:
            continue
        already = {
            n.kind for n in db.query(models.Notification.kind)
            .filter(models.Notification.work_order_id == wo.id)
            .filter(models.Notification.kind.in_(["sla_approaching", "sla_breached"]))
            .all()
        }
        tracking = wo.report.tracking_id or f"WO #{wo.id}"

        if wo.sla_deadline < now and "sla_breached" not in already:
            emit_to_barangay(
                db, wo.report.barangay, "sla_breached",
                f"SLA breached: {tracking}",
                f"Deadline was {wo.sla_deadline.strftime('%b %d %I:%M %p')}.",
                work_order_id=wo.id, report_id=wo.report_id,
            )
            emit_to_cenro(
                db, "cenro_sla_breached",
                f"SLA breached in {wo.report.barangay}: {tracking}",
                f"Priority: {wo.priority.upper()}. Deadline: {wo.sla_deadline.strftime('%b %d %I:%M %p')}.",
                work_order_id=wo.id, report_id=wo.report_id,
            )
        elif now <= wo.sla_deadline <= soon and "sla_approaching" not in already:
            emit_to_barangay(
                db, wo.report.barangay, "sla_approaching",
                f"SLA approaching: {tracking}",
                f"Deadline in <24h ({wo.sla_deadline.strftime('%b %d %I:%M %p')}).",
                work_order_id=wo.id, report_id=wo.report_id,
            )

    db.commit()
