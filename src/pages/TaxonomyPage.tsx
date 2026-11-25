import React, { useEffect, useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { DataTableSkeleton } from '../components/DataTableSkeleton';
import { Modal } from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import type { Author, Category, Publisher } from '../types/library';

interface TaxonomyPageProps {
  mode: 'categories' | 'authors' | 'publishers';
}

export function TaxonomyPage({ mode }: TaxonomyPageProps) {
  const { pushToast } = useToast();
  const [items, setItems] = useState<Array<Category | Author | Publisher>>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [shelfZone, setShelfZone] = useState('');
  const [nationality, setNationality] = useState('');
  const [country, setCountry] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const title =
    mode === 'categories'
      ? 'Book Categories'
      : mode === 'authors'
      ? 'Authors'
      : 'Publishers';

  const endpoint = `/api/taxonomy/${mode}`;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Record<string, Array<Category | Author | Publisher>>>(endpoint);
      setItems(res[mode] || []);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : `Failed to load ${mode}.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setDescription('');
    setShelfZone('');
    setNationality('');
    setCountry('');
    setContactEmail('');
    setModalOpen(true);
  };

  const openEdit = (item: Category | Author | Publisher) => {
    setEditingId(item._id);
    setName(item.name);
    if (mode === 'categories') {
      const c = item as Category;
      setCode(c.code);
      setDescription(c.description || '');
      setShelfZone(c.shelfZone || '');
    } else if (mode === 'authors') {
      const a = item as Author;
      setNationality(a.nationality || '');
      setDescription(a.biography || '');
    } else {
      const p = item as Publisher;
      setCountry(p.country || '');
      setContactEmail(p.contactEmail || '');
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload =
        mode === 'categories'
          ? { name, code, description, shelfZone }
          : mode === 'authors'
          ? { name, nationality, biography: description }
          : { name, country, contactEmail };

      if (editingId) {
        await apiFetch(`${endpoint}/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        pushToast('Updated successfully.', 'success');
      } else {
        await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('Created successfully.', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' });
      pushToast('Deleted successfully.', 'success');
      loadData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage {title.toLowerCase()} linked to the library catalog
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          Add {mode === 'categories' ? 'Category' : mode === 'authors' ? 'Author' : 'Publisher'}
        </button>
      </div>

      {loading ? (
        <DataTableSkeleton rows={6} cols={4} />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500">
                <th className="py-3 px-4">Name</th>
                {mode === 'categories' && <th className="py-3 px-4">Code / Zone</th>}
                {mode === 'authors' && <th className="py-3 px-4">Nationality</th>}
                {mode === 'publishers' && <th className="py-3 px-4">Country / Email</th>}
                <th className="py-3 px-4 text-right">Books</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {items.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{item.name}</div>
                    {mode === 'categories' && (item as Category).description && (
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {(item as Category).description}
                      </div>
                    )}
                    {mode === 'authors' && (item as Author).biography && (
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {(item as Author).biography}
                      </div>
                    )}
                  </td>
                  {mode === 'categories' && (
                    <td className="py-3 px-4 font-mono">
                      {(item as Category).code}
                      {(item as Category).shelfZone ? ` · Zone ${(item as Category).shelfZone}` : ''}
                    </td>
                  )}
                  {mode === 'authors' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {(item as Author).nationality || '—'}
                    </td>
                  )}
                  {mode === 'publishers' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {(item as Publisher).country || '—'} · {(item as Publisher).contactEmail || '—'}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-mono">{item.bookCount ?? 0}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item.name}`}
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item._id)}
                        aria-label={`Delete ${item.name}`}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          {mode === 'categories' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="SYS"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Shelf Zone</label>
                  <input
                    type="text"
                    value={shelfZone}
                    onChange={(e) => setShelfZone(e.target.value)}
                    placeholder="A1"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </>
          )}

          {mode === 'authors' && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Nationality</label>
                <input
                  type="text"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Biography</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </>
          )}

          {mode === 'publishers' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
