# 🧪 EcoWatch SJDM — Testing Checklist
> Use this as your "Definition of Done" before closing any GitHub Issue.

---

## 🛠️ BACKEND (API) TESTING
*Test these using **Postman** or **cURL**.*

### 1. The Happy Path (Success)
- [ ] **Status 200/201:** Did the request succeed?
- [ ] **Data Integrity:** Is the JSON response exactly what the frontend expects?
- [ ] **Database Check:** Did the record actually change in the DB? (Check via another GET request).
- [ ] **Audit Log:** If it was an admin action, was a row added to the `AuditLog` table?

### 2. The Sad Path (Error Handling)
- [ ] **Status 400/422:** If I send empty fields or bad data, does it give a clear error?
- [ ] **No 500s:** The server should NEVER crash. If it does, you need a `try/except` block.
- [ ] **Logic Checks:** Can I "Deploy" a report that is already "Resolved"? (Should be blocked).

### 3. Security (RBAC)
- [ ] **Status 401:** What if I don't send the `X-User-Id` header?
- [ ] **Status 403:** What if a `citizen` tries to call a `barangay` or `cenro` endpoint?
- [ ] **Scope:** Can a Barangay User see or edit reports from a *different* Barangay?

### 4. Edge Cases
- [ ] **Empty State:** What happens if I fetch a list and the DB is empty? (Should return `[]`).
- [ ] **Special Characters:** Do emojis or long text break the database?

---

## 🎨 FRONTEND (UI/UX) TESTING
*Test these by clicking around the web app.*

### 1. Visual Feedback
- [ ] **Loading States:** Do Skeletons or Spinners appear while waiting for the API?
- [ ] **Toasts:** Does a "Success" or "Error" notification pop up after an action?
- [ ] **Empty States:** Is there a "No reports found" message if the list is empty?

### 2. Robustness
- [ ] **Button Debouncing:** Does the button disable after one click to prevent double-submissions?
- [ ] **Validation:** Does the form prevent me from clicking "Submit" if fields are empty?
- [ ] **Error Messaging:** If the API fails (e.g., 500 error), does the UI show a "Something went wrong" message instead of just hanging?

### 3. Responsiveness
- [ ] **Mobile Check:** Does the table or map look usable on a phone screen?
- [ ] **Browser Check:** Does it work in both Chrome and Edge?

---

## 🚀 OFF-LINE READINESS (Defense Special)
- [ ] **Localhost Only:** Can I run the full flow with my Wi-Fi turned OFF?
- [ ] **Local Images:** Are images loading from the local `/uploads` folder, not an external URL?
