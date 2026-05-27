import numpy as np
from sklearn.cluster import DBSCAN
from datetime import datetime, timedelta
from collections import defaultdict


def get_heatmap_clusters(reports, eps=0.001, min_samples=2):
    """
    Applies DBSCAN clustering on report coordinates to identify
    high-density dumping zones (hotspots).

    eps=0.001 degrees is roughly ~100 meters.
    """
    if not reports:
        return []

    coords = np.array([[r.lat, r.lon] for r in reports])

    db = DBSCAN(eps=eps, min_samples=min_samples).fit(coords)
    labels = db.labels_

    clusters = []
    unique_labels = set(labels)

    for label in unique_labels:
        if label == -1:
            continue

        class_member_mask = (labels == label)
        cluster_points = coords[class_member_mask]

        centroid_lat = np.mean(cluster_points[:, 0])
        centroid_lon = np.mean(cluster_points[:, 1])

        clusters.append({
            "cluster_id": int(label),
            "lat": float(centroid_lat),
            "lon": float(centroid_lon),
            "intensity": len(cluster_points),
            "points": [{"lat": float(p[0]), "lon": float(p[1])} for p in cluster_points]
        })

    return clusters


# ---------------------------------------------------------
# Insights aggregation - powers /analytics/insights
# ---------------------------------------------------------

_RESOLUTION_DENOM_STATUSES = {"resolved", "verified", "assigned", "in_progress", "failed_cleanup"}
_AI_REJECTED_THRESHOLD = 0.5


def _granularity_for_window(days):
    if days <= 30:
        return "day"
    if days <= 90:
        return "week"
    return "month"


def _bucket_key(dt, granularity):
    if granularity == "day":
        return dt.strftime("%Y-%m-%d")
    if granularity == "week":
        iso = dt.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    return dt.strftime("%Y-%m")


def _pct_delta(current, prior):
    if prior == 0:
        return None if current == 0 else 100.0
    return round((current - prior) / prior * 100, 1)


def _summarize_window(reports, wo_compliance_records, start, end):
    in_window = [r for r in reports if r.created_at and start <= r.created_at < end]
    submitted = sum(1 for r in in_window if r.status != "rejected")

    denom = sum(1 for r in in_window if r.status in _RESOLUTION_DENOM_STATUSES)
    resolved = sum(1 for r in in_window if r.status == "resolved")
    resolution_rate = round(resolved / denom * 100, 1) if denom > 0 else 0.0

    resolved_with_time = [r for r in in_window if r.status == "resolved" and r.resolved_at and r.created_at]
    if resolved_with_time:
        secs = sum((r.resolved_at - r.created_at).total_seconds() for r in resolved_with_time)
        avg_resolve_days = round(secs / len(resolved_with_time) / 86400, 2)
    else:
        avg_resolve_days = 0.0

    completed_in_window = [wo for wo in wo_compliance_records if wo["completed_at"] and start <= wo["completed_at"] < end]
    if completed_in_window:
        on_time = sum(1 for wo in completed_in_window if wo["on_time"])
        sla_compliance = round(on_time / len(completed_in_window) * 100, 1)
    else:
        sla_compliance = None

    return {
        "reports": submitted,
        "resolved": resolved,
        "resolution_rate": resolution_rate,
        "avg_resolve_days": avg_resolve_days,
        "sla_compliance": sla_compliance,
    }


def _build_trend(reports, start, end, granularity):
    buckets = defaultdict(lambda: {"submitted": 0, "resolved": 0, "rejected": 0, "conf_sum": 0.0, "conf_n": 0})

    cursor = start
    while cursor < end:
        key = _bucket_key(cursor, granularity)
        _ = buckets[key]
        if granularity == "day":
            cursor += timedelta(days=1)
        elif granularity == "week":
            cursor += timedelta(days=7)
        else:
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)

    for r in reports:
        if not r.created_at or not (start <= r.created_at < end):
            continue
        key = _bucket_key(r.created_at, granularity)
        b = buckets[key]
        b["submitted"] += 1
        if r.status == "resolved":
            b["resolved"] += 1
        elif r.status == "rejected":
            b["rejected"] += 1
        if r.ai_confidence is not None:
            b["conf_sum"] += r.ai_confidence
            b["conf_n"] += 1

    series = []
    for key in sorted(buckets.keys()):
        b = buckets[key]
        avg_conf = round(b["conf_sum"] / b["conf_n"], 3) if b["conf_n"] > 0 else None
        series.append({
            "date": key,
            "submitted": b["submitted"],
            "resolved": b["resolved"],
            "rejected": b["rejected"],
            "avg_confidence": avg_conf,
        })
    return series


def _build_barangay_leaderboard(reports, start, end, prior_start):
    current = defaultdict(lambda: {"total": 0, "resolved": 0, "active": 0, "pending": 0, "resolve_secs": 0.0, "resolve_n": 0})
    prior = defaultdict(int)

    for r in reports:
        if not r.created_at or not r.barangay:
            continue
        if start <= r.created_at < end:
            c = current[r.barangay]
            c["total"] += 1
            if r.status == "resolved":
                c["resolved"] += 1
                if r.resolved_at:
                    c["resolve_secs"] += (r.resolved_at - r.created_at).total_seconds()
                    c["resolve_n"] += 1
            elif r.status in ("assigned", "in_progress"):
                c["active"] += 1
            elif r.status in ("pending", "verified"):
                c["pending"] += 1
        elif prior_start <= r.created_at < start:
            prior[r.barangay] += 1

    rows = []
    for name, c in current.items():
        denom = c["resolved"] + c["active"]
        rate = round(c["resolved"] / denom * 100, 1) if denom > 0 else 0.0
        avg_days = round(c["resolve_secs"] / c["resolve_n"] / 86400, 2) if c["resolve_n"] > 0 else 0.0
        prior_n = prior[name]
        if prior_n == 0:
            trend = "new" if c["total"] > 0 else "flat"
        elif c["total"] > prior_n:
            trend = "up"
        elif c["total"] < prior_n:
            trend = "down"
        else:
            trend = "flat"
        rows.append({
            "barangay": name,
            "total": c["total"],
            "resolved": c["resolved"],
            "active": c["active"],
            "pending": c["pending"],
            "resolution_rate": rate,
            "avg_resolve_days": avg_days,
            "prior_total": prior_n,
            "trend": trend,
        })

    rows.sort(key=lambda x: (-x["total"], x["barangay"]))
    return rows


def _build_funnel(reports, start, end):
    counts = {"pending": 0, "verified": 0, "assigned": 0, "in_progress": 0, "resolved": 0, "rejected": 0, "failed_cleanup": 0}
    for r in reports:
        if not r.created_at or not (start <= r.created_at < end):
            continue
        if r.status in counts:
            counts[r.status] += 1
    submitted = sum(counts.values())
    verified_or_beyond = counts["verified"] + counts["assigned"] + counts["in_progress"] + counts["resolved"] + counts["failed_cleanup"]
    assigned_or_beyond = counts["assigned"] + counts["in_progress"] + counts["resolved"] + counts["failed_cleanup"]
    resolved_total = counts["resolved"]
    return {
        "stages": [
            {"key": "submitted", "label": "Submitted", "count": submitted},
            {"key": "verified", "label": "AI Verified", "count": verified_or_beyond},
            {"key": "assigned", "label": "Team Assigned", "count": assigned_or_beyond},
            {"key": "resolved", "label": "Resolved", "count": resolved_total},
        ],
        "branches": [
            {"key": "rejected", "label": "Rejected by AI", "count": counts["rejected"]},
            {"key": "failed_cleanup", "label": "Failed Cleanup", "count": counts["failed_cleanup"]},
        ],
        "raw_counts": counts,
    }


def _build_ai_quality(reports, start, end):
    in_window = [r for r in reports if r.created_at and start <= r.created_at < end and r.ai_confidence is not None]
    bins = [(0.0, 0.5), (0.5, 0.6), (0.6, 0.7), (0.7, 0.8), (0.8, 0.9), (0.9, 1.01)]
    labels = ["<0.5", "0.5-0.6", "0.6-0.7", "0.7-0.8", "0.8-0.9", "0.9-1.0"]
    histogram = []
    for (lo, hi), label in zip(bins, labels):
        count = sum(1 for r in in_window if lo <= r.ai_confidence < hi)
        histogram.append({"bucket": label, "count": count, "min": lo, "max": hi})

    if in_window:
        mean_conf = round(sum(r.ai_confidence for r in in_window) / len(in_window), 3)
    else:
        mean_conf = None

    rejected = sum(1 for r in in_window if r.status == "rejected")
    verified_through = sum(1 for r in in_window if r.status != "rejected" and r.status != "pending")
    verification_rate = round(verified_through / len(in_window) * 100, 1) if in_window else 0.0
    verified_with_conf = [r for r in in_window if r.status != "rejected" and r.ai_confidence is not None]
    if verified_with_conf:
        avg_verified_conf = round(sum(r.ai_confidence for r in verified_with_conf) / len(verified_with_conf), 3)
    else:
        avg_verified_conf = None

    return {
        "histogram": histogram,
        "total_analyzed": len(in_window),
        "mean_confidence": mean_conf,
        "mean_verified_confidence": avg_verified_conf,
        "rejected_count": rejected,
        "verification_rate": verification_rate,
        "ai_threshold": _AI_REJECTED_THRESHOLD,
    }


def _build_response_time_by_priority(work_orders, start, end):
    buckets = {p: {"created_to_deployed_secs": 0.0, "deployed_to_completed_secs": 0.0, "n_dep": 0, "n_done": 0, "total": 0}
               for p in ("low", "medium", "high")}
    for wo in work_orders:
        if not wo.created_at or not (start <= wo.created_at < end):
            continue
        p = (wo.priority or "medium").lower()
        if p not in buckets:
            continue
        buckets[p]["total"] += 1
        if wo.started_at:
            buckets[p]["created_to_deployed_secs"] += (wo.started_at - wo.created_at).total_seconds()
            buckets[p]["n_dep"] += 1
        if wo.completed_at and wo.started_at:
            buckets[p]["deployed_to_completed_secs"] += (wo.completed_at - wo.started_at).total_seconds()
            buckets[p]["n_done"] += 1

    rows = []
    for priority in ("high", "medium", "low"):
        b = buckets[priority]
        c2d_h = round(b["created_to_deployed_secs"] / b["n_dep"] / 3600, 1) if b["n_dep"] > 0 else None
        d2c_h = round(b["deployed_to_completed_secs"] / b["n_done"] / 3600, 1) if b["n_done"] > 0 else None
        rows.append({
            "priority": priority,
            "total_wos": b["total"],
            "avg_created_to_deployed_hours": c2d_h,
            "avg_deployed_to_completed_hours": d2c_h,
            "completed_count": b["n_done"],
        })
    return rows


def compute_drilldown(reports, work_orders, metric, key=None, start=None, end=None, days=30, now=None):
    """Return the records that compose one analytics element, with a formula/breakdown for display."""
    if start is None or end is None:
        now = now or datetime.utcnow()
        end = now
        start = now - timedelta(days=days)

    in_window = [r for r in reports if r.created_at and start <= r.created_at < end]

    # ---- KPI: total reports (excludes rejected, mirrors _summarize_window L79) ----
    if metric == "reports":
        rows = [r for r in in_window if r.status != "rejected"]
        return {
            "kind": "reports",
            "title": "Reports",
            "headline": str(len(rows)),
            "formula": f"{len(rows)} non-rejected reports in the selected window",
            "breakdown": [
                {"label": "Submitted", "count": len(rows), "tone": "blue"},
            ],
            "report_rows": rows,
            "wo_rows": [],
        }

    # ---- KPI: resolution rate (mirrors _summarize_window L81-83) ----
    if metric == "resolution_rate":
        eligible = [r for r in in_window if r.status in _RESOLUTION_DENOM_STATUSES]
        resolved = [r for r in eligible if r.status == "resolved"]
        rate = round(len(resolved) / len(eligible) * 100, 1) if eligible else 0.0
        return {
            "kind": "reports",
            "title": "Resolution Rate",
            "headline": f"{rate}%",
            "formula": f"{len(resolved)} resolved ÷ {len(eligible)} eligible = {rate}%",
            "breakdown": [
                {"label": "Resolved", "count": len(resolved), "tone": "emerald"},
                {"label": "Eligible", "count": len(eligible), "tone": "blue"},
            ],
            "report_rows": eligible,
            "wo_rows": [],
            "row_detail": {r.id: "resolved" if r.status == "resolved" else r.status for r in eligible},
        }

    # ---- KPI: avg time to resolve (mirrors _summarize_window L85-88) ----
    if metric == "avg_resolve_days":
        resolved_timed = [r for r in in_window if r.status == "resolved" and r.resolved_at and r.created_at]
        if resolved_timed:
            avg_days = round(sum((r.resolved_at - r.created_at).total_seconds() for r in resolved_timed) / len(resolved_timed) / 86400, 2)
        else:
            avg_days = 0.0
        return {
            "kind": "reports",
            "title": "Avg Time to Resolve",
            "headline": f"{avg_days}d",
            "formula": f"mean of {len(resolved_timed)} resolve times = {avg_days}d",
            "breakdown": [
                {"label": "Resolved with timing", "count": len(resolved_timed), "tone": "yellow"},
            ],
            "report_rows": resolved_timed,
            "wo_rows": [],
            "row_detail": {
                r.id: f"{round((r.resolved_at - r.created_at).total_seconds() / 86400, 1)}d"
                for r in resolved_timed
            },
        }

    # ---- KPI: SLA compliance (mirrors compute_insights L306-312 + _summarize_window L92-95) ----
    if metric == "sla_compliance":
        wo_in_window = [
            wo for wo in work_orders
            if wo.completed_at and wo.sla_deadline and start <= wo.completed_at < end
        ]
        on_time = [wo for wo in wo_in_window if wo.completed_at <= wo.sla_deadline]
        late = [wo for wo in wo_in_window if wo.completed_at > wo.sla_deadline]
        rate = round(len(on_time) / len(wo_in_window) * 100, 1) if wo_in_window else None
        headline = f"{rate}%" if rate is not None else "N/A"
        formula = (
            f"{len(on_time)} on-time ÷ {len(wo_in_window)} completed = {rate}%"
            if wo_in_window else "No completed work orders in window"
        )
        return {
            "kind": "work_orders",
            "title": "SLA Compliance",
            "headline": headline,
            "formula": formula,
            "breakdown": [
                {"label": "On-time", "count": len(on_time), "tone": "emerald"},
                {"label": "Late", "count": len(late), "tone": "red"},
            ],
            "report_rows": [],
            "wo_rows": wo_in_window,
            "row_detail": {wo.id: "on-time" if wo.completed_at <= wo.sla_deadline else "late" for wo in wo_in_window},
        }

    # ---- Funnel stages (mirrors _build_funnel L205-228) ----
    if metric == "funnel":
        stage_sets = {
            "submitted": in_window,
            "verified": [r for r in in_window if r.status in {"verified", "assigned", "in_progress", "resolved", "failed_cleanup"}],
            "assigned": [r for r in in_window if r.status in {"assigned", "in_progress", "resolved", "failed_cleanup"}],
            "resolved": [r for r in in_window if r.status == "resolved"],
        }
        rows = stage_sets.get(key, [])
        label_map = {"submitted": "Submitted", "verified": "AI Verified", "assigned": "Team Assigned", "resolved": "Resolved"}
        label = label_map.get(key, key or "")
        return {
            "kind": "reports",
            "title": f"Funnel — {label}",
            "headline": str(len(rows)),
            "formula": f"{len(rows)} reports at '{label}' stage or beyond",
            "breakdown": [{"label": label, "count": len(rows), "tone": "blue"}],
            "report_rows": rows,
            "wo_rows": [],
        }

    # ---- Funnel branches: rejected / failed_cleanup ----
    if metric == "branch":
        rows = [r for r in in_window if r.status == key]
        label_map = {"rejected": "Rejected by AI", "failed_cleanup": "Failed Cleanup"}
        label = label_map.get(key, key or "")
        return {
            "kind": "reports",
            "title": f"Branch — {label}",
            "headline": str(len(rows)),
            "formula": f"{len(rows)} reports with status '{key}'",
            "breakdown": [{"label": label, "count": len(rows), "tone": "red"}],
            "report_rows": rows,
            "wo_rows": [],
        }

    # ---- Leaderboard row: one barangay's reports ----
    if metric == "leaderboard":
        rows = [r for r in in_window if r.barangay == key]
        resolved = [r for r in rows if r.status == "resolved"]
        return {
            "kind": "reports",
            "title": f"Barangay — {key}",
            "headline": str(len(rows)),
            "formula": f"{len(rows)} total | {len(resolved)} resolved",
            "breakdown": [
                {"label": "Total", "count": len(rows), "tone": "blue"},
                {"label": "Resolved", "count": len(resolved), "tone": "emerald"},
            ],
            "report_rows": rows,
            "wo_rows": [],
            "row_detail": {r.id: r.status for r in rows},
        }

    # ---- AI confidence histogram bucket (mirrors _build_ai_quality L233-238) ----
    if metric == "ai_bucket":
        # key is the bucket label string e.g. "0.7-0.8"; match by label from histogram bins
        bins = [(0.0, 0.5, "<0.5"), (0.5, 0.6, "0.5-0.6"), (0.6, 0.7, "0.6-0.7"),
                (0.7, 0.8, "0.7-0.8"), (0.8, 0.9, "0.8-0.9"), (0.9, 1.01, "0.9-1.0")]
        matched = next(((lo, hi, lbl) for lo, hi, lbl in bins if lbl == key), None)
        if matched:
            lo, hi, lbl = matched
            rows = [r for r in in_window if r.ai_confidence is not None and lo <= r.ai_confidence < hi]
        else:
            rows = []
            lbl = key or ""
        above = hi > _AI_REJECTED_THRESHOLD if matched else False
        tone = "emerald" if above else "red"
        return {
            "kind": "reports",
            "title": f"AI Confidence Bucket — {lbl}",
            "headline": str(len(rows)),
            "formula": f"{len(rows)} reports with AI confidence in [{lbl}] ({'above' if above else 'below'} threshold)",
            "breakdown": [{"label": lbl, "count": len(rows), "tone": tone}],
            "report_rows": rows,
            "wo_rows": [],
            "row_detail": {r.id: f"{round((r.ai_confidence or 0) * 100)}%" for r in rows},
        }

    # ---- Response time by priority (mirrors _build_response_time_by_priority L268-274) ----
    if metric == "response_priority":
        wo_in_window = [
            wo for wo in work_orders
            if wo.created_at and start <= wo.created_at < end and (wo.priority or "medium").lower() == (key or "").lower()
        ]
        return {
            "kind": "work_orders",
            "title": f"Response Time — {(key or '').capitalize()} Priority",
            "headline": str(len(wo_in_window)),
            "formula": f"{len(wo_in_window)} work orders with {key} priority in the selected window",
            "breakdown": [{"label": f"{key} priority WOs", "count": len(wo_in_window), "tone": "yellow"}],
            "report_rows": [],
            "wo_rows": wo_in_window,
            "row_detail": {
                wo.id: (
                    f"start:{round((wo.started_at - wo.created_at).total_seconds()/3600,1)}h"
                    if wo.started_at else "not started"
                )
                for wo in wo_in_window
            },
        }

    raise ValueError(f"Unknown drilldown metric: {metric!r}")


def compute_insights(reports, work_orders, days, now=None):
    """Pure aggregation - produces all data the Analytics tab needs."""
    now = now or datetime.utcnow()
    end = now
    start = now - timedelta(days=days)
    prior_start = start - timedelta(days=days)

    granularity = _granularity_for_window(days)

    wo_compliance_records = []
    for wo in work_orders:
        if wo.completed_at and wo.sla_deadline:
            wo_compliance_records.append({
                "completed_at": wo.completed_at,
                "on_time": wo.completed_at <= wo.sla_deadline,
            })

    current_kpis = _summarize_window(reports, wo_compliance_records, start, end)
    prior_kpis = _summarize_window(reports, wo_compliance_records, prior_start, start)

    cur_sla = current_kpis["sla_compliance"]
    pri_sla = prior_kpis["sla_compliance"]
    deltas = {
        "reports_pct": _pct_delta(current_kpis["reports"], prior_kpis["reports"]),
        "resolution_rate_pts": round(current_kpis["resolution_rate"] - prior_kpis["resolution_rate"], 1),
        "avg_resolve_days_pct": _pct_delta(current_kpis["avg_resolve_days"], prior_kpis["avg_resolve_days"]),
        "sla_compliance_pts": round(cur_sla - pri_sla, 1) if cur_sla is not None and pri_sla is not None else None,
    }

    return {
        "window": {
            "days": days,
            "granularity": granularity,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "prior_start": prior_start.isoformat(),
        },
        "kpis": {
            "current": current_kpis,
            "prior": prior_kpis,
            "delta": deltas,
        },
        "trend": _build_trend(reports, start, end, granularity),
        "barangay_leaderboard": _build_barangay_leaderboard(reports, start, end, prior_start),
        "funnel": _build_funnel(reports, start, end),
        "ai_quality": _build_ai_quality(reports, start, end),
        "response_time_by_priority": _build_response_time_by_priority(work_orders, start, end),
    }