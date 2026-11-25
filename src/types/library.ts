export type UserRole = 'SUPER_ADMIN' | 'LIBRARIAN' | 'MEMBER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  memberId?: string | null;
  lastLoginAt?: string;
}

export interface Author {
  _id: string;
  name: string;
  biography?: string;
  nationality?: string;
  birthYear?: number;
  website?: string;
  bookCount?: number;
}

export interface Publisher {
  _id: string;
  name: string;
  country?: string;
  website?: string;
  contactEmail?: string;
  foundedYear?: number;
  bookCount?: number;
}

export interface Category {
  _id: string;
  name: string;
  code: string;
  description?: string;
  shelfZone?: string;
  bookCount?: number;
}

export interface Book {
  _id: string;
  bookCode: string;
  isbn: string;
  title: string;
  authorId: Author | string;
  publisherId: Publisher | string;
  categoryId: Category | string;
  description: string;
  coverImageUrl: string;
  publicationDate: string;
  edition: string;
  language: string;
  shelfNumber: string;
  totalCopies: number;
  availableCopies: number;
  borrowCount: number;
  status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'ARCHIVED';
  createdAt: string;
}

export interface BookCopy {
  _id: string;
  bookId: string;
  accessionNumber: string;
  barcode: string;
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'WORN';
  status: 'AVAILABLE' | 'ISSUED' | 'RESERVED' | 'DAMAGED' | 'LOST';
  rackLocation: string;
  acquiredAt: string;
}

export interface Member {
  _id: string;
  memberCode: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
  address: string;
  membershipType: 'STUDENT' | 'FACULTY' | 'STAFF' | 'GENERAL';
  registrationDate: string;
  membershipExpiryDate: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  maxBorrowLimit: number;
  activeBorrowCount: number;
  outstandingFineBalance: number;
}

export interface IssueTransaction {
  _id: string;
  transactionCode: string;
  bookId: Pick<Book, '_id' | 'title' | 'isbn' | 'bookCode' | 'shelfNumber'>;
  bookCopyId: Pick<BookCopy, '_id' | 'accessionNumber' | 'barcode' | 'condition'>;
  memberId: Pick<Member, '_id' | 'fullName' | 'memberCode' | 'email' | 'membershipType' | 'status'>;
  issueDate: string;
  dueDate: string;
  returnedDate?: string;
  status: 'ISSUED' | 'RETURNED' | 'OVERDUE';
  estimatedOverdueDays?: number;
  estimatedFine?: number;
  notes?: string;
}

export interface ReturnTransaction {
  _id: string;
  returnCode: string;
  issueTransactionId: string;
  bookId: Pick<Book, '_id' | 'title' | 'isbn' | 'bookCode'>;
  bookCopyId: Pick<BookCopy, '_id' | 'accessionNumber'>;
  memberId: Pick<Member, '_id' | 'fullName' | 'memberCode'>;
  returnDate: string;
  overdueDays: number;
  fineAmount: number;
  conditionOnReturn: string;
  notes?: string;
}

export interface Reservation {
  _id: string;
  reservationCode: string;
  bookId: Pick<Book, '_id' | 'title' | 'isbn' | 'bookCode' | 'availableCopies' | 'totalCopies' | 'shelfNumber'>;
  memberId: Pick<Member, '_id' | 'fullName' | 'memberCode' | 'email' | 'status'>;
  reservationDate: string;
  expiryDate: string;
  status: 'PENDING' | 'AVAILABLE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  queuePosition: number;
  notifiedAt?: string;
}

export interface Fine {
  _id: string;
  fineCode: string;
  memberId: Pick<Member, '_id' | 'fullName' | 'memberCode' | 'email'>;
  bookId: Pick<Book, '_id' | 'title' | 'bookCode' | 'isbn'>;
  overdueDays: number;
  dailyRateApplied: number;
  amount: number;
  paidAmount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';
  reason: string;
  waiverReason?: string;
  createdAt: string;
}

export interface FinePayment {
  _id: string;
  receiptNumber: string;
  fineId: { _id: string; fineCode: string; amount: number };
  memberId: { _id: string; fullName: string; memberCode: string };
  amountPaid: number;
  paymentMethod: 'CASH' | 'CARD_DESK' | 'BANK_TRANSFER' | 'WAIVER';
  paymentDate: string;
  notes?: string;
}

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface AuditLogItem {
  _id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  details: string;
  createdAt: string;
}

export interface LibrarySettings {
  _id?: string;
  libraryName: string;
  dailyFineRate: number;
  maxFineAmount: number;
  gracePeriodDays: number;
  defaultLoanDays: number;
  reservationHoldHours: number;
  maxAllowedFineBeforeBlock: number;
  borrowingLimits: {
    STUDENT: number;
    FACULTY: number;
    STAFF: number;
    GENERAL: number;
  };
  allowMemberSelfRegistration: boolean;
}
