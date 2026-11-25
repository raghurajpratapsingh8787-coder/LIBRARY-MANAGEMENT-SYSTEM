import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import {
  Book,
  FinePayment,
  IssueTransaction,
  Member,
  ReturnTransaction,
} from '../models';
import { escapeRegex } from '../utils/libraryRules';

const router = express.Router();

router.get('/:type', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const type = String(req.params.type);
    const fromStr = String(req.query.from || '').trim();
    const toStr = String(req.query.to || '').trim();
    const search = String(req.query.search || '').trim();

    const dateRange: Record<string, Date> = {};
    if (fromStr) {
      const fromDate = new Date(fromStr);
      if (Number.isNaN(fromDate.getTime())) {
        throw new HttpError(400, 'Invalid "from" date filter.');
      }
      dateRange.$gte = fromDate;
    }
    if (toStr) {
      const toDate = new Date(toStr);
      if (Number.isNaN(toDate.getTime())) {
        throw new HttpError(400, 'Invalid "to" date filter.');
      }
      toDate.setHours(23, 59, 59, 999);
      dateRange.$lte = toDate;
    }

    const searchRegex = search ? new RegExp(escapeRegex(search), 'i') : null;

    switch (type) {
      case 'total-books':
      case 'available-books': {
        const filter: Record<string, unknown> = { status: { $ne: 'ARCHIVED' } };
        if (type === 'available-books') filter.availableCopies = { $gt: 0 };
        if (searchRegex) filter.$or = [{ title: searchRegex }, { isbn: searchRegex }, { bookCode: searchRegex }];

        const docs = await Book.find(filter)
          .sort({ title: 1 })
          .populate('authorId', 'name')
          .populate('categoryId', 'name')
          .populate('publisherId', 'name');

        res.json({
          title: type === 'total-books' ? 'Total Books Inventory Report' : 'Available Books Report',
          columns: ['Book Code', 'Title', 'Author', 'Category', 'ISBN', 'Shelf', 'Total', 'Available'],
          rows: docs.map((d) => [
            d.bookCode,
            d.title,
            (d.authorId as unknown as { name?: string })?.name || '',
            (d.categoryId as unknown as { name?: string })?.name || '',
            d.isbn,
            d.shelfNumber,
            d.totalCopies,
            d.availableCopies,
          ]),
        });
        return;
      }

      case 'issued-books':
      case 'overdue-books': {
        const filter: Record<string, unknown> = {
          status: type === 'overdue-books' ? 'OVERDUE' : { $in: ['ISSUED', 'OVERDUE'] },
        };
        if (Object.keys(dateRange).length > 0) filter.issueDate = dateRange;

        const docs = await IssueTransaction.find(filter)
          .sort({ dueDate: 1 })
          .populate('bookId', 'title bookCode')
          .populate('bookCopyId', 'accessionNumber')
          .populate('memberId', 'fullName memberCode');

        const filtered = searchRegex
          ? docs.filter((d) => {
              const b = (d.bookId as unknown as { title?: string })?.title || '';
              const m = (d.memberId as unknown as { fullName?: string })?.fullName || '';
              return searchRegex.test(b) || searchRegex.test(m) || searchRegex.test(d.transactionCode);
            })
          : docs;

        res.json({
          title: type === 'overdue-books' ? 'Overdue Books Report' : 'Currently Issued Books Report',
          columns: ['Transaction', 'Book Title', 'Copy Accession', 'Member', 'Issue Date', 'Due Date', 'Status'],
          rows: filtered.map((d) => [
            d.transactionCode,
            (d.bookId as unknown as { title?: string })?.title || '',
            (d.bookCopyId as unknown as { accessionNumber?: string })?.accessionNumber || '',
            (d.memberId as unknown as { fullName?: string })?.fullName || '',
            new Date(d.issueDate).toISOString().slice(0, 10),
            new Date(d.dueDate).toISOString().slice(0, 10),
            d.status,
          ]),
        });
        return;
      }

      case 'member-activity':
      case 'membership': {
        const filter: Record<string, unknown> = {};
        if (searchRegex) filter.$or = [{ fullName: searchRegex }, { memberCode: searchRegex }, { email: searchRegex }];
        if (Object.keys(dateRange).length > 0) filter.registrationDate = dateRange;

        const members = await Member.find(filter).sort({ activeBorrowCount: -1, fullName: 1 });
        res.json({
          title: type === 'membership' ? 'Membership Directory Report' : 'Member Borrowing Activity Report',
          columns: ['Member Code', 'Full Name', 'Type', 'Status', 'Active Loans', 'Limit', 'Outstanding Fines', 'Expires'],
          rows: members.map((m) => [
            m.memberCode,
            m.fullName,
            m.membershipType,
            m.status,
            m.activeBorrowCount,
            m.maxBorrowLimit,
            `$${m.outstandingFineBalance.toFixed(2)}`,
            new Date(m.membershipExpiryDate).toISOString().slice(0, 10),
          ]),
        });
        return;
      }

      case 'borrowing-history':
      case 'monthly-issue': {
        const filter: Record<string, unknown> = {};
        if (Object.keys(dateRange).length > 0) filter.issueDate = dateRange;
        const docs = await IssueTransaction.find(filter)
          .sort({ issueDate: -1 })
          .limit(300)
          .populate('bookId', 'title')
          .populate('memberId', 'fullName memberCode');

        const filtered = searchRegex
          ? docs.filter((d) => {
              const title = (d.bookId as unknown as { title?: string })?.title || '';
              const member = (d.memberId as unknown as { fullName?: string })?.fullName || '';
              return searchRegex.test(title) || searchRegex.test(member) || searchRegex.test(d.transactionCode);
            })
          : docs;

        res.json({
          title: type === 'monthly-issue' ? 'Monthly Issue Report' : 'Book Borrowing History Report',
          columns: ['Code', 'Book Title', 'Member', 'Issued', 'Due', 'Returned', 'Status'],
          rows: filtered.map((d) => [
            d.transactionCode,
            (d.bookId as unknown as { title?: string })?.title || '',
            (d.memberId as unknown as { fullName?: string })?.fullName || '',
            new Date(d.issueDate).toISOString().slice(0, 10),
            new Date(d.dueDate).toISOString().slice(0, 10),
            d.returnedDate ? new Date(d.returnedDate).toISOString().slice(0, 10) : '—',
            d.status,
          ]),
        });
        return;
      }

      case 'monthly-return': {
        const filter: Record<string, unknown> = {};
        if (Object.keys(dateRange).length > 0) filter.returnDate = dateRange;
        const docs = await ReturnTransaction.find(filter)
          .sort({ returnDate: -1 })
          .limit(300)
          .populate('bookId', 'title')
          .populate('memberId', 'fullName');

        const filtered = searchRegex
          ? docs.filter((d) => {
              const title = (d.bookId as unknown as { title?: string })?.title || '';
              const member = (d.memberId as unknown as { fullName?: string })?.fullName || '';
              return searchRegex.test(title) || searchRegex.test(member) || searchRegex.test(d.returnCode);
            })
          : docs;

        res.json({
          title: 'Monthly Return Report',
          columns: ['Return Code', 'Book Title', 'Member', 'Return Date', 'Overdue Days', 'Fine Assessed', 'Condition'],
          rows: filtered.map((d) => [
            d.returnCode,
            (d.bookId as unknown as { title?: string })?.title || '',
            (d.memberId as unknown as { fullName?: string })?.fullName || '',
            new Date(d.returnDate).toISOString().slice(0, 10),
            d.overdueDays,
            `$${d.fineAmount.toFixed(2)}`,
            d.conditionOnReturn,
          ]),
        });
        return;
      }

      case 'most-borrowed': {
        const bookFilter: Record<string, unknown> = { status: { $ne: 'ARCHIVED' } };
        if (searchRegex) {
          bookFilter.$or = [{ title: searchRegex }, { bookCode: searchRegex }, { isbn: searchRegex }];
        }
        const books = await Book.find(bookFilter)
          .sort({ borrowCount: -1 })
          .limit(50)
          .populate('authorId', 'name')
          .populate('categoryId', 'name');
        res.json({
          title: 'Most Borrowed Books Report',
          columns: ['Rank', 'Book Code', 'Title', 'Author', 'Category', 'Total Borrows', 'Available Copies'],
          rows: books.map((b, i) => [
            i + 1,
            b.bookCode,
            b.title,
            (b.authorId as unknown as { name?: string })?.name || '',
            (b.categoryId as unknown as { name?: string })?.name || '',
            b.borrowCount,
            b.availableCopies,
          ]),
        });
        return;
      }

      case 'category-inventory': {
        const agg = await Book.aggregate([
          { $match: { status: { $ne: 'ARCHIVED' } } },
          {
            $group: {
              _id: '$categoryId',
              titles: { $sum: 1 },
              totalCopies: { $sum: '$totalCopies' },
              availableCopies: { $sum: '$availableCopies' },
              totalBorrows: { $sum: '$borrowCount' },
            },
          },
          {
            $lookup: {
              from: 'categories',
              localField: '_id',
              foreignField: '_id',
              as: 'category',
            },
          },
          { $unwind: '$category' },
          { $sort: { totalCopies: -1 } },
        ]);

        const filteredAgg = searchRegex
          ? agg.filter(
              (row) => searchRegex.test(row.category.name) || searchRegex.test(row.category.code)
            )
          : agg;

        res.json({
          title: 'Category-Wise Inventory Report',
          columns: ['Category Code', 'Category Name', 'Unique Titles', 'Total Copies', 'Available', 'Issued', 'Historical Borrows'],
          rows: filteredAgg.map((row) => [
            row.category.code,
            row.category.name,
            row.titles,
            row.totalCopies,
            row.availableCopies,
            row.totalCopies - row.availableCopies,
            row.totalBorrows,
          ]),
        });
        return;
      }

      case 'fine-collection': {
        const filter: Record<string, unknown> = {};
        if (Object.keys(dateRange).length > 0) filter.paymentDate = dateRange;

        const payments = await FinePayment.find(filter)
          .sort({ paymentDate: -1 })
          .populate('memberId', 'fullName memberCode')
          .populate('fineId', 'fineCode');

        const filtered = searchRegex
          ? payments.filter((p) => {
              const fineCode = (p.fineId as unknown as { fineCode?: string })?.fineCode || '';
              const member = (p.memberId as unknown as { fullName?: string })?.fullName || '';
              return (
                searchRegex.test(p.receiptNumber) ||
                searchRegex.test(fineCode) ||
                searchRegex.test(member)
              );
            })
          : payments;

        res.json({
          title: 'Fine Collection & Settlement Report',
          columns: ['Receipt #', 'Fine Code', 'Member', 'Method', 'Amount', 'Payment Date', 'Notes'],
          rows: filtered.map((p) => [
            p.receiptNumber,
            (p.fineId as unknown as { fineCode?: string })?.fineCode || '',
            (p.memberId as unknown as { fullName?: string })?.fullName || '',
            p.paymentMethod,
            `$${p.amountPaid.toFixed(2)}`,
            new Date(p.paymentDate).toISOString().slice(0, 10),
            p.notes || '—',
          ]),
        });
        return;
      }

      default:
        res.status(400).json({ error: 'Unknown report type.' });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
