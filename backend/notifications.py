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
