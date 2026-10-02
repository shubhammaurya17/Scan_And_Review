import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Eye, EyeOff, RotateCcw } from 'lucide-react';

export default function InsightChipsPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['insights', businessId],
    queryFn: () => businessApi.getInsights(businessId),
    enabled: !!businessId,
  });

  const createMutation = useMutation({
    mutationFn: (label: string) => businessApi.createInsight(businessId, { label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', businessId] });
      setNewLabel('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { label?: string; isActive?: boolean } }) =>
      businessApi.updateInsight(businessId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', businessId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => businessApi.deleteInsight(businessId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insights', businessId] }),
  });

  const resetMutation = useMutation({
    mutationFn: () => businessApi.resetInsights(businessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', businessId] });
      setShowResetConfirm(false);
    },
  });

  const activeCount = insights.filter((i: any) => i.isActive).length;

  const handleAddInsight = () => {
    if (newLabel.trim()) {
      createMutation.mutate(newLabel.trim());
    }
  };

  const handleMoveInsight = async (currentIndex: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= insights.length) return;

    const newOrder = [...insights];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

    try {
      await businessApi.reorderInsights(businessId, newOrder.map((i: any) => i.id));
      queryClient.invalidateQueries({ queryKey: ['insights', businessId] });
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insight Chips</h1>
        <p className="text-gray-500 text-sm">Quick-tap chips shown to customers after rating</p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={activeCount > 0 ? 'success' : 'warning'}>
          {activeCount} active
        </Badge>
      </div>

      {/* Add insight */}
      <Card>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Friendly staff"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddInsight()}
              className="flex-1"
            />
            <Button
              onClick={handleAddInsight}
              disabled={!newLabel.trim()}
              isLoading={createMutation.isPending}
            >
              <Plus size={16} className="mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Insight list */}
      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((insight: any, index: number) => (
            <Card key={insight.id}>
              <CardContent className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveInsight(index, 'up')}
                    disabled={index === 0}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMoveInsight(index, 'down')}
                    disabled={index === insights.length - 1}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <span className="text-sm text-gray-400 w-6">{index + 1}.</span>

                {editingId === insight.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: insight.id, data: { label: editText } })}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${insight.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                      {insight.label}
                    </span>
                    {insight.isCustom && (
                      <Badge variant="default">Custom</Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateMutation.mutate({ id: insight.id, data: { isActive: !insight.isActive } })}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title={insight.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {insight.isActive ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                      </button>
                      <button
                        onClick={() => { setEditingId(insight.id); setEditText(insight.label); }}
                        className="p-1.5 hover:bg-gray-100 rounded"
                      >
                        <Pencil size={16} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(insight.id)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reset to defaults */}
      <div className="pt-4">
        {showResetConfirm ? (
          <Card>
            <CardContent>
              <p className="text-sm text-gray-700 mb-3">
                This will replace all insight chips with the defaults for your business category. Are you sure?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => resetMutation.mutate()}
                  isLoading={resetMutation.isPending}
                >
                  Yes, Reset
                </Button>
                <Button variant="ghost" onClick={() => setShowResetConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button variant="secondary" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw size={16} className="mr-1" /> Reset to Category Defaults
          </Button>
        )}
      </div>
    </div>
  );
}
