# Changelog

All notable changes to the EcoWatch SJDM project will be documented in this file.

## [Phase 1: Foundation] - 2026-03-08

### Added
- **Project Structure**: Initialized `frontend`, `backend`, `data`, and `logs` directories.
  - *Reason*: To separate concerns according to the modern tech stack (Next.js/FastAPI).
- **Eco-Dark Theme**: Implemented a premium dark theme and global CSS variables.
  - *Reason*: To provide a professional, high-aesthetic UI for the capstone.
- **Navbar & Root Layout**: Created a responsive navigation bar and standardized the application shell.
  - *Previous*: Default "Create Next App" boilerplate.
  - *Changes*: Custom branding (EcoWatch SJDM), glassmorphism styling, and mobile-first responsiveness.
  - *Reason*: To establish navigation and consistent branding across all portals.
- **Landing Page**: Designed a high-aesthetic hero section with feature overview cards.
  - *Previous*: Default Next.js starter page.
  - *Changes*: Custom copy, gradients, and Lucide icons.
  - *Reason*: To explain the project's purpose (AI + Geospatial) to stakeholders.
- **SJDM GeoJSON Data**: Integrated official high-resolution barangay boundaries for San Jose del Monte.
  - *Reason*: To power the Ray-Casting algorithm for automatic report tagging.
- **FastAPI Core**: Set up the backend microservice with all mapping and AI libraries.
  - *Reason*: To prepare for complex spatial logic and Mask R-CNN processing.

### Modified
- **.gitignore**: Expanded to include professional Node.js and Python exclusions.
  - *Reason*: To keep the GitHub repository clean and secure.
- **README.md**: Updated with a complete project overview and setup instructions.
  - *Reason*: To provide clear documentation for collaborators and graders.
