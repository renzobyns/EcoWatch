# Visily AI Brief — EcoWatch Module 1 (Report Submission)

_Paste the block below into Visily AI to generate the Module 1 wireframes. Updated 2026-06-07._

---

**Project:** EcoWatch SJDM — a mobile-first web app for citizens to photo-report illegal garbage
dumping in San Jose del Monte (SJDM), Bulacan. Dark green eco theme. This is the **report-submission
flow (Module 1)**.

**Key rule:** the citizen **never sets or moves the location** — it comes **only from the photo's
geotag** (live camera GPS, or an uploaded photo's embedded EXIF GPS). There is no manual pin, no
"confirm location" map step, and no way to type coordinates.

**Design 5 mobile screens + their states:**

**1. home/landing › report — Login gate**
Shown only if not signed in. App logo, line "Sign in so your report can be verified," Email +
Password fields, "Sign In" button, "Create account" link.

**2. home/landing › report › add photo — Photo source chooser**
Title "Add evidence photo." Two stacked buttons: **📷 Take Photo** (primary) and **⬆ Upload from
Gallery** (secondary). Helper text: "Camera gives the fastest, most trusted report." Step indicator
"1 of 2."

**3. home/landing › report › add photo › open cam — In-app geo-tag camera**
Full-screen live viewfinder. Bottom-corner semi-transparent **location stamp** burned onto the shot:
"Brgy. San Roque • 14.8245°N, 121.1006°E • Jun 7 2026 3:42 PM • ±8m." Big round shutter button;
thumbnail strip (up to 5 photos). States:
- (a) "Requesting camera + location permission"
- (b) "Getting your location… ±Nm"
- (c) "Camera/Location denied" error + "Try again"
- (d) **Outside-SJDM reject** — "This spot is outside San Jose del Monte, so it can't be reported here."

**4. home/landing › report › upload photo — Gallery upload + validation**
Gallery picker, then a review of the picked photo. States:
- (a) **Accepted** — photo + green "📍 Location found" badge
- (b) **No-geotag reject** — red banner "This photo has no location data. Please use the in-app
  camera instead," only "Use Camera" / "Pick another" buttons
- (c) **Outside-SJDM reject** — "This photo was taken outside San Jose del Monte."

**5. home/landing › report › review & submit — Review**
Photo thumbnails; a **read-only location card** "📍 Brgy. San Roque (from your photo)" with a tiny
map preview — *not editable*; optional **Notes** box; primary "Submit Report" button. After submit:
success screen with a **tracking ID** (e.g. "EW-0042") + "Track this report" link.

---

## Notes for the designer (not for Visily)

- Screens 3 and 4 are the two halves of "add photo" — the user reaches one or the other from
  screen 2, never both at once.
- There is deliberately **no map-pinning screen**. The old manual-pin map is removed from the
  citizen flow.
- The location only ever appears as **read-only info** (screen 5), because it's derived from the
  photo and the citizen can't change it.
