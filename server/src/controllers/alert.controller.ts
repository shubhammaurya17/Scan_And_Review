import { Request, Response, NextFunction } from 'express';
import { alertService } from '../services/alert.service';

export class AlertController {
  async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const type = req.query.type as string | undefined;
      const unreadOnly = req.query.unread === 'true';

      const result = await alertService.getAlerts(businessId, page, pageSize, type, unreadOnly);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await alertService.getUnreadCount(req.params.businessId);
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      await alertService.markRead(req.params.alertId);
      res.json({ success: true, data: { message: 'Alert marked as read' } });
    } catch (err) {
      next(err);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await alertService.markAllRead(req.params.businessId);
      res.json({ success: true, data: { message: 'All alerts marked as read' } });
    } catch (err) {
      next(err);
    }
  }

  async deleteAlert(req: Request, res: Response, next: NextFunction) {
    try {
      await alertService.deleteAlert(req.params.alertId);
      res.json({ success: true, data: { message: 'Alert deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const alertController = new AlertController();
