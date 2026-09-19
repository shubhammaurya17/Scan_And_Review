import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, Copy, Check, ExternalLink } from 'lucide-react';

export function QRStudioPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const [copied, setCopied] = useState(false);

  const { data: qrConfig } = useQuery({
    queryKey: ['qr-config', businessId],
    queryFn: () => businessApi.getQRConfig(businessId),
    enabled: !!businessId,
  });

  const reviewUrl = qrConfig?.reviewUrl || '';
  const qrImageUrl = `/api/business/${businessId}/qr?format=png&t=${Date.now()}`;
  const qrSvgUrl = `/api/business/${businessId}/qr?format=svg`;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPNG = () => {
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `${currentBusiness?.slug || 'qr'}-review-qr.png`;
    link.click();
  };

  const handleDownloadSVG = async () => {
    const response = await fetch(qrSvgUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentBusiness?.slug || 'qr'}-review-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Studio</h1>
        <p className="text-gray-500 text-sm">Generate and download your review QR code</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* QR Preview */}
        <Card>
          <CardContent className="text-center">
            <h3 className="font-semibold mb-4">QR Code Preview</h3>
            <div className="bg-white p-4 inline-block rounded-xl border">
              <img
                src={qrImageUrl}
                alt="Review QR Code"
                className="w-64 h-64 mx-auto"
              />
            </div>
            <p className="text-sm text-gray-500 mt-3">{currentBusiness?.name}</p>
            <p className="text-xs text-gray-400 mt-1">Scan to leave a review</p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-4">
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-3">Review URL</h3>
              <div className="flex gap-2">
                <code className="flex-1 text-sm bg-gray-50 px-3 py-2 rounded border truncate">
                  {reviewUrl}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="font-semibold mb-3">Download</h3>
              <div className="space-y-2">
                <Button onClick={handleDownloadPNG} variant="outline" className="w-full justify-start">
                  <Download size={16} className="mr-2" /> Download PNG (Print Quality)
                </Button>
                <Button onClick={handleDownloadSVG} variant="outline" className="w-full justify-start">
                  <Download size={16} className="mr-2" /> Download SVG (Scalable)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="font-semibold mb-3">Preview</h3>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.open(reviewUrl, '_blank')}
              >
                <ExternalLink size={16} className="mr-2" /> Open Review Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
