# Security Architecture

- **Authentication & Sessions**: Passwords hashed with `bcryptjs` (cost 12). Short-lived JWT access tokens (15m) reside strictly in JS memory (`src/services/api.ts`), never `localStorage` or `sessionStorage`. Refresh tokens rotate on every `/api/auth/refresh` call using `HttpOnly; Secure; SameSite=None; Partitioned` cookies protected by CSRF origin/header verification.
- **Role-Based Access Control (RBAC)**: Backend middleware (`requireRole`) enforces permissions on every administrative, catalog, circulation, fine, and settings endpoint. Public `/api/auth/register` is locked to `MEMBER`.
- **Input & NoSQL Sanitization**: Every request body and route parameter is validated with `zod`. Middleware recursively strips keys beginning with `$` or containing `.` to block NoSQL operator injection, and search regexes are escaped via `escapeRegex`.
- **Upload Security**: Cover uploads pass through Multer memory storage (3 MB limit), magic-byte binary inspection (`FF D8 FF`, `89 50 4E 47`, `RIFF....WEBP`), randomized UUID filenames, private `uploads/covers/` storage, and path-confinement validation (`resolvedPath.startsWith(baseDir + path.sep)`).
- **Headers & Rate Limiting**: Helmet security headers, strict dynamic CORS allowlist, and `express-rate-limit` on both auth and general API routes.
