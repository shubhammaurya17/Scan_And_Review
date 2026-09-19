import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/adminApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';

export function CategoryManagementPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id?: string; name: string; slug: string } | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<{ id?: string; text: string; sortOrder: number; isActive: boolean }>({ text: '', sortOrder: 0, isActive: true });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminApi.listCategories().then(r => r.data.data),
  });

  const { data: templates } = useQuery({
    queryKey: ['admin-templates', expandedId],
    queryFn: () => adminApi.getTemplates(expandedId!).then(r => r.data.data),
    enabled: !!expandedId,
  });

  const invalidateCategories = () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
  const invalidateTemplates = () => queryClient.invalidateQueries({ queryKey: ['admin-templates'] });

  const openCreateCategory = () => {
    setEditingCategory({ name: '', slug: '' });
    setShowCategoryForm(true);
  };

  const openEditCategory = (c: any) => {
    setEditingCategory({ id: c.id, name: c.name, slug: c.slug });
    setShowCategoryForm(true);
  };

  const saveCategory = async () => {
    if (!editingCategory) return;
    if (editingCategory.id) {
      await adminApi.updateCategory(editingCategory.id, { name: editingCategory.name, slug: editingCategory.slug });
    } else {
      await adminApi.createCategory({ name: editingCategory.name, slug: editingCategory.slug });
    }
    invalidateCategories();
    setShowCategoryForm(false);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? This cannot be undone.')) return;
    await adminApi.deleteCategory(id);
    invalidateCategories();
  };

  const openCreateTemplate = (categoryId: string) => {
    setTemplateForm({ text: '', sortOrder: (templates?.length || 0), isActive: true });
    setShowTemplateForm(categoryId);
  };

  const openEditTemplate = (categoryId: string, t: any) => {
    setTemplateForm({ id: t.id, text: t.text, sortOrder: t.sortOrder, isActive: t.isActive });
    setShowTemplateForm(categoryId);
  };

  const saveTemplate = async (categoryId: string) => {
    if (templateForm.id) {
      await adminApi.updateTemplate(categoryId, templateForm.id, {
        text: templateForm.text, sortOrder: templateForm.sortOrder, isActive: templateForm.isActive,
      });
    } else {
      await adminApi.createTemplate(categoryId, {
        text: templateForm.text, sortOrder: templateForm.sortOrder, isActive: templateForm.isActive,
      });
    }
    invalidateTemplates();
    invalidateCategories();
    setShowTemplateForm(null);
  };

  const deleteTemplate = async (categoryId: string, templateId: string) => {
    if (!confirm('Delete this question template?')) return;
    await adminApi.deleteTemplate(categoryId, templateId);
    invalidateTemplates();
    invalidateCategories();
  };

  const toggleTemplateActive = async (categoryId: string, t: any) => {
    await adminApi.updateTemplate(categoryId, t.id, { isActive: !t.isActive });
    invalidateTemplates();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Category Management</h1>
          <p className="text-gray-500 text-sm">Categories and their question templates</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreateCategory}>
          <Plus size={16} className="mr-1.5" /> Create Category
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
        </div>
      ) : (
        <div className="space-y-3">
          {(categories || []).map((c: any) => {
            const isExpanded = expandedId === c.id;
            return (
              <Card key={c.id}>
                <CardContent>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.slug}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="info">{c._count?.businesses ?? 0} businesses</Badge>
                      <Badge variant="default">{c._count?.questionTemplates ?? 0} templates</Badge>
                      <button onClick={(e) => { e.stopPropagation(); openEditCategory(c); }} className="p-2 text-gray-400 hover:text-indigo-600">
                        <Pencil size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteCategory(c.id); }} className="p-2 text-gray-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold">Question Templates</h4>
                        <Button variant="outline" size="sm" onClick={() => openCreateTemplate(c.id)}>
                          <Plus size={14} className="mr-1" /> Add Template
                        </Button>
                      </div>
                      {(templates || []).length === 0 ? (
                        <p className="text-sm text-gray-500">No templates yet</p>
                      ) : (
                        (templates || []).map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-6">#{t.sortOrder}</span>
                              <span className="text-sm">{t.text}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => toggleTemplateActive(c.id, t)}>
                                <Badge variant={t.isActive ? 'success' : 'default'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                              </button>
                              <button onClick={() => openEditTemplate(c.id, t)} className="p-1.5 text-gray-400 hover:text-indigo-600">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => deleteTemplate(c.id, t.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}

                      {showTemplateForm === c.id && (
                        <div className="p-3 border rounded-lg space-y-2">
                          <Input
                            label="Question Text"
                            value={templateForm.text}
                            onChange={(e) => setTemplateForm({ ...templateForm, text: e.target.value })}
                          />
                          <Input
                            label="Sort Order"
                            type="number"
                            value={templateForm.sortOrder}
                            onChange={(e) => setTemplateForm({ ...templateForm, sortOrder: parseInt(e.target.value) || 0 })}
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={templateForm.isActive}
                              onChange={(e) => setTemplateForm({ ...templateForm, isActive: e.target.checked })}
                            />
                            Active
                          </label>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowTemplateForm(null)}>Cancel</Button>
                            <Button variant="primary" size="sm" onClick={() => saveTemplate(c.id)}>Save</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showCategoryForm && editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{editingCategory.id ? 'Edit Category' : 'Create Category'}</h3>
              <button onClick={() => setShowCategoryForm(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <Input label="Name" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} />
              <Input label="Slug" value={editingCategory.slug} onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowCategoryForm(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={saveCategory}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryManagementPage;
