import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import * as businessApi from '../../services/businessApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, Copy, Check, ExternalLink, Instagram, Youtube, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export function QRStudioPage() {
  const { currentBusiness } = useAuth();
  const businessId = currentBusiness?.id || '';
  const [copied, setCopied] = useState<string | null>(null);

  const { data: qrConfig } = useQuery({
    queryKey: ['qr-config', businessId],
    queryFn: () => businessApi.getQRConfig(businessId),
    enabled: !!businessId,
  });

  const reviewUrl = qrConfig?.reviewUrl || '';
  const instagramUrl = qrConfig?.instagramUrl || '';
  const youtubeUrl = qrConfig?.youtubeUrl || '';
  const qrImageUrl = `/api/business/${businessId}/qr?format=png&t=${Date.now()}`;
  const qrSvgUrl = `/api/business/${businessId}/qr?format=svg`;

  const handleCopyUrl = async (url: string, key: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
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

  const handleDownloadSocialPNG = (platform: string) => {
    const link = document.createElement('a');
    link.href = `/api/business/${businessId}/social-qr?platform=${platform}&format=png`;
    link.download = `${currentBusiness?.slug || 'qr'}-${platform}-qr.png`;
    link.click();
  };

  const handleDownloadSocialSVG = async (platform: string) => {
    const response = await fetch(`/api/business/${businessId}/social-qr?platform=${platform}&format=svg`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentBusiness?.slug || 'qr'}-${platform}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasSocialLinks = instagramUrl || youtubeUrl;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Studio</h1>
        <p className="text-gray-500 text-sm">Generate and download your review QR code</p>
      </div>

      {/* Review QR */}
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
                <Button variant="outline" size="sm" onClick={() => handleCopyUrl(reviewUrl, 'review')}>
                  {copied === 'review' ? <Check size={16} /> : <Copy size={16} />}
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

      {/* Social Media QR Codes */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Social Media QR Codes</h2>
        <p className="text-gray-500 text-sm mb-4">Help customers find and follow you on social media</p>

        {!hasSocialLinks ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500 mb-3">Add your Instagram or YouTube URLs in Settings to generate QR codes</p>
              <Link to="/dashboard/settings">
                <Button variant="outline" size="sm">
                  <Settings size={16} className="mr-2" /> Go to Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Instagram QR */}
            {instagramUrl && (
              <Card>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                      <Instagram size={18} className="text-white" />
                    </div>
                    <h3 className="font-semibold">Instagram</h3>
                  </div>
                  <div className="text-center mb-4">
                    <div className="bg-white p-3 inline-block rounded-xl border">
                      <img
                        src={`/api/business/${businessId}/social-qr?platform=instagram&format=png&t=${Date.now()}`}
                        alt="Instagram QR Code"
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Scan to follow on Instagram</p>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <code className="flex-1 text-xs bg-gray-50 px-3 py-2 rounded border truncate">
                      {instagramUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => handleCopyUrl(instagramUrl, 'instagram')}>
                      {copied === 'instagram' ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleDownloadSocialPNG('instagram')} variant="outline" size="sm" className="flex-1">
                      <Download size={14} className="mr-1" /> PNG
                    </Button>
                    <Button onClick={() => handleDownloadSocialSVG('instagram')} variant="outline" size="sm" className="flex-1">
                      <Download size={14} className="mr-1" /> SVG
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(instagramUrl, '_blank')}>
                      <ExternalLink size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* YouTube QR */}
            {youtubeUrl && (
              <Card>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                      <Youtube size={18} className="text-white" />
                    </div>
                    <h3 className="font-semibold">YouTube</h3>
                  </div>
                  <div className="text-center mb-4">
                    <div className="bg-white p-3 inline-block rounded-xl border">
                      <img
                        src={`/api/business/${businessId}/social-qr?platform=youtube&format=png&t=${Date.now()}`}
                        alt="YouTube QR Code"
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Scan to subscribe on YouTube</p>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <code className="flex-1 text-xs bg-gray-50 px-3 py-2 rounded border truncate">
                      {youtubeUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => handleCopyUrl(youtubeUrl, 'youtube')}>
                      {copied === 'youtube' ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleDownloadSocialPNG('youtube')} variant="outline" size="sm" className="flex-1">
                      <Download size={14} className="mr-1" /> PNG
                    </Button>
                    <Button onClick={() => handleDownloadSocialSVG('youtube')} variant="outline" size="sm" className="flex-1">
                      <Download size={14} className="mr-1" /> SVG
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(youtubeUrl, '_blank')}>
                      <ExternalLink size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
