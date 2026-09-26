import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Trash2 } from 'lucide-react';

export function SettingsPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const queryClient = useQueryClient();

  const { data: business, isLoading } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => businessApi.getBusiness(businessId),
    enabled: !!businessId,
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [isResetting, setIsResetting] = useState(false);
  const [resetToast, setResetToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => businessApi.updateBusiness(businessId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business', businessId] }),
  });

  if (!businessId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <Card className="mt-6">
          <CardContent className="text-center py-10">
            <p className="text-gray-500">No business selected. Please select a business from the sidebar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mt-10" />
      </div>
    );
  }

  if (!business) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage your business profile</p>
      </div>

      {business.isDemo && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <Badge variant="warning">DEMO</Badge>
          <span className="text-sm text-amber-800">This is a demo business. Data is for testing purposes.</span>
        </div>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Business Name"
              defaultValue={business.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                defaultValue={business.description || ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
              />
            </div>
            <Input
              label="Address"
              defaultValue={business.address || ''}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            />
            <Input
              label="Phone"
              defaultValue={business.phone || ''}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Website"
              defaultValue={business.website || ''}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            />
            <Input
              label="Google Review URL"
              defaultValue={business.googleReviewUrl || ''}
              onChange={e => setForm(f => ({ ...f, googleReviewUrl: e.target.value }))}
              placeholder="https://search.google.com/local/writereview?placeid=..."
            />
            <Input
              label="Google Maps URL"
              defaultValue={business.googleMapsUrl || ''}
              onChange={e => setForm(f => ({ ...f, googleMapsUrl: e.target.value }))}
            />
            <Input
              label="Google Place ID"
              defaultValue={business.googlePlaceId || ''}
              onChange={e => setForm(f => ({ ...f, googlePlaceId: e.target.value }))}
            />
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-4">
            Clear all feedback, sessions, analytics, alerts, and synced Google reviews for this business.
            This action cannot be undone. Your business profile and settings will be preserved.
          </p>

          {resetToast && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              resetToast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {resetToast.message}
            </div>
          )}

          <Button
            variant="danger"
            size="sm"
            isLoading={isResetting}
            onClick={async () => {
              if (!confirm('Are you sure you want to clear ALL data? This will delete all feedback, reviews, analytics, and alerts.')) return;
              if (!confirm('This CANNOT be undone. Type OK to proceed.')) return;
              setIsResetting(true);
              try {
                await businessApi.resetData(businessId);
                setResetToast({ type: 'success', message: 'All data cleared successfully. You can now sync fresh data.' });
                queryClient.invalidateQueries();
              } catch (err: any) {
                setResetToast({ type: 'error', message: err?.response?.data?.error || 'Failed to clear data' });
              } finally {
                setIsResetting(false);
                setTimeout(() => setResetToast(null), 5000);
              }
            }}
          >
            <Trash2 size={16} className="mr-1.5" /> Clear All Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
