---
"@kontrolia/db": minor
---

Organization admins/owners can now enable or disable a registered application for their own organization directly from admin-panel — closing a gap where `kontrolia.application_organizations` had no write policy, so nothing ever populated it and Aplicaciones/Permisos/Roles stayed empty even after registering an application. The application catalog itself is also now browsable by any authenticated user (previously an app only became visible once already enabled for one of your orgs, a chicken-and-egg problem).
