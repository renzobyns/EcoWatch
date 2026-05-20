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

_RESOLUTION_DENOM_STATUSES = {"resolved", "verified", "deployed", "failed_cleanup"}
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
    submitted = len(in_window)

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
        sla_compliance = 0.0

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
    current = defaultdict(lambda: {"total": 0, "resolved": 0, "deployed": 0, "pending": 0, "resolve_secs": 0.0, "resolve_n": 0})
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
            elif r.status == "deployed":
                c["deployed"] += 1
            elif r.status in ("pending", "verified"):
                c["pending"] += 1
        elif prior_start <= r.created_at < start:
            prior[r.barangay] += 1

    rows = []
    for name, c in current.items():
        denom = c["resolved"] + c["deployed"]
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
            "deployed": c["deployed"],
            "pending": c["pending"],
            "resolution_rate": rate,
            "avg_resolve_days": avg_days,
            "prior_total": prior_n,
            "trend": trend,
        })

    rows.sort(key=lambda x: (-x["total"], x["barangay"]))
    return rows


def _build_funnel(reports, start, end):
    counts = {"pending": 0, "verified": 0, "deployed": 0, "resolved": 0, "rejected": 0, "failed_cleanup": 0}
    for r in reports:
        if not r.created_at or not (start <= r.created_at < end):
            continue
        if r.status in counts:
            counts[r.status] += 1
    submitted = sum(counts.values())
    verified_or_beyond = counts["verified"] + counts["deployed"] + counts["resolved"] + counts["failed_cleanup"]
    deployed_or_beyond = counts["deployed"] + counts["resolved"] + counts["failed_cleanup"]
    resolved_total = counts["resolved"]
    return {
        "stages": [
            {"key": "submitted", "label": "Submitted", "count": submitted},
            {"key": "verified", "label": "AI Verified", "count": verified_or_beyond},
            {"key": "deployed", "label": "Team Deployed", "count": deployed_or_beyond},
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

    deltas = {
        "reports_pct": _pct_delta(current_kpis["reports"], prior_kpis["reports"]),
        "resolution_rate_pts": round(current_kpis["resolution_rate"] - prior_kpis["resolution_rate"], 1),
        "avg_resolve_days_pct": _pct_delta(current_kpis["avg_resolve_days"], prior_kpis["avg_resolve_days"]),
        "sla_compliance_pts": round(current_kpis["sla_compliance"] - prior_kpis["sla_compliance"], 1),
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