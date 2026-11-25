import crypto from 'crypto';
import express from 'express';
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { saveValidatedCoverImage, uploadMemory } from '../middleware/upload';
import { Author, Book, BookCopy, Category, IssueTransaction, Publisher } from '../models';
import { recordAuditLog } from '../services/auditService';
import { escapeRegex, formatCode } from '../utils/libraryRules';
import { bookSchema, objectIdSchema } from '../validators/schemas';

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const search = String(req.query.search || '').trim();
    const categoryId = String(req.query.categoryId || '').trim();
    const status = String(req.query.status || '').trim();
    const availability = String(req.query.availability || '').trim();
    const sortBy = String(req.query.sortBy || 'newest');

    const filter: Record<string, unknown> = {};
    if (status && ['AVAILABLE', 'OUT_OF_STOCK', 'ARCHIVED'].includes(status)) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'ARCHIVED' };
    }

    if (categoryId && /^[a-f\d]{24}$/i.test(categoryId)) {
      filter.categoryId = categoryId;
    }

    if (availability === 'available') {
      filter.availableCopies = { $gt: 0 };
    } else if (availability === 'issued') {
      filter.$expr = { $lt: ['$availableCopies', '$totalCopies'] };
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      const [matchingAuthors, matchingPublishers] = await Promise.all([
        Author.find({ name: regex }).select('_id'),
        Publisher.find({ name: regex }).select('_id'),
      ]);

      filter.$or = [
        { title: regex },
        { isbn: regex },
        { bookCode: regex },
        { authorId: { $in: matchingAuthors.map((a) => a._id) } },
        { publisherId: { $in: matchingPublishers.map((p) => p._id) } },
      ];
    }

    let sortStage: Record<string, 1 | -1> = { createdAt: -1 };
    if (sortBy === 'title_asc') sortStage = { title: 1 };
    else if (sortBy === 'title_desc') sortStage = { title: -1 };
    else if (sortBy === 'popular') sortStage = { borrowCount: -1 };
    else if (sortBy === 'oldest') sortStage = { createdAt: 1 };

    const [books, total] = await Promise.all([
      Book.find(filter)
        .sort(sortStage)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('authorId', 'name nationality')
        .populate('publisherId', 'name country')
        .populate('categoryId', 'name code shelfZone'),
      Book.countDocuments(filter),
    ]);

    res.json({
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/export/csv', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (_req, res, next) => {
  try {
    const books = await Book.find()
      .sort({ bookCode: 1 })
      .populate('authorId', 'name')
      .populate('publisherId', 'name')
      .populate('categoryId', 'name');

    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Book ID',
      'ISBN',
      'Title',
      'Author',
      'Category',
      'Publisher',
      'Shelf',
      'Total Copies',
      'Available Copies',
      'Status',
    ].join(',');

    const rows = books.map((b) =>
      [
        b.bookCode,
        b.isbn,
        b.title,
        (b.authorId as unknown as { name?: string })?.name || '',
        (b.categoryId as unknown as { name?: string })?.name || '',
        (b.publisherId as unknown as { name?: string })?.name || '',
        b.shelfNumber,
        b.totalCopies,
        b.availableCopies,
        b.status,
      ]
        .map(escapeCsv)
        .join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="books-directory.csv"');
    res.send([header, ...rows].join('\n'));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/upload-cover',
  authenticate,
  requireRole('SUPER_ADMIN', 'LIBRARIAN'),
  uploadMemory.single('cover'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, 'Cover image file is required.');
      }
      const coverUrl = saveValidatedCoverImage(req.file.buffer);
      res.status(201).json({ coverImageUrl: coverUrl });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const [book, copies] = await Promise.all([
      Book.findById(id)
        .populate('authorId', 'name nationality biography')
        .populate('publisherId', 'name country')
        .populate('categoryId', 'name code shelfZone'),
      BookCopy.find({ bookId: id }).sort({ accessionNumber: 1 }),
    ]);

    if (!book) throw new HttpError(404, 'Book not found.');
    res.json({ book, copies });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = bookSchema.parse(req.body);
    const existingIsbn = await Book.findOne({ isbn: parsed.isbn });
    if (existingIsbn) {
      throw new HttpError(409, `A book with ISBN ${parsed.isbn} already exists.`);
    }

    const available =
      parsed.availableCopies !== undefined
        ? Math.min(parsed.availableCopies, parsed.totalCopies)
        : parsed.totalCopies;

    const count = await Book.countDocuments();
    const bookCode = `${formatCode('BK', 1001 + count)}-${crypto.randomInt(10, 99)}`;

    const book = await Book.create({
      bookCode,
      isbn: parsed.isbn,
      title: parsed.title,
      authorId: parsed.authorId,
      publisherId: parsed.publisherId,
      categoryId: parsed.categoryId,
      description: parsed.description,
      coverImageUrl: parsed.coverImageUrl,
      publicationDate: new Date(parsed.publicationDate),
      edition: parsed.edition,
      language: parsed.language,
      shelfNumber: parsed.shelfNumber,
      totalCopies: parsed.totalCopies,
      availableCopies: available,
      status: parsed.status || (available === 0 ? 'OUT_OF_STOCK' : 'AVAILABLE'),
    });

    // Generate individual tracked physical copies
    const copies = [];
    for (let i = 1; i <= parsed.totalCopies; i++) {
      const rand = crypto.randomInt(100, 999);
      copies.push({
        bookId: book._id,
        accessionNumber: `ACC-${bookCode}-${String(i).padStart(2, '0')}`,
        barcode: `${Date.now().toString().slice(-6)}${rand}${String(i).padStart(2, '0')}`,
        condition: 'NEW',
        status: i <= available ? 'AVAILABLE' : 'ISSUED',
        rackLocation: parsed.shelfNumber,
      });
    }
    await BookCopy.insertMany(copies);

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'BOOK_CREATED',
      entityType: 'Book',
      entityId: String(book._id),
      details: `Added book "${book.title}" (ISBN ${book.isbn}) with ${book.totalCopies} copies.`,
      ipAddress: req.ip,
    });

    const populated = await Book.findById(book._id)
      .populate('authorId', 'name')
      .populate('publisherId', 'name')
      .populate('categoryId', 'name code');

    res.status(201).json({ book: populated });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const parsed = bookSchema.parse(req.body);

    const book = await Book.findById(id);
    if (!book) throw new HttpError(404, 'Book not found.');

    const dupIsbn = await Book.findOne({ isbn: parsed.isbn, _id: { $ne: id } });
    if (dupIsbn) {
      throw new HttpError(409, `Another book already uses ISBN ${parsed.isbn}.`);
    }

    const issuedCount = await BookCopy.countDocuments({ bookId: id, status: 'ISSUED' });
    if (parsed.totalCopies < issuedCount) {
      throw new HttpError(
        400,
        `Cannot reduce total copies below ${issuedCount} currently issued physical copies.`
      );
    }

    const currentCopies = await BookCopy.find({ bookId: id }).sort({ accessionNumber: 1 });
    if (parsed.totalCopies > currentCopies.length) {
      const toAdd = parsed.totalCopies - currentCopies.length;
      const newCopies = [];
      for (let i = 1; i <= toAdd; i++) {
        const idx = currentCopies.length + i;
        newCopies.push({
          bookId: book._id,
          accessionNumber: `ACC-${book.bookCode}-${String(idx).padStart(2, '0')}-${crypto.randomInt(10, 99)}`,
          barcode: `${Date.now().toString().slice(-6)}${crypto.randomInt(100, 999)}${idx}`,
          condition: 'NEW',
          status: 'AVAILABLE',
          rackLocation: parsed.shelfNumber,
        });
      }
      await BookCopy.insertMany(newCopies);
    } else if (parsed.totalCopies < currentCopies.length) {
      const toRemove = currentCopies.length - parsed.totalCopies;
      const removable = currentCopies.filter((c) => c.status === 'AVAILABLE').slice(-toRemove);
      if (removable.length < toRemove) {
        throw new HttpError(400, 'Not enough available copies to remove.');
      }
      await BookCopy.deleteMany({ _id: { $in: removable.map((r) => r._id) } });
    }

    const availableCopiesCount = await BookCopy.countDocuments({
      bookId: id,
      status: 'AVAILABLE',
    });

    book.isbn = parsed.isbn;
    book.title = parsed.title;
    book.authorId = parsed.authorId as unknown as typeof book.authorId;
    book.publisherId = parsed.publisherId as unknown as typeof book.publisherId;
    book.categoryId = parsed.categoryId as unknown as typeof book.categoryId;
    book.description = parsed.description;
    if (parsed.coverImageUrl !== undefined) book.coverImageUrl = parsed.coverImageUrl;
    book.publicationDate = new Date(parsed.publicationDate);
    book.edition = parsed.edition;
    book.language = parsed.language;
    book.shelfNumber = parsed.shelfNumber;
    book.totalCopies = parsed.totalCopies;
    book.availableCopies = Math.min(availableCopiesCount, parsed.totalCopies);
    book.status =
      parsed.status === 'ARCHIVED'
        ? 'ARCHIVED'
        : book.availableCopies === 0
        ? 'OUT_OF_STOCK'
        : 'AVAILABLE';
    await book.save();

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'BOOK_UPDATED',
      entityType: 'Book',
      entityId: String(book._id),
      details: `Updated book "${book.title}" (Total copies: ${book.totalCopies}).`,
      ipAddress: req.ip,
    });

    res.json({ book });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const activeIssues = await IssueTransaction.countDocuments({
      bookId: id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    });
    if (activeIssues > 0) {
      throw new HttpError(409, 'Cannot delete a book with active issued copies.');
    }

    const book = await Book.findByIdAndDelete(id);
    if (!book) throw new HttpError(404, 'Book not found.');
    await BookCopy.deleteMany({ bookId: id });

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'BOOK_DELETED',
      entityType: 'Book',
      entityId: id,
      details: `Deleted book "${book.title}" (${book.isbn}).`,
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-action', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map((id: unknown) => objectIdSchema.parse(id)) : [];
    const action = String(req.body.action || '');
    if (ids.length === 0) throw new HttpError(400, 'Select at least one book.');

    if (action === 'ARCHIVE') {
      await Book.updateMany({ _id: { $in: ids } }, { $set: { status: 'ARCHIVED' } });
    } else if (action === 'DELETE') {
      const busy = await IssueTransaction.countDocuments({
        bookId: { $in: ids },
        status: { $in: ['ISSUED', 'OVERDUE'] },
      });
      if (busy > 0) {
        throw new HttpError(409, 'One or more selected books have active loans.');
      }
      await Book.deleteMany({ _id: { $in: ids } });
      await BookCopy.deleteMany({ bookId: { $in: ids } });
    } else {
      throw new HttpError(400, 'Unsupported bulk action.');
    }

    await recordAuditLog({
      actorUserId: String(req.user!._id),
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: `BOOK_BULK_${action}`,
      entityType: 'Book',
      details: `Performed bulk ${action} on ${ids.length} book(s).`,
      ipAddress: req.ip,
    });

    res.json({ ok: true, count: ids.length });
  } catch (err) {
    next(err);
  }
});

export default router;
