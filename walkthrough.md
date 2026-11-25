# Security Summary

**Reviewed Files**: 42
**Issues Resolved**: 7
**Dependency Audit (`bun audit`)**: 0 known vulnerabilities across 413 packages

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Notification Access Control | `backend/src/routes/notificationRoutes.ts` | 31 | `PATCH /api/notifications/:id/read` updated any notification by ID without checking whether the signed-in user or role was an intended recipient. | High | Fixed | Scoped the update query to match `recipientUserId`, `recipientRole`, or `'ALL'`, returning `404` when no matching notification exists. |
| Dashboard Patron & Audit Data Scoping | `backend/src/routes/dashboardRoutes.ts` | 248 | `GET /api/dashboard` returned `overdueAlerts` (including member emails), staff circulation lists, and `AuditLog` entries to `MEMBER` accounts. | High | Fixed | Gated staff activity lists, overdue patron alerts, and audit log entries behind `isStaff` (`SUPER_ADMIN` or `LIBRARIAN`) so member tokens receive empty arrays. |
| WebSocket Session Revocation | `backend/src/app.ts` | 97 | Socket.IO handshake verified JWT signature/expiry without checking whether the session was revoked or the account disabled. | Medium | Fixed | Updated `io.use` to asynchronously validate `Session` (`!isRevoked` and unexpired) and `User.isActive` before allowing connection. |
| Session Invalidation on Password Change | `backend/src/routes/authRoutes.ts` | 422 | Updating a password via `PUT /api/auth/profile` left existing refresh sessions active on other devices. | Medium | Fixed | Revoked all other active sessions (`_id: { $ne: req.sessionId }`) in MongoDB immediately after password update. |
| Unsafe URL Scheme Validation | `backend/src/validators/schemas.ts` | 3 | Book cover URLs and author/publisher website fields accepted arbitrary strings including `javascript:` or `data:` URLs. | Medium | Fixed | Added `safeAssetOrHttpUrl` and `safeWebsiteUrl` Zod refinements permitting only `http(s):` or traversal-free internal asset paths. |
| Spreadsheet Formula Injection | `backend/src/routes/bookRoutes.ts` | 99 | Server CSV exports and client delimited exports (`src/utils/csvExport.ts:9`) quoted cell values without neutralizing leading formula operators. | Medium | Fixed | Prefixed leading `=`, `+`, `-`, `@`, `\t`, and `\r` cell values with a single quote (`'`) on both server and client CSV/Excel exports. |
| Query Parameter & Date Validation | `backend/src/routes/reportRoutes.ts` | 21 | Malformed report date filters (`from`/`to`) or `NaN` pagination inputs (`backend/src/routes/bookRoutes.ts:15`) caused Mongoose query errors. | Low | Fixed | Rejected invalid report date filters with `400 Bad Request` and added `Number.isFinite` clamping on book pagination inputs. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Authentication & Sessions | `backend/src/middleware/auth.ts` | Uses bcrypt (cost 12), in-memory 15-minute JWT access tokens, `HttpOnly; Secure; SameSite=None; Partitioned` refresh token rotation, and DB-backed session revocation. |
| Privilege & Role Enforcement | `backend/src/routes/authRoutes.ts` | Locks `/api/auth/register` strictly to `MEMBER` and requires `SUPER_ADMIN` / `LIBRARIAN` via `requireRole` for administrative endpoints. |
| NoSQL Injection & Headers | `backend/src/middleware/security.ts` | Recursively strips `$`-prefixed and `.`-containing keys from request payloads, applies Helmet CSP headers, dynamic CORS allowlist, and rate limiting. |
| File Upload Safety | `backend/src/middleware/upload.ts` | Validates JPEG/PNG/WebP magic bytes in memory, writes randomized UUID filenames to a private directory, and enforces path confinement on downloads. |
| Dependency Security | `package.json` | Audited lockfile (`bun audit` across 413 packages) with zero reported vulnerabilities. |

## PoC Verification

### 1. Cross-User Notification Modification (Notification Access Control)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Ownership / Role Check on Update |
| Impact | High |
| Affected File | `backend/src/routes/notificationRoutes.ts:31` |
| Test Scenario | Member sends `PATCH /api/notifications/<librarianOnlyId>/read` targeting a `LIBRARIAN`-only notification ID. |

#### How It Was Fixed
Changed `Notification.findByIdAndUpdate` to `Notification.findOneAndUpdate` constrained by the caller's user ID, role, or `'ALL'` broadcast scope.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Member bearer token arrives at `PATCH /api/notifications/:id/read` | `authenticate` populates `req.user` (`role: 'MEMBER'`) |
| 2 | `Notification.findOneAndUpdate` filters by `_id` AND `$or: [{ recipientUserId }, { recipientRole: 'MEMBER' }, { recipientRole: 'ALL' }]` | Librarian-only document does not match filter |
| 3 | `if (!updated)` triggers at line 43 | Returns **`404 Not Found` (Handled Safely)** |

#### Conclusion
**Fix Verified** — A member account can no longer read or modify notifications targeted exclusively to librarians or other users.

---

### 2. Patron Email & Audit Log Exposure on Member Dashboard

#### Summary
| Field | Value |
|---|---|
| Issue Type | Over-Broad Data Disclosure to Standard Member |
| Impact | High |
| Affected File | `backend/src/routes/dashboardRoutes.ts:248` |
| Test Scenario | Member sends `GET /api/dashboard` and inspects `lists.overdueAlerts`, `lists.recentlyIssued`, and `lists.recentActivities`. |

#### How It Was Fixed
Added an `isStaff` role check (`SUPER_ADMIN` or `LIBRARIAN`) before returning staff circulation queues, patron overdue alerts containing emails, or system audit logs.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Member token calls `GET /api/dashboard` | `req.user.role` resolves to `'MEMBER'` |
| 2 | `isStaff` evaluates to `false` at line 217 | Staff-only list fields resolve to `[]` at lines 248–252 |
| 3 | Response payload is serialized | Member receives KPIs and personal loans with **0 leaked patron emails or audit logs** |

#### Conclusion
**Fix Verified** — Staff circulation feeds, patron overdue contact records, and audit trails are excluded from member dashboard responses.

---

### 3. Revoked Session Access on Socket.IO Connections

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Session Revocation Check on WebSocket |
| Impact | Medium |
| Affected File | `backend/src/app.ts:97` |
| Test Scenario | Client attempts WebSocket handshake with an unexpired access token whose `Session` document has `isRevoked: true` (or user `isActive: false`). |

#### How It Was Fixed
Made the `io.use` middleware asynchronous and added database verification of the `Session` revocation/expiry state and `User.isActive` flag.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Socket handshake supplies bearer access token | Signature verified at `backend/src/app.ts:96` |
| 2 | `Session.findById(payload.sessionId)` and `User.findById(payload.sub)` run at lines 97–104 | Detects `session.isRevoked === true` or `!user.isActive` |
| 3 | Middleware invokes `next(new Error('Unauthorized'))` | Connection is **Rejected Before Room Join** |

#### Conclusion
**Fix Verified** — Revoked sessions and deactivated accounts cannot establish or maintain Socket.IO connections.

---

### 4. Unsafe URL Scheme Submission & Spreadsheet Formula Injection

#### Summary
| Field | Value |
|---|---|
| Issue Type | Dangerous URL Scheme & CSV Formula Injection |
| Impact | Medium |
| Affected File | `backend/src/validators/schemas.ts:3`, `backend/src/routes/bookRoutes.ts:99` |
| Test Scenario | Submitting `coverImageUrl: "javascript:alert(1)"` on `POST /api/books`, or exporting a book titled `=CMD("calc")` via `/api/books/export/csv`. |

#### How It Was Fixed
Enforced `http(s):` or validated internal paths in Zod schemas and escaped leading `=`, `+`, `-`, `@`, tab, and carriage return characters with `'` in CSV/TSV generators.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `javascript:alert(1)` enters `POST /api/books` | `safeAssetOrHttpUrl` fails `URL.protocol` check -> **`400 Bad Request`** |
| 2 | Book titled `=CMD("calc")` is exported via `GET /api/books/export/csv` | `escapeCsv` at `bookRoutes.ts:99` prefixes `'` |
| 3 | Output cell serialized in response | Emits `"'=CMD(""calc"")"` (**Formula Execution Neutralized**) |

#### Conclusion
**Fix Verified** — Unsafe `javascript:` URLs are blocked at API validation and exported spreadsheets safely neutralize formula prefixes.
