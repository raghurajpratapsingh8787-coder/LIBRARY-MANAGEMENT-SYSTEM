import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { Author, Book, Category, Publisher } from '../models';
import { authorSchema, categorySchema, objectIdSchema, publisherSchema } from '../validators/schemas';

const router = express.Router();

// Categories
router.get('/categories', authenticate, async (_req, res, next) => {
  try {
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }),
      Book.aggregate([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
    ]);
    const map = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json({
      categories: categories.map((c) => ({ ...c.toObject(), bookCount: map.get(String(c._id)) || 0 })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const parsed = categorySchema.parse(req.body);
    const created = await Category.create(parsed);
    res.status(201).json({ category: created });
  } catch (err) {
    next(err);
  }
});

router.put('/categories/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const parsed = categorySchema.parse(req.body);
    const updated = await Category.findByIdAndUpdate(id, parsed, { new: true, runValidators: true });
    if (!updated) throw new HttpError(404, 'Category not found.');
    res.json({ category: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const inUse = await Book.countDocuments({ categoryId: id });
    if (inUse > 0) throw new HttpError(409, 'Cannot delete category assigned to existing books.');
    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, 'Category not found.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Authors
router.get('/authors', authenticate, async (_req, res, next) => {
  try {
    const [authors, counts] = await Promise.all([
      Author.find().sort({ name: 1 }),
      Book.aggregate([{ $group: { _id: '$authorId', count: { $sum: 1 } } }]),
    ]);
    const map = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json({
      authors: authors.map((a) => ({ ...a.toObject(), bookCount: map.get(String(a._id)) || 0 })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/authors', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const parsed = authorSchema.parse(req.body);
    const created = await Author.create(parsed);
    res.status(201).json({ author: created });
  } catch (err) {
    next(err);
  }
});

router.put('/authors/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const parsed = authorSchema.parse(req.body);
    const updated = await Author.findByIdAndUpdate(id, parsed, { new: true, runValidators: true });
    if (!updated) throw new HttpError(404, 'Author not found.');
    res.json({ author: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/authors/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const inUse = await Book.countDocuments({ authorId: id });
    if (inUse > 0) throw new HttpError(409, 'Cannot delete author with books in the catalog.');
    const deleted = await Author.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, 'Author not found.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Publishers
router.get('/publishers', authenticate, async (_req, res, next) => {
  try {
    const [publishers, counts] = await Promise.all([
      Publisher.find().sort({ name: 1 }),
      Book.aggregate([{ $group: { _id: '$publisherId', count: { $sum: 1 } } }]),
    ]);
    const map = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json({
      publishers: publishers.map((p) => ({ ...p.toObject(), bookCount: map.get(String(p._id)) || 0 })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/publishers', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const parsed = publisherSchema.parse(req.body);
    const created = await Publisher.create(parsed);
    res.status(201).json({ publisher: created });
  } catch (err) {
    next(err);
  }
});

router.put('/publishers/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const parsed = publisherSchema.parse(req.body);
    const updated = await Publisher.findByIdAndUpdate(id, parsed, { new: true, runValidators: true });
    if (!updated) throw new HttpError(404, 'Publisher not found.');
    res.json({ publisher: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/publishers/:id', authenticate, requireRole('SUPER_ADMIN', 'LIBRARIAN'), async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const inUse = await Book.countDocuments({ publisherId: id });
    if (inUse > 0) throw new HttpError(409, 'Cannot delete publisher with books in the catalog.');
    const deleted = await Publisher.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, 'Publisher not found.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
