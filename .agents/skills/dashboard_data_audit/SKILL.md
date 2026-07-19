---
name: dashboard-data-audit
description: Trigger this skill to perform a comprehensive data consistency and mathematical derivation audit on any dashboard, page, or tab. It verifies that frontend KPI calculations correctly map to backend data schemas and statuses, ensuring accurate reporting.
---

# Dashboard Data Audit Skill

This skill provides a systematic workflow for auditing the data consistency and metric calculations on frontend dashboards and tabs. You should run this skill when the user asks to validate records or check the data accuracy of a specific page or tab.

## Workflow Instructions

When the user asks you to validate or audit a specific tab (e.g., "audit the CENRO analytics tab" or "validate the Barangay dashboard"), follow these exact steps:

### 1. Identify the Frontend Code
- Locate the main React/Next.js file for the requested tab or page.
- Look for all data fetching functions (e.g., `fetch()`, `api()`) and identify the exact API endpoints being called.
- Identify all derived metrics, KPI calculations, array filters, **and all graphs, charts, or funnels** (e.g., LineCharts, PieCharts, conversion funnels).

### 2. Identify the Backend Source
- Locate the FastAPI backend routes corresponding to the API endpoints found in Step 1.
- Trace the data back to the SQLAlchemy models (e.g., `models.py`) to understand the complete schema and all possible enum values (e.g., all possible string values for `status`).

### 3. Perform the Consistency Check
Carefully analyze the frontend math against the backend schema. Check for the following common issues:
- **Exhaustive Bucketing**: If the frontend calculates a "remainder" (e.g., `total - a - b`), verify that this doesn't accidentally include unrelated statuses (like `rejected` or `cancelled`).
- **Missing Enums**: Are there new backend statuses that the frontend doesn't know about?
- **Pagination & Limits**: Is the frontend calculating totals based on a paginated array (e.g., `limit=200`) instead of asking the backend for the true aggregate total?
- **Type Mismatches**: Are numbers being compared as strings, or vice versa?

### 4. Perform the UX & Clarity Audit
Check the user interface for maximum clarity:
- **Tooltips for Unfamiliar Terms**: Ensure every specialized metric, acronym, or calculation (e.g., "Mean count", "Threshold 50%", "Resolution Rate", "Period vs Period") has an `InfoTooltip` that explicitly explains what it means and how it's calculated.
- **Sensible Units**: Check if time-based metrics are using the most granular and sensible unit (e.g., if "Avg Time to Resolve" is typically 0.5 days, it should be converted and displayed as "12 hours" for better readability).
- **Clear Comparisons**: Ensure any "delta", "trend", or percentage change explicitly states what it is being compared to (e.g., "+100% from last month" rather than just "+100%"). Provide hover details to clarify comparison periods.

### 5. Output the Audit Report
Create an artifact named `[tab_name]_data_audit.md` (e.g., `cenro_dashboard_data_audit.md`) with the following format:

```markdown
# Data Audit Report: [Tab Name]

## 1. Metrics Analyzed
List the KPI cards or data tables analyzed.

## 2. API Endpoints Verified
List the backend endpoints supplying this data.

## 3. Findings & Discrepancies
- Highlight any logical bugs, missing statuses, or dangerous fallback math.
- Note if pagination is affecting aggregate totals.

## 4. Proposed Fixes
- Provide the exact code changes needed to fix any issues found.
```

### 6. Ask to Apply Fixes
After presenting the audit artifact, ask the user if they would like you to apply the proposed fixes to the codebase.
