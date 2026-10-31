# How to Test EcoWatch Locally on Any Mobile Phone 📱

A step-by-step guide to testing the EcoWatch frontend and backend on your physical mobile device over the local network or via dev tunnels.

---

## Method 1: Local Wi-Fi Network (LAN)

### Prerequisites
- Both your **PC and your phone** must be connected to the **same Wi-Fi network**.

---

### Step 1: Find your PC's Local IP Address
1. On your PC, open **Terminal** / **PowerShell** / **Command Prompt**.
2. Run:
   ```powershell
   ipconfig
   ```
3. Look for your active Wi-Fi adapter and copy the **IPv4 Address** (e.g. `192.168.100.60` or `192.168.1.15`).

---

### Step 2: Update Frontend Environment
1. Open [`frontend/.env.local`](file:///c:/Users/Renzo%20Boyonas/OneDrive/Documents/3rd%20YR%202nd%20SEM/EcoWatch/frontend/.env.local).
2. Set `NEXT_PUBLIC_API_URL` to your PC's IP address on port `8000`:
   ```env
   NEXT_PUBLIC_API_URL=http://<YOUR_PC_IP>:8000
   ```
   *(Example: `NEXT_PUBLIC_API_URL=http://192.168.100.60:8000` — do NOT include a trailing slash).*

---

### Step 3: Start the Backend (Host 0.0.0.0)
The backend must listen on all network interfaces (`0.0.0.0`), not just localhost:

```powershell
cd backend
.\venv_tf\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Step 4: Start the Frontend (Host 0.0.0.0)
The Next.js server must also listen on all network interfaces:

```powershell
cd frontend
npm run dev -- -H 0.0.0.0
```

---

### Step 5: Open EcoWatch on Your Phone
Open Chrome or Safari on your phone and navigate to:
```text
http://<YOUR_PC_IP>:3000
```
*(Example: `http://192.168.100.60:3000`)*

---

### Step 6: Fix Camera & Location Permissions (Chrome Android Flag)

> [!IMPORTANT]
> Mobile browsers (especially Chrome on Android) **strictly disable the Camera (`getUserMedia`) and Location (GPS)** on unencrypted HTTP IP addresses for security reasons. They will show `"Connection is not secure"` and block camera access without prompting.

To allow Camera and GPS on your local IP address:

1. In your phone's Chrome browser, open a new tab and go to:
   ```text
   chrome://flags
   ```
2. In the search box, search for:
   ```text
   unsafely-treat-insecure-origin-as-secure
   ```
3. Change the dropdown from **Disabled** to **Enabled**.
4. In the text area that appears below, enter your PC's IP with both ports:
   ```text
   http://<YOUR_PC_IP>:3000,http://<YOUR_PC_IP>:8000
   ```
   *(Example: `http://192.168.100.60:3000,http://192.168.100.60:8000`)*
5. Tap the blue **Relaunch** button at the bottom of Chrome.
6. Return to `http://<YOUR_PC_IP>:3000` and reload. When prompted, tap **Allow** for Camera and Location!

---

## Method 2 (Alternative): VS Code Port Forwarding (Automatic HTTPS)

If you do not want to configure Chrome flags, you can use VS Code's built-in port forwarding tunnel. Because it provides a secure `https://` domain, mobile browsers allow camera and GPS natively.

### Steps:
1. In VS Code, open the **Ports** tab (next to Terminal in the bottom panel).
2. Click **Forward a Port** and add:
   - **`3000`** (Frontend)
   - **`8000`** (Backend)
3. **Change Port Visibility to Public**:
   - Right-click port **3000** → **Port Visibility** → **Public**
   - Right-click port **8000** → **Port Visibility** → **Public**
   *(If left as Private, mobile browsers receive a 401 Unauthorized GitHub login screen).*
4. Copy the public **Forwarded Address** for port **8000** (e.g. `https://xxxx-8000.app.github.dev` or `devtunnels.ms`).
5. In [`frontend/.env.local`](file:///c:/Users/Renzo%20Boyonas/OneDrive/Documents/3rd%20YR%202nd%20SEM/EcoWatch/frontend/.env.local), update:
   ```env
   NEXT_PUBLIC_API_URL=https://xxxx-8000.app.github.dev
   ```
6. Restart the frontend (`npm run dev`).
7. Open the **Port 3000** HTTPS URL on your phone!

---

## 🛠️ Quick Troubleshooting Checklist

| Issue | Likely Cause | Solution |
|---|---|---|
| **Site cannot be reached** | Windows Defender Firewall blocking port `3000` or `8000` | In Windows Defender Firewall, allow Python and Node.js through private networks. |
| **Backend Unavailable / Network Error** | `NEXT_PUBLIC_API_URL` still set to `127.0.0.1:8000` | Update [`frontend/.env.local`](file:///c:/Users/Renzo%20Boyonas/OneDrive/Documents/3rd%20YR%202nd%20SEM/EcoWatch/frontend/.env.local) with your PC's IP / tunnel URL and restart `npm run dev`. |
| **Camera Access Blocked** | HTTP origin blocked by mobile browser | Follow Step 6 to enable the Chrome flag or switch to Method 2 (HTTPS). |
| **401 Unauthorized on tunnel** | VS Code port is set to Private | Right-click the forwarded port in VS Code and change Visibility to **Public**. |
