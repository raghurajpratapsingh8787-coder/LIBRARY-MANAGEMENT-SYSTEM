# API Reference

All `/api/*` endpoints return JSON (except CSV export) and require a valid `Authorization: Bearer <accessToken>` header unless marked public.

## Authentication (`/api/auth`)
- `GET /api/auth/status` *(Public)* — Returns workspace bootstrap state and registration policy.
- `POST /api/auth/bootstrap` *(Public, one-time)* — Claims the initial `SUPER_ADMIN` account when none exists.
- `POST /api/auth/login` *(Public)* — Verifies credentials, issues 15m JWT access token and sets `HttpOnly` refresh cookie.
- `POST /api/auth/register` *(Public)* — Registers a new `MEMBER` account (strictly locked to `MEMBER` role).
- `POST /api/auth/refresh` *(Cookie + CSRF check)* — Rotates refresh token and returns a fresh access token.
- `POST /api/auth/logout` *(Cookie + CSRF check)* — Revokes active session and clears refresh cookie.
- `POST /api/auth/forgot-password` / `POST /api/auth/reset-password` *(Public)* — Time-limited password recovery flow.
- `GET /api/auth/me` / `PUT /api/auth/profile` — View and update personal profile/password.
- `GET /api/auth/sessions` / `DELETE /api/auth/sessions/:id` — List and revoke active sessions.
- `GET /api/auth/users` / `POST /api/auth/users` / `PATCH /api/auth/users/:id/toggle` *(SUPER_ADMIN)* — Manage staff and admin accounts.

## Books & Taxonomy (`/api/books`, `/api/taxonomy`)
- `GET /api/books` — Search, filter, sort, and paginate catalog books.
- `GET /api/books/:id` — Retrieve book metadata and physical `BookCopy` accession records.
- `POST /api/books` / `PUT /api/books/:id` / `DELETE /api/books/:id` *(SUPER_ADMIN, LIBRARIAN)* — Create/update/delete books and sync physical copies.
- `POST /api/books/upload-cover` *(SUPER_ADMIN, LIBRARIAN)* — Upload validated JPEG/PNG/WebP cover image.
- `GET /api/books/export/csv` *(SUPER_ADMIN, LIBRARIAN)* — Export book directory CSV.
- `GET/POST/PUT/DELETE /api/taxonomy/categories|authors|publishers` — Manage taxonomy records.

## Members, Circulation, Reservations & Fines
- `GET/POST/PUT/DELETE /api/members` *(SUPER_ADMIN, LIBRARIAN)* and `GET /api/members/:id` *(owner-checked for MEMBER)*.
- `GET /api/circulation/transactions` & `GET /api/circulation/overdue`.
- `POST /api/circulation/issue` & `POST /api/circulation/return` *(SUPER_ADMIN, LIBRARIAN)* — Atomic inventory and fine updates.
- `GET/POST /api/reservations` & `PATCH /api/reservations/:id/cancel|fulfill`.
- `GET /api/fines`, `POST /api/fines/:id/pay` *(SUPER_ADMIN, LIBRARIAN)*, `POST /api/fines/:id/waive` *(SUPER_ADMIN)*.
- `GET /api/reports/:type` *(SUPER_ADMIN, LIBRARIAN)* — 12 live MongoDB aggregation reports.
- `GET/PUT /api/settings` & `GET /api/settings/audit-logs` *(SUPER_ADMIN)*.
