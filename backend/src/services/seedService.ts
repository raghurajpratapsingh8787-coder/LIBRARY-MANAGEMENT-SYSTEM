import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import {
  AuditLog,
  Author,
  Book,
  BookCopy,
  Category,
  Fine,
  FinePayment,
  IssueTransaction,
  LibrarySettings,
  Member,
  Notification,
  Publisher,
  Reservation,
  ReturnTransaction,
  User,
} from '../models';

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function ensureDefaultSettings(): Promise<void> {
  const existing = await LibrarySettings.findOne();
  if (!existing) {
    await LibrarySettings.create({});
  }
}

export async function ensureEnvAdminIfConfigured(): Promise<void> {
  if (!env.adminInitialPassword) return;
  const adminEmail = env.adminInitialEmail || 'raghurajpratapsingh8787@gmail.com';
  const existingAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
  const hash = await bcrypt.hash(env.adminInitialPassword, 12);

  if (!existingAdmin) {
    await User.create({
      name: 'Raghuraj Pratap Singh',
      email: adminEmail,
      passwordHash: hash,
      role: 'SUPER_ADMIN',
      avatarUrl: '/src/assets/images/avatar_head_librarian_1795597158213.jpg',
      isActive: true,
    });
  } else if (existingAdmin.email === adminEmail) {
    existingAdmin.passwordHash = hash;
    await existingAdmin.save();
  }
}

export async function seedSampleLibraryData(options?: {
  adminUserId?: string;
  demoStaffPassword?: string;
}): Promise<void> {
  await ensureDefaultSettings();

  const existingBookCount = await Book.countDocuments();
  if (existingBookCount > 0) {
    return;
  }

  let actorId = options?.adminUserId;
  if (!actorId) {
    const anyAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
    actorId = anyAdmin ? String(anyAdmin._id) : undefined;
  }

  // Create Categories
  const categories = await Category.insertMany([
    { name: 'Systems & Computing', code: 'SYS', description: 'Distributed systems, software architecture, and algorithms.', shelfZone: 'A1' },
    { name: 'Architecture & Urbanism', code: 'ARC', description: 'Modernist design, urban planning, and spatial theory.', shelfZone: 'B2' },
    { name: 'Natural Sciences', code: 'SCI', description: 'Botany, physics, quantum optics, and earth systems.', shelfZone: 'C1' },
    { name: 'Economics & Policy', code: 'ECO', description: 'Macroeconomics, institutional design, and public policy.', shelfZone: 'D3' },
    { name: 'Literature & Essays', code: 'LIT', description: 'World literature, criticism, and collected essays.', shelfZone: 'E1' },
    { name: 'Design & Typography', code: 'DES', description: 'Editorial grids, industrial design, and typography.', shelfZone: 'B4' },
  ]);

  // Create Authors
  const authors = await Author.insertMany([
    { name: 'Elias Vogel', nationality: 'Swiss', birthYear: 1974, biography: 'Professor of structural engineering and computational design.' },
    { name: 'Dr. Eliza Vance', nationality: 'British', birthYear: 1981, biography: 'Principal researcher in nanophotonics and optical computing.' },
    { name: 'Eliza Renwick', nationality: 'Canadian', birthYear: 1978, biography: 'Architectural historian focusing on civic reading spaces.' },
    { name: 'Dr. Arthur Pendelton', nationality: 'American', birthYear: 1966, biography: 'Botanical illustrator and curator of archival herbaria.' },
    { name: 'Sora Takahashi', nationality: 'Japanese', birthYear: 1985, biography: 'Systems architect specializing in consensus protocols.' },
    { name: 'Clara Lindqvist', nationality: 'Swedish', birthYear: 1979, biography: 'Economic historian and quantitative policy analyst.' },
    { name: 'Mateo Alvarez', nationality: 'Spanish', birthYear: 1971, biography: 'Typographer and editorial systems designer.' },
    { name: 'Nadia Okafor', nationality: 'Nigerian', birthYear: 1988, biography: 'Essayist and comparative literature fellow.' },
  ]);

  // Create Publishers
  const publishers = await Publisher.insertMany([
    { name: 'Swiss Academic Press', country: 'Switzerland', foundedYear: 1954, contactEmail: 'editorial@swissacademic.example' },
    { name: 'Royal Herbarium Publishing', country: 'United Kingdom', foundedYear: 1892, contactEmail: 'archive@royalherbarium.example' },
    { name: 'Clarendon Technical', country: 'United States', foundedYear: 1978, contactEmail: 'books@clarendontech.example' },
    { name: 'Nordic Monograph House', country: 'Sweden', foundedYear: 2001, contactEmail: 'press@nordicmonograph.example' },
    { name: 'Meridian Civic Press', country: 'Canada', foundedYear: 1987, contactEmail: 'hello@meridiancivic.example' },
  ]);

  const booksSpec = [
    {
      bookCode: 'BK-1001',
      isbn: '978-3-907234-11-2',
      title: 'Architectonics of Structure',
      authorId: authors[0]._id,
      publisherId: publishers[0]._id,
      categoryId: categories[0]._id,
      coverImageUrl: '/src/assets/images/cover_systems_architecture_1795597157115.jpg',
      publicationDate: new Date('2023-09-15'),
      edition: '2nd Revised Edition',
      language: 'English',
      shelfNumber: 'A1-04',
      totalCopies: 4,
      availableCopies: 3,
      borrowCount: 18,
      description: 'A rigorous monograph examining geometric invariants, load-bearing modular grids, and structural resilience across computational and physical architecture.',
    },
    {
      bookCode: 'BK-1002',
      isbn: '978-0-954812-44-7',
      title: 'Botanical Ferns: A Vintage Herbarium',
      authorId: authors[3]._id,
      publisherId: publishers[1]._id,
      categoryId: categories[2]._id,
      coverImageUrl: '/src/assets/images/cover_botanical_atlas_1795597157737.jpg',
      publicationDate: new Date('2022-04-10'),
      edition: 'Archival Folio',
      language: 'English',
      shelfNumber: 'C1-12',
      totalCopies: 3,
      availableCopies: 2,
      borrowCount: 14,
      description: 'Annotated botanical plates documenting pteridophyte morphology, spore structures, and nineteenth-century European field collections.',
    },
    {
      bookCode: 'BK-1003',
      isbn: '978-1-4020-8812-9',
      title: 'Prismatic Resonance: Light Dynamics in Nanophotonics',
      authorId: authors[1]._id,
      publisherId: publishers[2]._id,
      categoryId: categories[2]._id,
      coverImageUrl: '/src/assets/images/cover_quantum_optics_1795597157266.jpg',
      publicationDate: new Date('2024-02-20'),
      edition: '1st Edition',
      language: 'English',
      shelfNumber: 'C1-19',
      totalCopies: 3,
      availableCopies: 0,
      borrowCount: 27,
      description: 'Foundations of coherent wave propagation, sub-wavelength dielectric waveguides, and high-Q photonic resonators.',
    },
    {
      bookCode: 'BK-1004',
      isbn: '978-0-88977-509-4',
      title: 'The Architecture of Read: Modernist Libraries',
      authorId: authors[2]._id,
      publisherId: publishers[4]._id,
      categoryId: categories[1]._id,
      coverImageUrl: '/src/assets/images/cover_urban_history_1795597158764.jpg',
      publicationDate: new Date('2023-11-02'),
      edition: '1st Edition',
      language: 'English',
      shelfNumber: 'B2-08',
      totalCopies: 3,
      availableCopies: 2,
      borrowCount: 19,
      description: 'An architectural survey of daylighting, concrete vault acoustics, and reading room proportions across twentieth-century civic libraries.',
    },
    {
      bookCode: 'BK-1005',
      isbn: '978-1-942100-31-8',
      title: 'Deterministic Consensus in Distributed Ledgers',
      authorId: authors[4]._id,
      publisherId: publishers[2]._id,
      categoryId: categories[0]._id,
      coverImageUrl: '',
      publicationDate: new Date('2025-01-14'),
      edition: '1st Edition',
      language: 'English',
      shelfNumber: 'A1-09',
      totalCopies: 4,
      availableCopies: 3,
      borrowCount: 22,
      description: 'Formal proofs and practical state-machine replication patterns for fault-tolerant distributed storage systems.',
    },
    {
      bookCode: 'BK-1006',
      isbn: '978-91-88402-19-5',
      title: 'Institutional Capital & Civic Infrastructure',
      authorId: authors[5]._id,
      publisherId: publishers[3]._id,
      categoryId: categories[3]._id,
      coverImageUrl: '',
      publicationDate: new Date('2024-06-05'),
      edition: '1st Edition',
      language: 'English',
      shelfNumber: 'D3-02',
      totalCopies: 2,
      availableCopies: 2,
      borrowCount: 9,
      description: 'Empirical study of municipal bond architecture, public endowment governance, and long-horizon capital allocation.',
    },
    {
      bookCode: 'BK-1007',
      isbn: '978-84-94980-77-1',
      title: 'Swiss Grid Systems & Editorial Proportion',
      authorId: authors[6]._id,
      publisherId: publishers[0]._id,
      categoryId: categories[5]._id,
      coverImageUrl: '',
      publicationDate: new Date('2021-08-22'),
      edition: '3rd Edition',
      language: 'English',
      shelfNumber: 'B4-03',
      totalCopies: 3,
      availableCopies: 2,
      borrowCount: 16,
      description: 'Practical handbook on baseline rhythm, typographic hierarchy, and modular layout mathematics for print and digital systems.',
    },
    {
      bookCode: 'BK-1008',
      isbn: '978-0-374-61224-3',
      title: 'Cartographies of Memory: Collected Essays',
      authorId: authors[7]._id,
      publisherId: publishers[4]._id,
      categoryId: categories[4]._id,
      coverImageUrl: '',
      publicationDate: new Date('2024-09-18'),
      edition: '1st Edition',
      language: 'English',
      shelfNumber: 'E1-14',
      totalCopies: 2,
      availableCopies: 2,
      borrowCount: 11,
      description: 'Twelve interconnected essays exploring oral archives, post-colonial urban memory, and literary translation.',
    },
  ];

  const createdBooks = await Book.insertMany(
    booksSpec.map((b) => ({
      ...b,
      status: b.availableCopies === 0 ? 'OUT_OF_STOCK' : 'AVAILABLE',
    }))
  );

  // Create BookCopy documents for every physical copy
  const copyDocs: Array<Record<string, unknown>> = [];
  for (let bIdx = 0; bIdx < createdBooks.length; bIdx++) {
    const book = createdBooks[bIdx];
    const issuedCount = book.totalCopies - book.availableCopies;
    for (let c = 1; c <= book.totalCopies; c++) {
      const isIssued = c <= issuedCount;
      copyDocs.push({
        bookId: book._id,
        accessionNumber: `ACC-${100 + bIdx}-${String(c).padStart(2, '0')}`,
        barcode: `9900${100 + bIdx}${String(c).padStart(3, '0')}`,
        condition: c === 1 ? 'NEW' : 'GOOD',
        status: isIssued ? 'ISSUED' : 'AVAILABLE',
        rackLocation: book.shelfNumber,
        acquiredAt: daysAgo(180 - bIdx * 10),
      });
    }
  }
  const createdCopies = await BookCopy.insertMany(copyDocs);

  // Create Members
  const members = await Member.insertMany([
    {
      memberCode: 'MEM-2001',
      fullName: 'Elena Rostova',
      email: 'elena.rostova@university.edu',
      phoneNumber: '+1-555-0142',
      address: '410 Mercer Hall, North Campus',
      membershipType: 'FACULTY',
      registrationDate: daysAgo(210),
      membershipExpiryDate: daysFromNow(365),
      status: 'ACTIVE',
      maxBorrowLimit: 10,
      activeBorrowCount: 2,
      outstandingFineBalance: 4.5,
    },
    {
      memberCode: 'MEM-2002',
      fullName: 'Marcus Vance',
      email: 'marcus.vance@university.edu',
      phoneNumber: '+1-555-0188',
      address: '82 Oakridge Ave, Apt 4B',
      membershipType: 'STUDENT',
      registrationDate: daysAgo(150),
      membershipExpiryDate: daysFromNow(240),
      status: 'ACTIVE',
      maxBorrowLimit: 5,
      activeBorrowCount: 2,
      outstandingFineBalance: 0,
    },
    {
      memberCode: 'MEM-2003',
      fullName: 'Priya Nair',
      email: 'priya.nair@university.edu',
      phoneNumber: '+1-555-0193',
      address: '19 Cedar Crescent',
      membershipType: 'STUDENT',
      registrationDate: daysAgo(95),
      membershipExpiryDate: daysFromNow(280),
      status: 'ACTIVE',
      maxBorrowLimit: 5,
      activeBorrowCount: 1,
      outstandingFineBalance: 0,
    },
    {
      memberCode: 'MEM-2004',
      fullName: 'Julian Mercer',
      email: 'julian.mercer@civic.org',
      phoneNumber: '+1-555-0117',
      address: '720 Harborview Blvd',
      membershipType: 'GENERAL',
      registrationDate: daysAgo(120),
      membershipExpiryDate: daysFromNow(180),
      status: 'ACTIVE',
      maxBorrowLimit: 3,
      activeBorrowCount: 1,
      outstandingFineBalance: 6.0,
    },
    {
      memberCode: 'MEM-2005',
      fullName: 'Hannah Sterling',
      email: 'hannah.sterling@university.edu',
      phoneNumber: '+1-555-0164',
      address: '15 Library Row',
      membershipType: 'STAFF',
      registrationDate: daysAgo(60),
      membershipExpiryDate: daysFromNow(400),
      status: 'ACTIVE',
      maxBorrowLimit: 7,
      activeBorrowCount: 1,
      outstandingFineBalance: 0,
    },
    {
      memberCode: 'MEM-2006',
      fullName: 'David Chen',
      email: 'david.chen@civic.org',
      phoneNumber: '+1-555-0175',
      address: '305 Maple Terrace',
      membershipType: 'GENERAL',
      registrationDate: daysAgo(390),
      membershipExpiryDate: daysAgo(12),
      status: 'EXPIRED',
      maxBorrowLimit: 3,
      activeBorrowCount: 0,
      outstandingFineBalance: 0,
    },
  ]);

  // Optional demo Librarian & Member user logins if demo password provided during first-run setup
  if (options?.demoStaffPassword && options.demoStaffPassword.length >= 8) {
    const demoHash = await bcrypt.hash(options.demoStaffPassword, 12);
    const existingLib = await User.findOne({ email: 'librarian@library.local' });
    if (!existingLib) {
      await User.create({
        name: 'Clara Vance (Librarian)',
        email: 'librarian@library.local',
        passwordHash: demoHash,
        role: 'LIBRARIAN',
        avatarUrl: '/src/assets/images/avatar_head_librarian_1795597158213.jpg',
        isActive: true,
      });
    }
    const existingMemberUser = await User.findOne({ email: 'member@library.local' });
    if (!existingMemberUser) {
      const mUser = await User.create({
        name: 'Marcus Vance',
        email: 'member@library.local',
        passwordHash: demoHash,
        role: 'MEMBER',
        memberId: members[1]._id,
        isActive: true,
      });
      members[1].userId = mUser._id;
      await members[1].save();
    }
  }

  // Pick issued copies to create active & overdue IssueTransactions
  const issuedCopies = createdCopies.filter((c) => c.status === 'ISSUED');
  const issueActorId = actorId || members[0]._id;

  const activeIssueSpecs = [
    // Overdue items (due in the past)
    {
      transactionCode: 'ISS-0001-1011',
      copy: issuedCopies[0],
      member: members[0],
      issueDate: daysAgo(21),
      dueDate: daysAgo(5),
      status: 'OVERDUE' as const,
    },
    {
      transactionCode: 'ISS-0002-1012',
      copy: issuedCopies[1],
      member: members[3],
      issueDate: daysAgo(19),
      dueDate: daysAgo(3),
      status: 'OVERDUE' as const,
    },
    // Active non-overdue items (due soon / normal)
    {
      transactionCode: 'ISS-0003-1013',
      copy: issuedCopies[2],
      member: members[1],
      issueDate: daysAgo(11),
      dueDate: daysFromNow(2),
      status: 'ISSUED' as const,
    },
    {
      transactionCode: 'ISS-0004-1014',
      copy: issuedCopies[3],
      member: members[1],
      issueDate: daysAgo(6),
      dueDate: daysFromNow(8),
      status: 'ISSUED' as const,
    },
    {
      transactionCode: 'ISS-0005-1015',
      copy: issuedCopies[4],
      member: members[2],
      issueDate: daysAgo(4),
      dueDate: daysFromNow(10),
      status: 'ISSUED' as const,
    },
    {
      transactionCode: 'ISS-0006-1016',
      copy: issuedCopies[5],
      member: members[0],
      issueDate: daysAgo(3),
      dueDate: daysFromNow(11),
      status: 'ISSUED' as const,
    },
    {
      transactionCode: 'ISS-0007-1017',
      copy: issuedCopies[6],
      member: members[4],
      issueDate: daysAgo(2),
      dueDate: daysFromNow(12),
      status: 'ISSUED' as const,
    },
  ];

  await IssueTransaction.insertMany(
    activeIssueSpecs
      .filter((s) => s.copy)
      .map((s) => ({
        transactionCode: s.transactionCode,
        bookId: s.copy.bookId,
        bookCopyId: s.copy._id,
        memberId: s.member._id,
        issuedByUserId: issueActorId,
        issueDate: s.issueDate,
        dueDate: s.dueDate,
        status: s.status,
      }))
  );

  // Create historical returned transactions across past 5 months for real chart trends
  const availableCopies = createdCopies.filter((c) => c.status === 'AVAILABLE');
  const historicalMonths = [120, 95, 70, 42, 18, 8];
  const historicalIssues: Array<Record<string, unknown>> = [];

  for (let i = 0; i < historicalMonths.length; i++) {
    const copy = availableCopies[i % availableCopies.length];
    const member = members[i % members.length];
    const issDate = daysAgo(historicalMonths[i]);
    const dueDate = new Date(issDate.getTime() + 14 * 86400000);
    const retDate = new Date(issDate.getTime() + (i % 2 === 0 ? 11 : 17) * 86400000);
    historicalIssues.push({
      transactionCode: `ISS-HIST-00${i + 1}`,
      bookId: copy.bookId,
      bookCopyId: copy._id,
      memberId: member._id,
      issuedByUserId: issueActorId,
      issueDate: issDate,
      dueDate,
      returnedDate: retDate,
      status: 'RETURNED',
    });
  }

  const createdHistIssues = await IssueTransaction.insertMany(historicalIssues);

  const histReturns = await ReturnTransaction.insertMany(
    createdHistIssues.map((iss, idx) => {
      const overdueDays = idx % 2 === 1 ? 3 : 0;
      const fineAmount = overdueDays > 1 ? Number(((overdueDays - 1) * 1.5).toFixed(2)) : 0;
      return {
        returnCode: `RET-HIST-00${idx + 1}`,
        issueTransactionId: iss._id,
        bookId: iss.bookId,
        bookCopyId: iss.bookCopyId,
        memberId: iss.memberId,
        processedByUserId: issueActorId,
        returnDate: iss.returnedDate || daysAgo(5),
        overdueDays,
        fineAmount,
        conditionOnReturn: 'GOOD',
      };
    })
  );

  // Create realistic Fine & FinePayment records
  const fineRecords = await Fine.insertMany([
    {
      fineCode: 'FIN-0001-101',
      memberId: members[0]._id,
      issueTransactionId: createdHistIssues[1]._id,
      returnTransactionId: histReturns[1]._id,
      bookId: createdHistIssues[1].bookId,
      overdueDays: 4,
      dailyRateApplied: 1.5,
      amount: 4.5,
      paidAmount: 0,
      status: 'UNPAID',
      reason: 'Returned 4 day(s) after due date (3 billable).',
    },
    {
      fineCode: 'FIN-0002-102',
      memberId: members[3]._id,
      issueTransactionId: createdHistIssues[3]._id,
      returnTransactionId: histReturns[3]._id,
      bookId: createdHistIssues[3].bookId,
      overdueDays: 5,
      dailyRateApplied: 1.5,
      amount: 6.0,
      paidAmount: 0,
      status: 'UNPAID',
      reason: 'Returned 5 day(s) after due date (4 billable).',
    },
    {
      fineCode: 'FIN-0003-103',
      memberId: members[2]._id,
      issueTransactionId: createdHistIssues[5]._id,
      returnTransactionId: histReturns[5]._id,
      bookId: createdHistIssues[5].bookId,
      overdueDays: 3,
      dailyRateApplied: 1.5,
      amount: 3.0,
      paidAmount: 3.0,
      status: 'PAID',
      reason: 'Returned 3 day(s) after due date (2 billable).',
    },
  ]);

  await FinePayment.create({
    receiptNumber: 'RCP-0001-9001',
    fineId: fineRecords[2]._id,
    memberId: members[2]._id,
    receivedByUserId: issueActorId,
    amountPaid: 3.0,
    paymentMethod: 'CARD_DESK',
    paymentDate: daysAgo(4),
    notes: 'Settled at front circulation desk.',
  });

  // Create Reservation waitlist for the out-of-stock book (Prismatic Resonance)
  await Reservation.insertMany([
    {
      reservationCode: 'RES-0001-301',
      bookId: createdBooks[2]._id,
      memberId: members[1]._id,
      reservationDate: daysAgo(2),
      expiryDate: daysFromNow(5),
      status: 'PENDING',
      queuePosition: 1,
    },
    {
      reservationCode: 'RES-0002-302',
      bookId: createdBooks[2]._id,
      memberId: members[4]._id,
      reservationDate: daysAgo(1),
      expiryDate: daysFromNow(6),
      status: 'PENDING',
      queuePosition: 2,
    },
  ]);

  await Notification.insertMany([
    {
      recipientRole: 'ALL',
      title: 'Overdue Circulation Alert',
      message: '2 active loans have passed their due date and require follow-up.',
      type: 'OVERDUE_ALERT',
      isRead: false,
      link: '/overdue',
    },
    {
      recipientRole: 'LIBRARIAN',
      title: 'Reservation Waitlist Active',
      message: 'Prismatic Resonance has 2 members waiting in the reservation queue.',
      type: 'SYSTEM',
      isRead: false,
      link: '/reservations',
    },
  ]);

  await AuditLog.create({
    actorUserId: actorId,
    actorEmail: 'system@library.local',
    actorRole: 'SUPER_ADMIN',
    action: 'WORKSPACE_SEEDED',
    entityType: 'LibrarySettings',
    details: 'Initialized library catalog, physical copies, members, and historical circulation records.',
  });
}
