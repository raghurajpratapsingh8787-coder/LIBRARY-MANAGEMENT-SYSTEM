# Database Architecture (MongoDB & Mongoose)

Folio Ledger implements 16 Mongoose collections with referential integrity, unique constraints, and atomic WiredTiger transactions:

1. **User** — Accounts (`SUPER_ADMIN`, `LIBRARIAN`, `MEMBER`), bcrypt password hashes, reset tokens.
2. **Book** — Bibliographic titles, unique `bookCode` & `isbn`, `availableCopies <= totalCopies` validator, text index.
3. **BookCopy** — Individual physical copy tracking via unique `accessionNumber` and `barcode`.
4. **Author** — Author registry with text search index.
5. **Publisher** — Publisher directory.
6. **Category** — Subject classifications with unique `code` and `shelfZone`.
7. **Member** — Patron profiles, membership tier (`STUDENT`, `FACULTY`, `STAFF`, `GENERAL`), borrowing limits, expiry, and fine balance.
8. **IssueTransaction** — Active/historical checkouts with a partial unique index on `{ bookCopyId, status }` preventing concurrent double-issue of the same physical copy.
9. **ReturnTransaction** — Check-in records linked uniquely (`1:1`) to `IssueTransaction`.
10. **Reservation** — Waitlist queue with a partial unique index on `{ bookId, memberId, status }` preventing duplicate active reservations.
11. **Fine** — Overdue assessments calculated strictly on the backend.
12. **FinePayment** — Payment and waiver receipts.
13. **Notification** — Persisted & real-time Socket.IO alerts.
14. **AuditLog** — Immutable security and circulation audit trail.
15. **Session** — SHA-256 hashed refresh sessions with revocation support.
16. **LibrarySettings** — Configurable daily fine rate, max fine cap, grace period, and borrowing limits.
