import QRCode from 'qrcode';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';

export class QRService {
  async generateQR(slug: string, format: 'png' | 'svg' = 'png') {
    const business = await prisma.business.findUnique({
      where: { slug },
      include: { qrConfig: true },
    });

    if (!business) throw new AppError('Business not found', 404);

    const url = `${config.CLIENT_URL}/review/${slug}`;
    const qrConfig = business.qrConfig;
    const foreground = qrConfig?.foregroundColor || '#000000';
    const background = qrConfig?.backgroundColor || '#FFFFFF';

    const options = {
      color: { dark: foreground, light: background },
      width: 512,
      margin: 2,
    };

    if (format === 'svg') {
      return QRCode.toString(url, { ...options, type: 'svg' });
    }

    return QRCode.toBuffer(url, options);
  }

  async getReviewUrl(slug: string) {
    return `${config.CLIENT_URL}/review/${slug}`;
  }
}

export const qrService = new QRService();
