import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

export function SettingsPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const queryClient = useQueryClient();

  const { data: business } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => businessApi.getBusiness(businessId),
    enabled: !!businessId,
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => businessApi.updateBusiness(businessId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business', businessId] }),
  });

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
    </div>
  );
}
