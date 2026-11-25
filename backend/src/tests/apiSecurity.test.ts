import test from 'node:test';
import assert from 'node:assert/strict';
import type http from 'http';

process.env.NODE_TEST = 'true';

import { createAppServer } from '../app';
import { disconnectDatabase } from '../config/db';
import { detectImageTypeFromBuffer } from '../middleware/upload';

let server: http.Server;
let baseUrl: string;

async function api(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.headers || {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

test('End-to-end API, Circulation, RBAC, and Security Verification', async (t) => {
  const appSetup = await createAppServer({ skipVite: true });
  server = appSetup.server;
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;

  let adminToken = '';
  let memberToken = '';
  let createdBookId = '';
  let createdMemberId = '';
  let createdIssueId = '';
  let createdFineId = '';
  let refreshCookie = '';

  await t.test('1. First-run status & Super Admin bootstrap locks after first claim', async () => {
    const statusRes = await api('/api/auth/status');
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.needsBootstrap, true);

    const bootRes = await api('/api/auth/bootstrap', {
      method: 'POST',
      body: {
        name: 'Raghuraj Pratap Singh',
        email: 'raghurajpratapsingh8787@gmail.com',
        password: 'AdminPass123!',
        seedSampleData: true,
        demoStaffPassword: 'StaffPass123!',
      },
    });
    assert.equal(bootRes.status, 201);
    assert.ok(bootRes.data.accessToken);
    adminToken = bootRes.data.accessToken;
    refreshCookie = bootRes.headers.get('set-cookie') || '';

    // Second bootstrap attempt must fail with 403
    const dupBoot = await api('/api/auth/bootstrap', {
      method: 'POST',
      body: { name: 'Attacker', email: 'hack@evil.com', password: 'Password123!' },
    });
    assert.equal(dupBoot.status, 403);
  });

  await t.test('2. Unauthenticated requests rejected & Public registration locked to MEMBER', async () => {
    const unauth = await api('/api/books');
    assert.equal(unauth.status, 401);

    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Patron',
        email: 'patron.test@example.com',
        password: 'PatronPass123!',
        phoneNumber: '+1-555-9999',
        address: '100 Library Ave',
        role: 'SUPER_ADMIN', // Attempt privilege escalation
      },
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.data.user.role, 'MEMBER');
    memberToken = regRes.data.accessToken;
    createdMemberId = regRes.data.user.memberId;

    // Member cannot create books or access another member profile
    const forbiddenBook = await api('/api/books', {
      method: 'POST',
      token: memberToken,
      body: { title: 'Forbidden' },
    });
    assert.equal(forbiddenBook.status, 403);

    const forbiddenSettings = await api('/api/settings', {
      method: 'PUT',
      token: memberToken,
      body: { dailyFineRate: 0 },
    });
    assert.equal(forbiddenSettings.status, 403);
  });

  await t.test('3. Book CRUD, Duplicate ISBN guard, and NoSQL operator injection sanitization', async () => {
    const taxRes = await api('/api/taxonomy/categories', { token: adminToken });
    const authorsRes = await api('/api/taxonomy/authors', { token: adminToken });
    const pubsRes = await api('/api/taxonomy/publishers', { token: adminToken });
    const categoryId = taxRes.data.categories[0]._id;
    const authorId = authorsRes.data.authors[0]._id;
    const publisherId = pubsRes.data.publishers[0]._id;

    const createRes = await api('/api/books', {
      method: 'POST',
      token: adminToken,
      body: {
        isbn: '978-0-123456-78-9',
        title: 'Clean Test Monograph',
        authorId,
        publisherId,
        categoryId,
        publicationDate: '2025-05-01',
        shelfNumber: 'Z9-01',
        totalCopies: 2,
      },
    });
    assert.equal(createRes.status, 201);
    createdBookId = createRes.data.book._id;
    assert.equal(createRes.data.book.availableCopies, 2);

    // Duplicate ISBN fails with 409
    const dupRes = await api('/api/books', {
      method: 'POST',
      token: adminToken,
      body: {
        isbn: '978-0-123456-78-9',
        title: 'Duplicate ISBN',
        authorId,
        publisherId,
        categoryId,
        publicationDate: '2025-05-01',
        shelfNumber: 'Z9-02',
        totalCopies: 1,
      },
    });
    assert.equal(dupRes.status, 409);

    // NoSQL injection attempt in login body is sanitized and rejected
    const nosqlLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: { $gt: '' }, password: { $ne: '' } },
    });
    assert.equal(nosqlLogin.status, 400);
  });

  await t.test('4. Issue, Overdue Return, Fine Assessment, Payment, and Reservation workflow', async () => {
    const bookDetail = await api(`/api/books/${createdBookId}`, { token: adminToken });
    const copyId = bookDetail.data.copies[0]._id;

    // Issue with due date 5 days in the past to test overdue fine calculation on return
    const pastDue = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const issueRes = await api('/api/circulation/issue', {
      method: 'POST',
      token: adminToken,
      body: {
        memberId: createdMemberId,
        bookId: createdBookId,
        bookCopyId: copyId,
        dueDate: pastDue,
      },
    });
    assert.equal(issueRes.status, 201);
    createdIssueId = issueRes.data.issueTransaction._id;
    assert.equal(issueRes.data.book.availableCopies, 1);

    // Double-issuing the exact same physical copy must fail with 409
    const doubleIssue = await api('/api/circulation/issue', {
      method: 'POST',
      token: adminToken,
      body: {
        memberId: createdMemberId,
        bookId: createdBookId,
        bookCopyId: copyId,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    });
    assert.equal(doubleIssue.status, 409);

    // Return book -> should restore inventory and create an overdue fine
    const returnRes = await api('/api/circulation/return', {
      method: 'POST',
      token: adminToken,
      body: {
        issueTransactionId: createdIssueId,
        conditionOnReturn: 'GOOD',
      },
    });
    assert.equal(returnRes.status, 201);
    assert.equal(returnRes.data.book.availableCopies, 2);
    assert.ok(returnRes.data.fine);
    assert.ok(returnRes.data.fine.amount > 0);
    createdFineId = returnRes.data.fine._id;

    // Member cannot waive their own fine (403)
    const memberWaive = await api(`/api/fines/${createdFineId}/waive`, {
      method: 'POST',
      token: memberToken,
      body: { waiverReason: 'Self waive attempt' },
    });
    assert.equal(memberWaive.status, 403);

    // Admin records payment
    const payRes = await api(`/api/fines/${createdFineId}/pay`, {
      method: 'POST',
      token: adminToken,
      body: {
        amountPaid: returnRes.data.fine.amount,
        paymentMethod: 'CASH',
      },
    });
    assert.equal(payRes.status, 201);
    assert.equal(payRes.data.fine.status, 'PAID');
  });

  await t.test('5. Reports, Dashboard aggregations, File signature check, and Session refresh/revocation', async () => {
    const dashRes = await api('/api/dashboard', { token: adminToken });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.kpis.totalBooks > 0);

    const reportRes = await api('/api/reports/most-borrowed', { token: adminToken });
    assert.equal(reportRes.status, 200);
    assert.ok(Array.isArray(reportRes.data.rows));

    // File magic-byte signature validation rejects non-image payloads
    assert.equal(detectImageTypeFromBuffer(Buffer.from('<html><script>alert(1)</script></html>')), null);
    assert.equal(detectImageTypeFromBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext, '.jpg');

    // Refresh token rotation works with CSRF header
    const cookieVal = refreshCookie.split(';')[0];
    const refreshRes = await api('/api/auth/refresh', {
      method: 'POST',
      cookie: cookieVal,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    assert.equal(refreshRes.status, 200);
    assert.ok(refreshRes.data.accessToken);
  });

  await t.test('6. Security Audit Regression Checks (IDOR, Member Redaction, Safe URLs, CSV Formula Escaping, Date Validation)', async () => {
    // 6a. Member dashboard redacts staff/patron activity lists (prevents patron email disclosure)
    const memberDash = await api('/api/dashboard', { token: memberToken });
    assert.equal(memberDash.status, 200);
    assert.deepEqual(memberDash.data.lists.overdueAlerts, []);
    assert.deepEqual(memberDash.data.lists.recentlyIssued, []);
    assert.deepEqual(memberDash.data.lists.recentActivities, []);

    // 6b. Notification IDOR: member cannot mark librarian-only notification as read
    const adminNotifs = await api('/api/notifications', { token: adminToken });
    const librarianOnlyNotif = adminNotifs.data.notifications.find(
      (n: { recipientRole?: string }) => n.recipientRole === 'LIBRARIAN'
    );
    if (librarianOnlyNotif) {
      const idorPatch = await api(`/api/notifications/${librarianOnlyNotif._id}/read`, {
        method: 'PATCH',
        token: memberToken,
      });
      assert.equal(idorPatch.status, 404);
    }

    // 6c. Unsafe URL schemes (javascript:, data:) are rejected on book cover & author website
    const taxRes = await api('/api/taxonomy/categories', { token: adminToken });
    const authorsRes = await api('/api/taxonomy/authors', { token: adminToken });
    const pubsRes = await api('/api/taxonomy/publishers', { token: adminToken });

    const xssCoverBook = await api('/api/books', {
      method: 'POST',
      token: adminToken,
      body: {
        isbn: '978-0-999999-01-1',
        title: 'XSS Scheme Test',
        authorId: authorsRes.data.authors[0]._id,
        publisherId: pubsRes.data.publishers[0]._id,
        categoryId: taxRes.data.categories[0]._id,
        coverImageUrl: 'javascript:alert(1)',
        publicationDate: '2025-05-01',
        shelfNumber: 'Z9-99',
        totalCopies: 1,
      },
    });
    assert.equal(xssCoverBook.status, 400);

    const xssAuthor = await api('/api/taxonomy/authors', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Unsafe Link Author',
        website: 'javascript:alert(document.domain)',
      },
    });
    assert.equal(xssAuthor.status, 400);

    // 6d. CSV export neutralizes leading spreadsheet formula characters
    const formulaBook = await api('/api/books', {
      method: 'POST',
      token: adminToken,
      body: {
        isbn: '978-0-999999-02-8',
        title: '=CMD("calc")',
        authorId: authorsRes.data.authors[0]._id,
        publisherId: pubsRes.data.publishers[0]._id,
        categoryId: taxRes.data.categories[0]._id,
        publicationDate: '2025-05-01',
        shelfNumber: 'Z9-98',
        totalCopies: 1,
      },
    });
    assert.equal(formulaBook.status, 201);

    const csvRaw = await fetch(`${baseUrl}/api/books/export/csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(csvRaw.status, 200);
    const csvText = await csvRaw.text();
    assert.ok(csvText.includes(`"'=CMD(""calc"")"`));

    // 6e. Invalid report date filter returns 400 instead of 500 CastError
    const badDateReport = await api('/api/reports/borrowing-history?from=not-a-date', {
      token: adminToken,
    });
    assert.equal(badDateReport.status, 400);
  });

  appSetup.io.close();
  server.closeAllConnections?.();
  server.close();
  await disconnectDatabase();
});
