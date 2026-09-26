import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { googleApi } from '../../services/googleApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Link2, RefreshCw, Unlink, ExternalLink, Info, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export function GoogleConnectionPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['google-status', businessId],
    queryFn: () => googleApi.getConnectionStatus(businessId).then(r => r.data.data),
    enabled: !!businessId,
    refetchInterval: (query) => (query.state.data?.status === 'SYNCING' ? 3000 : 30000),
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await googleApi.getAuthUrl(businessId);
      const url = res.data.data.url;
      window.location.href = url;
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to get authorization URL');
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await googleApi.syncReviews(businessId);
      showToast('success', 'Sync completed successfully');
      queryClient.invalidateQueries({ queryKey: ['google-status', businessId] });
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Business Profile?')) return;
    setIsDisconnecting(true);
    try {
      await googleApi.disconnect(businessId);
      showToast('success', 'Disconnected successfully');
      queryClient.invalidateQueries({ queryKey: ['google-status', businessId] });
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mt-10" />
      </div>
    );
  }

  const status = data?.status || 'DISCONNECTED';
  const canSync = data?.canSync === true;
  const hasPlaceId = data?.hasPlaceId === true;
  const canPostReplies = data?.canPostReplies === true;
  const isOAuthConfigured = data?.isConfigured !== false;

  // Sync is possible when Places API key is configured and business has a Place ID
  const syncReady = canSync && hasPlaceId;
  // Show sync controls when sync is ready OR there's an active sync status
  const showSyncControls = syncReady || status === 'CONNECTED' || status === 'SYNCING' || status === 'SYNC_ERROR';

  const statusMeta: Record<string, { emoji: string; label: string; badge: 'success' | 'danger' | 'warning' | 'default' }> = {
    CONNECTED: { emoji: '🟢', label: 'Connected', badge: 'success' },
    DISCONNECTED: { emoji: '🔴', label: 'Not Synced', badge: 'danger' },
    EXPIRED: { emoji: '🟡', label: 'Expired', badge: 'warning' },
    SYNCING: { emoji: '🔵', label: 'Syncing...', badge: 'default' },
    SYNC_ERROR: { emoji: '⚠️', label: 'Sync Error', badge: 'danger' },
  };
  const meta = statusMeta[status] || statusMeta.DISCONNECTED;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Connection</h1>
        <p className="text-gray-500 text-sm">Sync reviews from your Google Business Profile</p>
      </div>

      {toast && (
        <div
          className={`p-3 rounded-lg text-sm ${
            toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Review Sync Card */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50">
              <Link2 size={20} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span>{meta.emoji}</span>
                <span className="font-semibold">{meta.label}</span>
                <Badge variant={meta.badge}>{status}</Badge>
              </div>
              {data?.lastSyncAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Last synced: {new Date(data.lastSyncAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {status === 'SYNC_ERROR' && data?.syncError && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
              <strong>Last sync error:</strong> {data.syncError}
            </div>
          )}

          {!canSync ? (
            <div className="bg-amber-50 text-amber-700 text-sm p-3 rounded-lg">
              Google Places API is not configured on this server. Contact your administrator.
            </div>
          ) : !hasPlaceId ? (
            <div className="bg-amber-50 text-amber-700 text-sm p-3 rounded-lg flex items-start gap-2">
              <Settings size={16} className="mt-0.5 shrink-0" />
              <div>
                <p>Set your Google Place ID in business settings to enable review sync.</p>
                <Link to="/dashboard/settings" className="text-amber-800 underline text-xs font-medium">
                  Go to Settings →
                </Link>
              </div>
            </div>
          ) : showSyncControls ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isSyncing || status === 'SYNCING'}
                  disabled={status === 'SYNCING'}
                  onClick={handleSync}
                >
                  <RefreshCw size={16} className="mr-1.5" />
                  {status === 'SYNCING' ? 'Syncing...' : status === 'SYNC_ERROR' ? 'Retry Sync' : 'Sync Reviews'}
                </Button>
              </div>
              <div className="flex items-start gap-1.5 text-xs text-gray-500">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>Google provides up to 5 most relevant reviews per sync. Sync regularly to accumulate more reviews.</span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* OAuth Card (for reply posting) */}
      {isOAuthConfigured && (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Reply Posting (Optional)</h3>
            <p className="text-xs text-gray-500">
              Connect via Google OAuth to post replies directly to Google reviews. Without this, replies are saved as local drafts.
            </p>
            {canPostReplies ? (
              <div className="flex items-center gap-3">
                <Badge variant="success">OAuth Connected</Badge>
                <Button variant="outline" size="sm" isLoading={isDisconnecting} onClick={handleDisconnect}>
                  <Unlink size={16} className="mr-1.5" /> Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {status === 'EXPIRED' && (
                  <p className="text-sm text-amber-600">Your OAuth connection has expired. Please reconnect.</p>
                )}
                <Button variant="outline" size="sm" isLoading={isConnecting} onClick={handleConnect}>
                  <ExternalLink size={16} className="mr-1.5" /> Connect Google OAuth
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GoogleConnectionPage;
