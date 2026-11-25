import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOverdueDays,
  calculateOverdueFine,
  computeNextAvailableCopies,
  escapeRegex,
  evaluateBorrowingEligibility,
  formatCode,
} from '../utils/libraryRules';

test('calculateOverdueDays returns 0 when returned on or before due date', () => {
  const due = new Date('2026-11-10T12:00:00Z');
  assert.equal(calculateOverdueDays(due, new Date('2026-11-10T23:00:00Z')), 0);
  assert.equal(calculateOverdueDays(due, new Date('2026-11-08T10:00:00Z')), 0);
});

test('calculateOverdueDays computes whole calendar days past due', () => {
  const due = new Date('2026-11-10T00:00:00Z');
  const returned = new Date('2026-11-15T18:00:00Z');
  assert.equal(calculateOverdueDays(due, returned), 5);
});

test('calculateOverdueFine respects grace period and max fine cap', () => {
  const policy = { dailyFineRate: 1.5, maxFineAmount: 20, gracePeriodDays: 1 };
  const due = new Date('2026-11-10T00:00:00Z');

  // Within grace period (1 day late)
  const withinGrace = calculateOverdueFine(due, new Date('2026-11-11T00:00:00Z'), policy);
  assert.equal(withinGrace.overdueDays, 1);
  assert.equal(withinGrace.billableDays, 0);
  assert.equal(withinGrace.fineAmount, 0);

  // 4 days late => 3 billable * 1.5 = 4.5
  const fourDays = calculateOverdueFine(due, new Date('2026-11-14T00:00:00Z'), policy);
  assert.equal(fourDays.overdueDays, 4);
  assert.equal(fourDays.billableDays, 3);
  assert.equal(fourDays.fineAmount, 4.5);

  // 30 days late => capped at 20
  const capped = calculateOverdueFine(due, new Date('2026-12-10T00:00:00Z'), policy);
  assert.equal(capped.fineAmount, 20);
});

test('evaluateBorrowingEligibility blocks expired, suspended, over-limit, and high-fine members', () => {
  const ref = new Date('2026-11-25T00:00:00Z');

  const ok = evaluateBorrowingEligibility({
    memberStatus: 'ACTIVE',
    membershipExpiryDate: new Date('2027-01-01T00:00:00Z'),
    activeBorrowCount: 2,
    borrowingLimit: 5,
    outstandingFineAmount: 10,
    maxAllowedFineBeforeBlock: 25,
    referenceDate: ref,
  });
  assert.equal(ok.eligible, true);
  assert.equal(ok.reasons.length, 0);

  const blocked = evaluateBorrowingEligibility({
    memberStatus: 'SUSPENDED',
    membershipExpiryDate: new Date('2026-11-01T00:00:00Z'),
    activeBorrowCount: 5,
    borrowingLimit: 5,
    outstandingFineAmount: 30,
    maxAllowedFineBeforeBlock: 25,
    referenceDate: ref,
  });
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.reasons.length, 4);
});

test('computeNextAvailableCopies enforces inventory bounds', () => {
  assert.equal(computeNextAvailableCopies(3, 4, -1), 2);
  assert.equal(computeNextAvailableCopies(3, 4, 1), 4);
  assert.throws(() => computeNextAvailableCopies(0, 4, -1), /negative/);
  assert.throws(() => computeNextAvailableCopies(4, 4, 1), /exceed/);
});

test('escapeRegex and formatCode sanitize inputs safely', () => {
  assert.equal(escapeRegex('C++ (2nd).*'), 'C\\+\\+ \\(2nd\\)\\.\\*');
  assert.equal(formatCode('BK', 7), 'BK-0007');
});
