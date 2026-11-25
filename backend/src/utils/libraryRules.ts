export interface FinePolicy {
  dailyFineRate: number;
  maxFineAmount: number;
  gracePeriodDays: number;
}

export interface FineCalculationResult {
  overdueDays: number;
  billableDays: number;
  fineAmount: number;
}

export interface BorrowingEligibilityInput {
  memberStatus: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  membershipExpiryDate: Date;
  activeBorrowCount: number;
  borrowingLimit: number;
  outstandingFineAmount: number;
  maxAllowedFineBeforeBlock: number;
  referenceDate?: Date;
}

export interface BorrowingEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function calculateOverdueDays(dueDate: Date, returnDate: Date): number {
  const dueUtc = startOfUtcDay(dueDate).getTime();
  const returnUtc = startOfUtcDay(returnDate).getTime();
  const diffDays = Math.floor((returnUtc - dueUtc) / MS_PER_DAY);
  return Math.max(0, diffDays);
}

export function calculateOverdueFine(
  dueDate: Date,
  returnDate: Date,
  policy: FinePolicy
): FineCalculationResult {
  const overdueDays = calculateOverdueDays(dueDate, returnDate);
  const grace = Math.max(0, Math.floor(policy.gracePeriodDays));
  const rate = Math.max(0, policy.dailyFineRate);
  const maxCap = Math.max(0, policy.maxFineAmount);

  if (overdueDays <= grace) {
    return { overdueDays, billableDays: 0, fineAmount: 0 };
  }

  const billableDays = overdueDays - grace;
  const rawFine = Number((billableDays * rate).toFixed(2));
  const fineAmount = maxCap > 0 ? Math.min(rawFine, maxCap) : rawFine;

  return {
    overdueDays,
    billableDays,
    fineAmount: Number(fineAmount.toFixed(2)),
  };
}

export function evaluateBorrowingEligibility(
  input: BorrowingEligibilityInput
): BorrowingEligibilityResult {
  const reasons: string[] = [];
  const now = input.referenceDate ?? new Date();

  if (input.memberStatus !== 'ACTIVE') {
    reasons.push(`Member account is ${input.memberStatus.toLowerCase()}.`);
  }

  if (startOfUtcDay(input.membershipExpiryDate).getTime() < startOfUtcDay(now).getTime()) {
    reasons.push('Membership has expired.');
  }

  if (input.activeBorrowCount >= input.borrowingLimit) {
    reasons.push(`Borrowing limit of ${input.borrowingLimit} active books reached.`);
  }

  if (
    input.maxAllowedFineBeforeBlock >= 0 &&
    input.outstandingFineAmount > input.maxAllowedFineBeforeBlock
  ) {
    reasons.push(
      `Outstanding fines ($${input.outstandingFineAmount.toFixed(2)}) exceed the $${input.maxAllowedFineBeforeBlock.toFixed(2)} limit.`
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function computeNextAvailableCopies(
  currentAvailable: number,
  totalCopies: number,
  delta: number
): number {
  const next = currentAvailable + delta;
  if (next < 0) {
    throw new Error('Available copies cannot become negative.');
  }
  if (next > totalCopies) {
    throw new Error('Available copies cannot exceed total copies.');
  }
  return next;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatCode(prefix: string, sequenceNumber: number, width = 4): string {
  return `${prefix}-${String(sequenceNumber).padStart(width, '0')}`;
}
