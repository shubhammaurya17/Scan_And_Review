import { prisma } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';

export class GoogleService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = config.GOOGLE_CLIENT_ID || '';
    this.clientSecret = config.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = config.GOOGLE_REDIRECT_URI || '';
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }

  getAuthUrl(businessId: string): string {
    if (!this.isConfigured()) {
      throw new AppError('Google OAuth is not configured on this server', 501);
    }

    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state: businessId,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async handleCallback(code: string, businessId: string) {
    if (!this.isConfigured()) {
      throw new AppError('Google OAuth is not configured', 501);
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const error = await tokenRes.text();
        throw new AppError(`Google token exchange failed: ${error}`, 400);
      }

      const tokens = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

      await prisma.googleConnection.upsert({
        where: { businessId },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiry,
          status: 'CONNECTED',
        },
        create: {
          businessId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry,
          status: 'CONNECTED',
        },
      });

      return { status: 'CONNECTED' };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to connect Google account', 500);
    }
  }

  async disconnect(businessId: string) {
    await prisma.googleConnection.upsert({
      where: { businessId },
      update: { status: 'DISCONNECTED', accessToken: null, refreshToken: null, tokenExpiry: null },
      create: { businessId, status: 'DISCONNECTED' },
    });
    return { status: 'DISCONNECTED' };
  }

  async getConnectionStatus(businessId: string) {
    const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
    if (!conn) {
      return {
        status: 'DISCONNECTED',
        isConfigured: this.isConfigured(),
        lastSyncAt: null,
        syncError: null,
      };
    }

    // Check if token is expired
    let status = conn.status;
    if (status === 'CONNECTED' && conn.tokenExpiry && conn.tokenExpiry < new Date()) {
      status = 'EXPIRED';
      await prisma.googleConnection.update({
        where: { businessId },
        data: { status: 'EXPIRED' },
      });
    }

    return {
      status,
      isConfigured: this.isConfigured(),
      lastSyncAt: conn.lastSyncAt,
      syncError: conn.syncError || null,
    };
  }

  async refreshAccessToken(businessId: string): Promise<string> {
    const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
    if (!conn?.refreshToken) {
      await prisma.googleConnection.update({
        where: { businessId },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('No refresh token available — please reconnect Google', 401);
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: conn.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenRes.ok) {
        await prisma.googleConnection.update({
          where: { businessId },
          data: { status: 'EXPIRED' },
        });
        throw new AppError('Token refresh failed — please reconnect Google', 401);
      }

      const tokens = await tokenRes.json() as { access_token: string; expires_in: number };
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

      await prisma.googleConnection.update({
        where: { businessId },
        data: {
          accessToken: tokens.access_token,
          tokenExpiry,
          status: 'CONNECTED',
        },
      });

      return tokens.access_token;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Failed to refresh Google token', 500);
    }
  }

  async getValidAccessToken(businessId: string): Promise<string> {
    const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
    if (!conn || conn.status === 'DISCONNECTED') {
      throw new AppError('Google Business Profile is not connected', 400);
    }
    if (!conn.accessToken) {
      throw new AppError('No access token — please reconnect Google', 401);
    }
    // If token is still valid (with 5-minute buffer), return it
    if (conn.tokenExpiry && conn.tokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
      return conn.accessToken;
    }
    // Otherwise refresh
    return this.refreshAccessToken(businessId);
  }
}

export const googleService = new GoogleService();
