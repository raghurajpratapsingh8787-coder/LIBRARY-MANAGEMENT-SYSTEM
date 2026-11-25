import express from 'express';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth';
import {
  AuditLog,
  Book,
  Category,
  Fine,
  FinePayment,
  IssueTransaction,
  Member,
  Reservation,
  ReturnTransaction,
} from '../models';
import { escapeRegex } from '../utils/libraryRules';

const router = express.Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const now = new Date();
    const soonThreshold = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Automatically mark overdue active issues in query state
    await IssueTransaction.updateMany(
      { status: 'ISSUED', dueDate: { $lt: now } },
      { $set: { status: 'OVERDUE' } }
    );

    const [
      bookStatsAgg,
      totalMembers,
      overdueBooksCount,
      pendingReservationsCount,
      totalCategories,
      fineCollectionAgg,
      monthlyIssueAgg,
      monthlyReturnAgg,
      categoryDistAgg,
      monthlyMembersAgg,
      mostBorrowedBooks,
      recentlyAddedBooks,
      recentlyIssued,
      recentlyReturned,
      overdueAlerts,
      upcomingDueDates,
      recentActivities,
    ] = await Promise.all([
      Book.aggregate([
        { $match: { status: { $ne: 'ARCHIVED' } } },
        {
          $group: {
            _id: null,
            totalTitles: { $sum: 1 },
            totalCopies: { $sum: '$totalCopies' },
            availableCopies: { $sum: '$availableCopies' },
          },
        },
      ]),
      Member.countDocuments(),
      IssueTransaction.countDocuments({ status: 'OVERDUE' }),
      Reservation.countDocuments({ status: { $in: ['PENDING', 'AVAILABLE'] } }),
      Category.countDocuments(),
      FinePayment.aggregate([
        { $match: { paymentMethod: { $ne: 'WAIVER' } } },
        { $group: { _id: null, totalCollected: { $sum: '$amountPaid' } } },
      ]),
      IssueTransaction.aggregate([
        { $match: { issueDate: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: '$issueDate' }, month: { $month: '$issueDate' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      ReturnTransaction.aggregate([
        { $match: { returnDate: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: '$returnDate' }, month: { $month: '$returnDate' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Book.aggregate([
        { $match: { status: { $ne: 'ARCHIVED' } } },
        {
          $group: {
            _id: '$categoryId',
            booksCount: { $sum: 1 },
            copiesCount: { $sum: '$totalCopies' },
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
        {
          $project: {
            name: '$category.name',
            booksCount: 1,
            copiesCount: 1,
          },
        },
        { $sort: { copiesCount: -1 } },
      ]),
      Member.aggregate([
        { $match: { registrationDate: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: '$registrationDate' }, month: { $month: '$registrationDate' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Book.find({ status: { $ne: 'ARCHIVED' } })
        .sort({ borrowCount: -1 })
        .limit(6)
        .populate('authorId', 'name')
        .populate('categoryId', 'name'),
      Book.find({ status: { $ne: 'ARCHIVED' } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('authorId', 'name')
        .populate('categoryId', 'name'),
      IssueTransaction.find()
        .sort({ issueDate: -1 })
        .limit(5)
        .populate('bookId', 'title bookCode')
        .populate('memberId', 'fullName memberCode'),
      ReturnTransaction.find()
        .sort({ returnDate: -1 })
        .limit(5)
        .populate('bookId', 'title bookCode')
        .populate('memberId', 'fullName memberCode'),
      IssueTransaction.find({ status: 'OVERDUE' })
        .sort({ dueDate: 1 })
        .limit(5)
        .populate('bookId', 'title bookCode')
        .populate('memberId', 'fullName memberCode email'),
      IssueTransaction.find({
        status: 'ISSUED',
        dueDate: { $gte: now, $lte: soonThreshold },
      })
        .sort({ dueDate: 1 })
        .limit(5)
        .populate('bookId', 'title bookCode')
        .populate('memberId', 'fullName memberCode'),
      AuditLog.find().sort({ createdAt: -1 }).limit(8),
    ]);

    const bookSummary = bookStatsAgg[0] || {
      totalTitles: 0,
      totalCopies: 0,
      availableCopies: 0,
    };
    const issuedBooksCount = Math.max(0, bookSummary.totalCopies - bookSummary.availableCopies);
    const totalFineCollection = Number((fineCollectionAgg[0]?.totalCollected || 0).toFixed(2));
    const unpaidFinesAgg = await Fine.aggregate([
      { $match: { status: { $in: ['UNPAID', 'PARTIALLY_PAID'] } } },
      { $group: { _id: null, outstanding: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } },
    ]);

    // Build continuous 6-month label series
    const months: Array<{ year: number; month: number; label: string }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleString('en-US', { month: 'short' }),
      });
    }

    const findCount = (
      arr: Array<{ _id: { year: number; month: number }; count: number }>,
      y: number,
      m: number
    ) => arr.find((x) => x._id.year === y && x._id.month === m)?.count || 0;

    const monthlyCirculation = months.map((m) => ({
      month: m.label,
      issued: findCount(monthlyIssueAgg, m.year, m.month),
      returned: findCount(monthlyReturnAgg, m.year, m.month),
      newMembers: findCount(monthlyMembersAgg, m.year, m.month),
    }));

    // Role-tailored personal summary for MEMBER
    let memberPersonal = null;
    if (req.user?.role === 'MEMBER' && req.user.memberId) {
      const [myIssues, myFines, myReservations] = await Promise.all([
        IssueTransaction.find({ memberId: req.user.memberId, status: { $in: ['ISSUED', 'OVERDUE'] } })
          .populate('bookId', 'title isbn shelfNumber'),
        Fine.find({ memberId: req.user.memberId, status: { $in: ['UNPAID', 'PARTIALLY_PAID'] } }),
        Reservation.find({ memberId: req.user.memberId, status: { $in: ['PENDING', 'AVAILABLE'] } })
          .populate('bookId', 'title'),
      ]);
      memberPersonal = {
        activeBorrows: myIssues.length,
        outstandingFines: Number(
          myFines.reduce((acc, f) => acc + (f.amount - f.paidAmount), 0).toFixed(2)
        ),
        activeReservations: myReservations.length,
        currentLoans: myIssues,
      };
    }

    res.json({
      kpis: {
        totalBooks: bookSummary.totalCopies,
        totalTitles: bookSummary.totalTitles,
        availableBooks: bookSummary.availableCopies,
        issuedBooks: issuedBooksCount,
        totalMembers,
        overdueBooks: overdueBooksCount,
        pendingReservations: pendingReservationsCount,
        totalCategories,
        totalFineCollection,
        outstandingFines: Number((unpaidFinesAgg[0]?.outstanding || 0).toFixed(2)),
      },
      charts: {
        monthlyCirculation,
        categoryDistribution: categoryDistAgg,
        mostBorrowed: mostBorrowedBooks.map((b) => ({
          title: b.title.length > 22 ? `${b.title.slice(0, 22)}...` : b.title,
          fullTitle: b.title,
          borrowCount: b.borrowCount,
        })),
        availabilitySplit: [
          { name: 'Available', value: bookSummary.availableCopies },
          { name: 'Issued', value: issuedBooksCount },
        ],
      },
      lists: {
        recentlyAddedBooks,
        popularBooks: mostBorrowedBooks,
        recentlyIssued,
        recentlyReturned,
        overdueAlerts,
        upcomingDueDates,
        recentActivities,
      },
      memberPersonal,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/search', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      res.json({ books: [], members: [] });
      return;
    }

    const regex = new RegExp(escapeRegex(q), 'i');
    const books = await Book.find({
      status: { $ne: 'ARCHIVED' },
      $or: [{ title: regex }, { isbn: regex }, { bookCode: regex }],
    })
      .limit(6)
      .populate('authorId', 'name')
      .select('title isbn bookCode availableCopies totalCopies');

    let members: unknown[] = [];
    if (req.user?.role !== 'MEMBER') {
      members = await Member.find({
        $or: [{ fullName: regex }, { memberCode: regex }, { email: regex }],
      })
        .limit(5)
        .select('fullName memberCode email status');
    }

    res.json({ books, members });
  } catch (err) {
    next(err);
  }
});

export default router;
