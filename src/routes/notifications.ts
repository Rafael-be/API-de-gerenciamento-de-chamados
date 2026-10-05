import { type Response, Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getNotificationsForUser, getUnreadCount, issueSocketTicketForUser, readAllNotifications, readNotification } from '../services/notification.service';

const notificationRouter = Router();

const notificationIdSchema = z.coerce.number().int().positive();

notificationRouter.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const items = await getNotificationsForUser(req.user!.id);

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

notificationRouter.get('/notifications/unread-count', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const unreadCount = await getUnreadCount(req.user!.id);

  res.json({
    success: true,
    data: {
      unreadCount,
    },
  });
});

notificationRouter.patch('/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

  const notification = await readNotification(notificationId.data, req.user!.id);
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

notificationRouter.patch('/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const updatedCount = await readAllNotifications(req.user!.id);

  res.json({
    success: true,
    data: {
      updatedCount,
    },
  });
});

notificationRouter.post('/notifications/socket-ticket', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ticket = await issueSocketTicketForUser(req.user!.id);

  res.json({
    success: true,
    data: ticket,
  });
});

export default notificationRouter;
