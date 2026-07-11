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
  - If handling an action (saving, logging in), ensure a **Spinner** or disabling of the button is used.

## 3. Responsiveness Check
- **Mobile First**: Audit the Tailwind classes. Ensure `sm:`, `md:`, and `lg:` prefixes are used gracefully.
- Ensure no fixed widths break on small screens (use `w-full max-w-sm` instead of `w-96`, or hide unnecessary sidebars on mobile).

## 4. Execution & The 3x Test
- Apply the changes using the file editing tools.
- **Test 1**: Run `npm run lint` and `npm run build` in the frontend directory. Fix any TypeScript/Build errors.
- **Test 2**: Run backend test scripts if you touched any API data structures.
- **Test 3**: Output a "Manual Verification Checklist" for the user, detailing exactly what they need to click or view in the browser to confirm the UI is perfect.
