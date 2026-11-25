import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload } from 'lucide-react';
import { BookCover } from '../components/BookCover';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { Author, Book, Category, Publisher } from '../types/library';

const formSchema = z.object({
  isbn: z.string().trim().min(10, 'ISBN must be at least 10 characters.'),
  title: z.string().trim().min(1, 'Book title is required.'),
  authorId: z.string().min(1, 'Select an author.'),
  publisherId: z.string().min(1, 'Select a publisher.'),
  categoryId: z.string().min(1, 'Select a category.'),
  description: z.string().optional().default(''),
  coverImageUrl: z.string().optional().default(''),
  publicationDate: z.string().min(4, 'Publication date is required.'),
  edition: z.string().trim().min(1).default('1st Edition'),
  language: z.string().trim().min(1).default('English'),
  shelfNumber: z.string().trim().min(1, 'Shelf number is required.'),
  totalCopies: z.coerce.number().int().min(1, 'At least 1 copy is required.').max(500),
});

type BookFormValues = z.infer<typeof formSchema>;

export function BookFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookFormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      edition: '1st Edition',
      language: 'English',
      totalCopies: 1,
      publicationDate: new Date().toISOString().slice(0, 10),
    },
  });

  const coverUrl = watch('coverImageUrl');
  const titlePreview = watch('title') || 'New Book';

  useEffect(() => {
    async function loadDeps() {
      const [aRes, pRes, cRes] = await Promise.all([
        apiFetch<{ authors: Author[] }>('/api/taxonomy/authors'),
        apiFetch<{ publishers: Publisher[] }>('/api/taxonomy/publishers'),
        apiFetch<{ categories: Category[] }>('/api/taxonomy/categories'),
      ]);
      setAuthors(aRes.authors);
      setPublishers(pRes.publishers);
      setCategories(cRes.categories);

      if (id) {
        const { book } = await apiFetch<{ book: Book }>(`/api/books/${id}`);
        reset({
          isbn: book.isbn,
          title: book.title,
          authorId: typeof book.authorId === 'string' ? book.authorId : book.authorId._id,
          publisherId: typeof book.publisherId === 'string' ? book.publisherId : book.publisherId._id,
          categoryId: typeof book.categoryId === 'string' ? book.categoryId : book.categoryId._id,
          description: book.description,
          coverImageUrl: book.coverImageUrl,
          publicationDate: new Date(book.publicationDate).toISOString().slice(0, 10),
          edition: book.edition,
          language: book.language,
          shelfNumber: book.shelfNumber,
          totalCopies: book.totalCopies,
        });
      }
    }
    loadDeps().catch((err) => {
      pushToast(err instanceof Error ? err.message : 'Failed to load form options.', 'error');
    });
  }, [id, pushToast, reset]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append('cover', file);
      const res = await apiFetch<{ coverImageUrl: string }>('/api/books/upload-cover', {
        method: 'POST',
        body: fd,
      });
      setValue('coverImageUrl', res.coverImageUrl);
      pushToast('Cover image uploaded and verified.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Cover upload failed.', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const onSubmit = async (values: BookFormValues) => {
    try {
      if (isEditing) {
        await apiFetch(`/api/books/${id}`, {
          method: 'PUT',
          body: JSON.stringify(values),
        });
        pushToast('Book record updated.', 'success');
      } else {
        await apiFetch('/api/books', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        pushToast('New book added to catalog.', 'success');
      }
      navigate('/books');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save book.', 'error');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {isEditing ? 'Edit Book Record' : 'Add New Book'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Register bibliographic metadata, shelf placement, and physical copies
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row items-start gap-5 pb-4 border-b border-slate-200 dark:border-slate-800">
          <BookCover src={coverUrl} title={titlePreview} className="w-24 h-32" />
          <div className="space-y-2 flex-1">
            <div className="text-xs font-medium">Book Cover Image</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload JPEG, PNG, or WebP cover artwork (max 3 MB). Files are verified by signature and stored privately.
            </p>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <Upload className="w-3.5 h-3.5" />
              {uploadingCover ? 'Uploading...' : 'Upload Cover File'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverUpload}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="book-title" className="block text-xs font-medium mb-1">
              Book Title
            </label>
            <input
              id="book-title"
              {...register('title')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label htmlFor="book-isbn" className="block text-xs font-medium mb-1">
              ISBN
            </label>
            <input
              id="book-isbn"
              {...register('isbn')}
              placeholder="978-0-000000-00-0"
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            {errors.isbn && <p className="text-xs text-red-600 mt-1">{errors.isbn.message}</p>}
          </div>

          <div>
            <label htmlFor="book-shelf" className="block text-xs font-medium mb-1">
              Shelf Number
            </label>
            <input
              id="book-shelf"
              {...register('shelfNumber')}
              placeholder="A1-04"
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            {errors.shelfNumber && (
              <p className="text-xs text-red-600 mt-1">{errors.shelfNumber.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="book-author" className="block text-xs font-medium mb-1">
              Author
            </label>
            <select
              id="book-author"
              {...register('authorId')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Select author...</option>
              {authors.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
            {errors.authorId && (
              <p className="text-xs text-red-600 mt-1">{errors.authorId.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="book-category" className="block text-xs font-medium mb-1">
              Category
            </label>
            <select
              id="book-category"
              {...register('categoryId')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-xs text-red-600 mt-1">{errors.categoryId.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="book-publisher" className="block text-xs font-medium mb-1">
              Publisher
            </label>
            <select
              id="book-publisher"
              {...register('publisherId')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Select publisher...</option>
              {publishers.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.publisherId && (
              <p className="text-xs text-red-600 mt-1">{errors.publisherId.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="book-pubdate" className="block text-xs font-medium mb-1">
              Publication Date
            </label>
            <input
              id="book-pubdate"
              type="date"
              {...register('publicationDate')}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="book-edition" className="block text-xs font-medium mb-1">
              Edition
            </label>
            <input
              id="book-edition"
              {...register('edition')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="book-language" className="block text-xs font-medium mb-1">
              Language
            </label>
            <input
              id="book-language"
              {...register('language')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="book-copies" className="block text-xs font-medium mb-1">
              Total Physical Copies
            </label>
            <input
              id="book-copies"
              type="number"
              min={1}
              {...register('totalCopies')}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            {errors.totalCopies && (
              <p className="text-xs text-red-600 mt-1">{errors.totalCopies.message}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="book-desc" className="block text-xs font-medium mb-1">
              Description
            </label>
            <textarea
              id="book-desc"
              rows={3}
              {...register('description')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate('/books')}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Book'}
          </button>
        </div>
      </form>
    </div>
  );
}
