import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/adminApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

interface BusinessFormState {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  isDemo: boolean;
  googlePlaceId: string;
  googleReviewUrl: string;
  googleMapsUrl: string;
}

const emptyForm: BusinessFormState = {
  name: '', slug: '', categoryId: '', ownerEmail: '', ownerName: '', ownerPassword: '', isDemo: false,
  googlePlaceId: '', googleReviewUrl: '', googleMapsUrl: '',
};

export function BusinessManagementPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BusinessFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-businesses', page],
    queryFn: () => adminApi.listBusinesses(page).then(r => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminApi.listCategories().then(r => r.data.data),
  });

  const businesses = data?.data || [];
  const pagination = data?.pagination;

  const openCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (b: any) => {
    setForm({
      id: b.id,
      name: b.name,
      slug: b.slug,
      categoryId: b.categoryId || '',
      ownerEmail: '',
      ownerName: '',
      ownerPassword: '',
      isDemo: b.isDemo,
      googlePlaceId: b.googlePlaceId || '',
      googleReviewUrl: b.googleReviewUrl || '',
      googleMapsUrl: b.googleMapsUrl || '',
    });
    setShowForm(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (form.id) {
        await adminApi.updateBusiness(form.id, {
          name: form.name,
          slug: form.slug,
          categoryId: form.categoryId || undefined,
          isDemo: form.isDemo,
          googlePlaceId: form.googlePlaceId || undefined,
          googleReviewUrl: form.googleReviewUrl || undefined,
          googleMapsUrl: form.googleMapsUrl || undefined,
        });
      } else {
        await adminApi.createBusiness({
          name: form.name,
          slug: form.slug,
          categoryId: form.categoryId || undefined,
          ownerEmail: form.ownerEmail || undefined,
          ownerName: form.ownerName || undefined,
          ownerPassword: form.ownerPassword || undefined,
          isDemo: form.isDemo,
          googlePlaceId: form.googlePlaceId || undefined,
          googleReviewUrl: form.googleReviewUrl || undefined,
          googleMapsUrl: form.googleMapsUrl || undefined,
        });
      }
      invalidate();
      setShowForm(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this business? This cannot be undone.')) return;
    await adminApi.deleteBusiness(id);
    invalidate();
  };

  const toggleActive = async (b: any) => {
    await adminApi.updateBusiness(b.id, { isActive: !b.isActive });
    invalidate();
  };

  const toggleDemo = async (b: any) => {
    await adminApi.updateBusiness(b.id, { isDemo: !b.isDemo });
    invalidate();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Management</h1>
          <p className="text-gray-500 text-sm">All businesses on the platform</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={16} className="mr-1.5" /> Create Business
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Slug</th>
                  <th className="text-left px-4 py-3">Owner</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Sessions</th>
                  <th className="text-left px-4 py-3">Questions</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {businesses.map((b: any) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3 text-gray-500">{b.slug}</td>
                    <td className="px-4 py-3 text-gray-500">{b.owner}</td>
                    <td className="px-4 py-3 text-gray-500">{b.category?.name || '—'}</td>
                    <td className="px-4 py-3">{b.sessionCount}</td>
                    <td className="px-4 py-3">{b.questionCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => toggleDemo(b)}>
                          <Badge variant={b.isDemo ? 'info' : 'default'}>{b.isDemo ? 'Demo' : 'Live'}</Badge>
                        </button>
                        <button onClick={() => toggleActive(b)}>
                          <Badge variant={b.isActive ? 'success' : 'danger'}>{b.isActive ? 'Active' : 'Inactive'}</Badge>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(b)} className="p-2 text-gray-400 hover:text-indigo-600">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(b.id)} className="p-2 text-gray-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {businesses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">No businesses found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="px-4 py-2 text-sm text-gray-600">Page {page} of {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{form.id ? 'Edit Business' : 'Create Business'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {(categories || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {!form.id && (
                <>
                  <Input label="Owner Email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
                  <Input label="Owner Name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
                  <Input label="Owner Password" type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
                </>
              )}
              <Input
                label="Google Place ID"
                value={form.googlePlaceId}
                onChange={e => setForm(f => ({ ...f, googlePlaceId: e.target.value }))}
                placeholder="ChIJ..."
              />
              <Input
                label="Google Review URL"
                value={form.googleReviewUrl}
                onChange={e => setForm(f => ({ ...f, googleReviewUrl: e.target.value }))}
                placeholder="https://search.google.com/local/writereview?placeid=..."
              />
              <Input
                label="Google Maps URL"
                value={form.googleMapsUrl}
                onChange={e => setForm(f => ({ ...f, googleMapsUrl: e.target.value }))}
                placeholder="https://maps.google.com/..."
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isDemo} onChange={(e) => setForm({ ...form, isDemo: e.target.checked })} />
                Demo business
              </label>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="primary" size="sm" isLoading={isSaving} onClick={handleSave}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BusinessManagementPage;
