import request from 'supertest';
import app from '../../src/app';
import { signAccessToken } from '../../src/auth/session';
import { createNotificationRecord, createSectorRecord, createUserRecord } from '../../src/repositories/fakes/test-state';
import { consumeSocketTicket } from '../../src/services/notification.service';
import { NotificationType, Role } from '../../src/domain/enums';

describe('Notification routes', () => {
  it('lists notifications, marks them as read and issues a socket ticket', async () => {
    const sector = createSectorRecord('Suporte', true);
    const user = createUserRecord({
      name: 'Cliente Notificações',
      email: 'cliente.notificacoes@helpdesk.local',
      passwordHash: 'hash-client',
      role: Role.CLIENT,
      sectorId: sector.id,
    });

    const notification = createNotificationRecord({
      userId: user.id,
      type: NotificationType.COMMENT_CREATED,
      ticketId: 1,
      commentId: null,
      actorId: user.id,
      message: 'Seu chamado recebeu um novo comentário.',
    });

    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${signAccessToken(user)}`)
      .set('Origin', 'http://localhost:5173');

    expect(list.status).toBe(200);
    expect(list.body.data.items.some((item: { id: number }) => item.id === notification.id)).toBe(true);

    const unreadCount = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${signAccessToken(user)}`)
      .set('Origin', 'http://localhost:5173');

    expect(unreadCount.status).toBe(200);
    expect(unreadCount.body.data.unreadCount).toBeGreaterThanOrEqual(1);

    const socketTicket = await request(app)
      .post('/api/v1/notifications/socket-ticket')
      .set('Authorization', `Bearer ${signAccessToken(user)}`)
      .set('Origin', 'http://localhost:5173');

    expect(socketTicket.status).toBe(200);
    expect(socketTicket.body.success).toBe(true);
    expect(socketTicket.body.data.ticket).toEqual(expect.any(String));
    expect(socketTicket.body.data.expiresInSeconds).toBeGreaterThan(0);
    expect(await consumeSocketTicket(socketTicket.body.data.ticket)).toBe(user.id);
    expect(await consumeSocketTicket(socketTicket.body.data.ticket)).toBeNull();

    const read = await request(app)
      .patch(`/api/v1/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${signAccessToken(user)}`)
      .set('Origin', 'http://localhost:5173');

    expect(read.status).toBe(200);
    expect(read.body.data.notification.isRead).toBe(true);

    const readAll = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${signAccessToken(user)}`)
      .set('Origin', 'http://localhost:5173');

    expect(readAll.status).toBe(200);
    expect(readAll.body.data.updatedCount).toBeGreaterThanOrEqual(0);
  });
});
