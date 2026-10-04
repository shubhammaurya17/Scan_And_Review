import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Eye, EyeOff, X, Star, List, CheckSquare, Type } from 'lucide-react';

type QuestionType = 'STAR_RATING' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT';

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'STAR_RATING', label: 'Star Rating', icon: <Star size={16} />, description: '1–5 stars' },
  { value: 'SINGLE_CHOICE', label: 'Single Choice', icon: <List size={16} />, description: 'Pick one option' },
  { value: 'MULTI_CHOICE', label: 'Multi Choice', icon: <CheckSquare size={16} />, description: 'Pick multiple options' },
  { value: 'TEXT', label: 'Text', icon: <Type size={16} />, description: 'Free text answer' },
];

function parseOptions(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const [newOption, setNewOption] = useState('');

  const addOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !options.includes(trimmed) && options.length < 10) {
      onChange([...options, trimmed]);
      setNewOption('');
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-xs font-medium"
          >
            {opt}
            <button
              onClick={() => onChange(options.filter((_, idx) => idx !== i))}
              className="hover:text-red-500 transition-colors"
              title="Remove option"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add an option..."
          value={newOption}
          onChange={e => setNewOption(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
          className="flex-1 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={addOption}
          disabled={!newOption.trim() || options.length >= 10}
        >
          <Plus size={14} />
        </Button>
      </div>
      <p className="text-xs text-gray-400">{options.length}/10 options · at least 2 required</p>
    </div>
  );
}

export function QuestionBuilderPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const queryClient = useQueryClient();

  // Add-new-question state
  const [newQuestion, setNewQuestion] = useState('');
  const [newType, setNewType] = useState<QuestionType>('STAR_RATING');
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editType, setEditType] = useState<QuestionType>('STAR_RATING');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editPlaceholder, setEditPlaceholder] = useState('');

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['questions', businessId],
    queryFn: () => businessApi.getQuestions(businessId),
    enabled: !!businessId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { text: string; type: QuestionType; options?: string[]; placeholder?: string }) =>
      businessApi.createQuestion(businessId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', businessId] });
      resetAddForm();
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

  const resetAddForm = () => {
    setNewQuestion('');
    setNewType('STAR_RATING');
    setNewOptions([]);
    setNewPlaceholder('');
    setShowAddForm(false);
  };

  const isChoiceType = (type: QuestionType) => type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE';

  const canAddQuestion = () => {
    if (!newQuestion.trim() || activeCount >= 5) return false;
    if (isChoiceType(newType) && newOptions.length < 2) return false;
    return true;
  };

  const handleAddQuestion = () => {
    if (!canAddQuestion()) return;
    const payload: { text: string; type: QuestionType; options?: string[]; placeholder?: string } = {
      text: newQuestion.trim(),
      type: newType,
    };
    if (isChoiceType(newType)) payload.options = newOptions;
    if (newType === 'TEXT' && newPlaceholder.trim()) payload.placeholder = newPlaceholder.trim();
    createMutation.mutate(payload);
  };

  const startEdit = (q: any) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditType(q.type || 'STAR_RATING');
    setEditOptions(parseOptions(q.options));
    setEditPlaceholder(q.placeholder || '');
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const data: Record<string, unknown> = { text: editText, type: editType };
    if (isChoiceType(editType)) {
      data.options = editOptions;
    } else {
      data.options = null;
    }
    data.placeholder = editType === 'TEXT' ? (editPlaceholder.trim() || null) : null;
    updateMutation.mutate({ id: editingId, data });
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

  const getTypeBadge = (type: string) => {
    const t = QUESTION_TYPES.find(qt => qt.value === type);
    if (!t) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
        {t.icon} {t.label}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Question Builder</h1>
        <p className="text-gray-500 text-sm">Configure the questions customers will answer (3-5 active)</p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={activeCount >= 3 && activeCount <= 5 ? 'success' : 'warning'}>
          {activeCount}/5 active questions
        </Badge>
      </div>

      {/* Add question */}
      <Card>
        <CardContent>
          {!showAddForm ? (
            <Button
              onClick={() => setShowAddForm(true)}
              disabled={activeCount >= 5}
              variant="outline"
              className="w-full"
            >
              <Plus size={16} className="mr-1" /> Add New Question
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Question text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question text</label>
                <Input
                  placeholder="e.g., How was the food quality?"
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Type picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Answer type</label>
                <div className="grid grid-cols-2 gap-2">
                  {QUESTION_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => {
                        setNewType(t.value);
                        if (!isChoiceType(t.value)) setNewOptions([]);
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                        newType === t.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <span className="shrink-0">{t.icon}</span>
                      <div>
                        <div className="font-medium">{t.label}</div>
                        <div className="text-xs text-gray-400">{t.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options editor for choice types */}
              {isChoiceType(newType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                  <OptionsEditor options={newOptions} onChange={setNewOptions} />
                </div>
              )}

              {/* Placeholder for text type */}
              {newType === 'TEXT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder text (optional)</label>
                  <Input
                    placeholder="e.g., Share your thoughts..."
                    value={newPlaceholder}
                    onChange={e => setNewPlaceholder(e.target.value)}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleAddQuestion}
                  disabled={!canAddQuestion()}
                  isLoading={createMutation.isPending}
                >
                  <Plus size={16} className="mr-1" /> Add Question
                </Button>
                <Button variant="ghost" onClick={resetAddForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
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
              <CardContent>
                {editingId === q.id ? (
                  /* ——— Edit mode ——— */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Question text</label>
                      <Input
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Answer type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {QUESTION_TYPES.map(t => (
                          <button
                            key={t.value}
                            onClick={() => {
                              setEditType(t.value);
                              if (!isChoiceType(t.value)) setEditOptions([]);
                            }}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                              editType === t.value
                                ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500'
                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                            }`}
                          >
                            <span className="shrink-0">{t.icon}</span>
                            <div>
                              <div className="font-medium">{t.label}</div>
                              <div className="text-xs text-gray-400">{t.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {isChoiceType(editType) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                        <OptionsEditor options={editOptions} onChange={setEditOptions} />
                      </div>
                    )}

                    {editType === 'TEXT' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder text (optional)</label>
                        <Input
                          value={editPlaceholder}
                          onChange={e => setEditPlaceholder(e.target.value)}
                          placeholder="e.g., Share your thoughts..."
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit} isLoading={updateMutation.isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ——— View mode ——— */
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-0.5 pt-1">
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
                    <span className="text-sm text-gray-400 w-6 pt-1">{index + 1}.</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm ${q.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {q.text}
                        </span>
                        {getTypeBadge(q.type || 'STAR_RATING')}
                      </div>
                      {/* Show options preview for choice types */}
                      {isChoiceType(q.type) && parseOptions(q.options).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {parseOptions(q.options).map((opt: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateMutation.mutate({ id: q.id, data: { isActive: !q.isActive } })}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title={q.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {q.isActive ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                      </button>
                      <button
                        onClick={() => startEdit(q)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Edit question"
                      >
                        <Pencil size={16} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(q.id)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Delete question"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
