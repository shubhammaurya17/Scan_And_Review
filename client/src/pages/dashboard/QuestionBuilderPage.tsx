import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Eye, EyeOff } from 'lucide-react';

export function QuestionBuilderPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const queryClient = useQueryClient();
  const [newQuestion, setNewQuestion] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['questions', businessId],
    queryFn: () => businessApi.getQuestions(businessId),
    enabled: !!businessId,
  });

  const createMutation = useMutation({
    mutationFn: (text: string) => businessApi.createQuestion(businessId, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', businessId] });
      setNewQuestion('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      businessApi.updateQuestion(businessId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', businessId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => businessApi.deleteQuestion(businessId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions', businessId] }),
  });

  const activeCount = questions.filter((q: any) => q.isActive).length;

  const handleAddQuestion = () => {
    if (newQuestion.trim() && activeCount < 5) {
      createMutation.mutate(newQuestion.trim());
    }
  };

  const handleMoveQuestion = async (currentIndex: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const newOrder = [...questions];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

    try {
      await businessApi.reorderQuestions(businessId, newOrder.map((q: any) => q.id));
      queryClient.invalidateQueries({ queryKey: ['questions', businessId] });
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Question Builder</h1>
        <p className="text-gray-500 text-sm">Configure the questions customers will rate (3-5 active)</p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={activeCount >= 3 && activeCount <= 5 ? 'success' : 'warning'}>
          {activeCount}/5 active questions
        </Badge>
      </div>

      {/* Add question */}
      <Card>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., How was the food quality?"
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
              className="flex-1"
            />
            <Button
              onClick={handleAddQuestion}
              disabled={!newQuestion.trim() || activeCount >= 5}
              isLoading={createMutation.isPending}
            >
              <Plus size={16} className="mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Question list */}
      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q: any, index: number) => (
            <Card key={q.id}>
              <CardContent className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveQuestion(index, 'up')}
                    disabled={index === 0}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMoveQuestion(index, 'down')}
                    disabled={index === questions.length - 1}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <span className="text-sm text-gray-400 w-6">{index + 1}.</span>

                {editingId === q.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: q.id, data: { text: editText } })}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${q.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                      {q.text}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateMutation.mutate({ id: q.id, data: { isActive: !q.isActive } })}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title={q.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {q.isActive ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                      </button>
                      <button
                        onClick={() => { setEditingId(q.id); setEditText(q.text); }}
                        className="p-1.5 hover:bg-gray-100 rounded"
                      >
                        <Pencil size={16} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(q.id)}
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
    </div>
  );
}
