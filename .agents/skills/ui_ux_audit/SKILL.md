---
name: ui-ux-audit
description: Trigger this to perform a comprehensive UI/UX polish, responsiveness check, and loader audit on a page.
---

# UI/UX & Quality Audit Workflow

When the user calls this skill on a specific page or component, follow these steps sequentially:

## 1. Visual & Aesthetics Pass
- **Review Code**: Read the target component's code.
- **Glassmorphism & Theming**: Ensure `bg-background`, `text-foreground`, and `border-border` are correctly utilized so Light and Dark mode work seamlessly. Check if the element should use the custom `glass` class.
- **Micro-interactions**: Ensure buttons and links have `hover:`, `focus:`, and smooth transition states (e.g., `transition-colors`, `transition-all`).
- **Empty/Error States**: Check the logic. If there is a potential empty state (e.g., empty array) or loading error, implement a polished fallback UI (don't just return `null` or raw text).

## 2. Loader Verification
- Ensure the right loader paradigm is used:
  - If loading data structure (lists, tables, feeds), ensure **Skeletal UI** (`animate-pulse`) is used. Add `loading.tsx` to the route if applicable.
  - **CRITICAL**: A Skeletal UI must NOT just be an empty box or layout container. It MUST contain internal placeholder elements (e.g., pulsing lines for text, pulsing circles for avatars/charts) to accurately mimic the structure of the incoming data.
  - If handling an action (saving, logging in), ensure a **Spinner** or disabling of the button is used.

## 3. Responsiveness Check
- Verify that the layout does not break or overflow horizontally on `sm` and `md` breakpoint screens.
- Use `flex-col` or `grid-cols-1` on mobile, scaling up to `flex-row` or multi-column grids on desktop.

## 4. Professional Aesthetic (Shadcn / Vercel Look)
When building or auditing UI, STRICTLY avoid the "AI-generated sci-fi" look. Follow these modern, minimalist principles:
- **Card Containers:** Use flat, solid backgrounds (`bg-card`, `bg-background`) with subtle borders (`border border-border`) and minimal shadows (`shadow-sm`). AVOID heavy `glass` or `backdrop-blur` classes unless strictly required for a specific z-index overlay. **CRITICAL:** Always explicitly pair `border` with `border-border` (and use `border-border` instead of `border-input` for inputs to avoid bright white outlines), otherwise Tailwind defaults to a highly visible bright gray/white line. AVOID left-side or top-side colored border highlight bands (e.g. `border-l-4 border-l-yellow-400`) on card containers; rely on status badges inside the cards instead. For interactive/clickable cards, use hover styles like `hover:border-primary/50 hover:shadow-md transition-all duration-200`.
- **Border Radii:** Stick to `rounded-lg` or `rounded-xl`. NEVER use extreme rounding like `rounded-2xl` or `rounded-[2rem]` for dashboard cards.
- **Typography:**
  - Headers/Labels: Use sentence case or title case. E.g., `text-sm font-medium text-muted-foreground`. AVOID `uppercase tracking-widest text-[10px]`.
  - Metrics: Primary numbers must be `text-2xl font-bold text-foreground` (or `text-3xl`). Do not color the entire number with vibrant neon colors (`text-emerald-500`).
- **Icons & Empty States:** NEVER use emojis (e.g., 📋 or ❌) for UI elements or empty states, as they look cheap and AI-generated. ALWAYS use outline icons from `lucide-react` (e.g., `<ClipboardList />`, `<X />`) to maintain a professional, native application feel.
- **Buttons & Interactions:** Always ensure buttons have visible `hover:` backgrounds and foregrounds. For destructive or forcing actions, ensure they have a bold, distinct color (e.g., `bg-red-600 hover:bg-red-700 text-white`). For disabled buttons, you MUST explicitly include `disabled:cursor-not-allowed` so the user knows the button is inactive.
- **Spacing:** Use Shadcn's card standard: a header `div` with `p-6 pb-2` and a content `div` with `p-6 pt-0`. If using tighter spaces, use `p-4 pb-2` and `p-4 pt-0`. Avoid massive empty padding.
- **Accents:** Use vibrant colors sparingly. Restrict them to small badges, icons, or trend indicators. Never apply heavy glowing drop-shadows (`shadow-[0_0_15px_...]`) to text or icons.
- **Consistent Coloring (No Rainbows):** Avoid coloring arbitrary sections, icons, or KPI cards with distinct distinct colors (blue, yellow, green, red) just to make them look different. Stick to a monochromatic layout utilizing the brand's `primary` color and `muted` backgrounds. Only use semantic status colors (destructive/red, warning/yellow, success/green) for items that strictly convey an active state or alert.
- **Sticky Table Headers:** When making table headers sticky (`sticky top-0`), ALWAYS use a solid, opaque background (e.g., `bg-card` or `bg-background` matching the parent container) instead of transparent or translucent backgrounds like `bg-foreground/[0.02]` or `bg-muted/30`. Otherwise, the scrolling rows will overlap and show through underneath the header text.

## 5. Execution & The 3x Test
- Apply the changes using the file editing tools.
- **Test 1**: Run `npm run lint` and `npm run build` in the frontend directory. Fix any TypeScript/Build errors.
- **Test 2**: Run backend test scripts if you touched any API data structures.
- **Test 3**: Output a "Manual Verification Checklist" for the user, detailing exactly what they need to click or view in the browser to confirm the UI is perfect.
