import { type Response, Router } from 'express';
import { z } from 'zod';
import {
  createSocketTicket,
  getUnreadNotificationCount,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationRead,
} from '../auth/session';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

const notificationRouter = Router();

const notificationIdSchema = z.coerce.number().int().positive();

notificationRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const items = listNotificationsForUser(req.user!.id);

  res.json({
    success: true,
    data: {
      items,
      meta: {
        page: 1,
        limit: items.length || 50,
        total: items.length,
        totalPages: 1,
        hasNext: false,
      },
    },
  });
});

notificationRouter.get('/notifications/unread-count', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const unreadCount = getUnreadNotificationCount(req.user!.id);

  res.json({
    success: true,
    data: {
      unreadCount,
    },
  });
});

notificationRouter.patch('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notificationId = notificationIdSchema.safeParse(req.params.id);

  if (!notificationId.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_NOTIFICATION_ID',
        message: 'Identificador da notificação inválido.',
      },
    });
    return;
  }

  const notification = markNotificationRead(notificationId.data, req.user!.id);
  if (!notification) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notificação não encontrada.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      notification,
    },
  });
});

notificationRouter.patch('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const updatedCount = markAllNotificationsReadForUser(req.user!.id);

  res.json({
    success: true,
    data: {
      updatedCount,
    },
  });
});

notificationRouter.post('/notifications/socket-ticket', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const ticket = createSocketTicket(req.user!.id);

  res.json({
    success: true,
    data: ticket,
  });
});

export default notificationRouter;
