import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier format.');

export const bootstrapSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  email: z.string().trim().email('Valid email address is required.').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128),
  seedSampleData: z.boolean().optional().default(true),
  demoStaffPassword: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email address is required.').toLowerCase(),
  password: z.string().min(1, 'Password is required.').max(128),
});

export const registerMemberSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  phoneNumber: z.string().trim().min(6).max(30),
  address: z.string().trim().min(4).max(400),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  token: z.string().trim().min(16),
  newPassword: z.string().min(8).max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  role: z.enum(['SUPER_ADMIN', 'LIBRARIAN', 'MEMBER']),
});

export const bookSchema = z.object({
  isbn: z.string().trim().min(10, 'ISBN must be at least 10 characters.').max(30),
  title: z.string().trim().min(1, 'Title is required.').max(240),
  authorId: objectIdSchema,
  publisherId: objectIdSchema,
  categoryId: objectIdSchema,
  description: z.string().trim().max(3000).optional().default(''),
  coverImageUrl: z.string().trim().max(500).optional().default(''),
  publicationDate: z.string().min(4, 'Publication date is required.'),
  edition: z.string().trim().max(60).optional().default('1st Edition'),
  language: z.string().trim().max(60).optional().default('English'),
  shelfNumber: z.string().trim().min(1, 'Shelf number is required.').max(40),
  totalCopies: z.coerce.number().int().min(1, 'At least 1 copy is required.').max(500),
  availableCopies: z.coerce.number().int().min(0).optional(),
  status: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'ARCHIVED']).optional(),
});

export const authorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  biography: z.string().trim().max(2000).optional().default(''),
  nationality: z.string().trim().max(80).optional().default(''),
  birthYear: z.coerce.number().int().min(1000).max(2100).optional(),
  website: z.string().trim().max(300).optional().default(''),
});

export const publisherSchema = z.object({
  name: z.string().trim().min(2).max(140),
  country: z.string().trim().max(80).optional().default(''),
  website: z.string().trim().max(300).optional().default(''),
  contactEmail: z.string().trim().email().or(z.literal('')).optional().default(''),
  foundedYear: z.coerce.number().int().min(1400).max(2100).optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  description: z.string().trim().max(500).optional().default(''),
  shelfZone: z.string().trim().max(50).optional().default(''),
});

export const memberSchema = z.object({
  fullName: z.string().trim().min(2).max(140),
  email: z.string().trim().email().toLowerCase(),
  phoneNumber: z.string().trim().min(6).max(30),
  dateOfBirth: z.string().optional(),
  gender: z
    .enum(['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'])
    .optional()
    .default('PREFER_NOT_TO_SAY'),
  address: z.string().trim().min(4).max(400),
  membershipType: z.enum(['STUDENT', 'FACULTY', 'STAFF', 'GENERAL']),
  membershipExpiryDate: z.string().min(4),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']).optional().default('ACTIVE'),
  maxBorrowLimit: z.coerce.number().int().min(1).max(30).optional(),
});

export const issueBookSchema = z.object({
  memberId: objectIdSchema,
  bookId: objectIdSchema,
  bookCopyId: objectIdSchema.optional(),
  dueDate: z.string().min(4),
  notes: z.string().trim().max(500).optional().default(''),
});

export const returnBookSchema = z.object({
  issueTransactionId: objectIdSchema,
  returnDate: z.string().optional(),
  conditionOnReturn: z
    .enum(['NEW', 'GOOD', 'FAIR', 'WORN', 'DAMAGED'])
    .optional()
    .default('GOOD'),
  notes: z.string().trim().max(500).optional().default(''),
});

export const reservationSchema = z.object({
  bookId: objectIdSchema,
  memberId: objectIdSchema.optional(),
});

export const finePaymentSchema = z.object({
  amountPaid: z.coerce.number().positive('Payment amount must be greater than zero.'),
  paymentMethod: z.enum(['CASH', 'CARD_DESK', 'BANK_TRANSFER']).default('CASH'),
  notes: z.string().trim().max(400).optional().default(''),
});

export const fineWaiveSchema = z.object({
  waiverReason: z.string().trim().min(3, 'Waiver reason is required.').max(400),
});

export const settingsSchema = z.object({
  libraryName: z.string().trim().min(2).max(140),
  dailyFineRate: z.coerce.number().min(0).max(100),
  maxFineAmount: z.coerce.number().min(0).max(5000),
  gracePeriodDays: z.coerce.number().int().min(0).max(30),
  defaultLoanDays: z.coerce.number().int().min(1).max(90),
  reservationHoldHours: z.coerce.number().int().min(1).max(168),
  maxAllowedFineBeforeBlock: z.coerce.number().min(0).max(1000),
  borrowingLimits: z.object({
    STUDENT: z.coerce.number().int().min(1).max(30),
    FACULTY: z.coerce.number().int().min(1).max(30),
    STAFF: z.coerce.number().int().min(1).max(30),
    GENERAL: z.coerce.number().int().min(1).max(30),
  }),
  allowMemberSelfRegistration: z.boolean(),
});
