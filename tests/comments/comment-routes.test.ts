import request from 'supertest';
import app from '../../src/app';
import { createSectorRecord, createUserRecord } from '../../src/repositories/fakes/test-state';
import { signAccessToken } from '../../src/auth/session';
import { Role } from '../../src/domain/enums';

describe('Comment routes', () => {
  it('creates, lists, edits and deletes a comment on a ticket', async () => {
    const sector = createSectorRecord('Atendimento', true);
    const client = createUserRecord({
      name: 'Cliente Comentários',
      email: 'cliente.comentarios@helpdesk.local',
      passwordHash: 'hash-client',
      role: Role.CLIENT,
      sectorId: sector.id,
    });
    const technician = createUserRecord({
      name: 'Técnico Comentários',
      email: 'tecnico.comentarios@helpdesk.local',
      passwordHash: 'hash-tech',
      role: Role.TECHNICIAN,
      sectorId: sector.id,
    });

    const ticket = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${signAccessToken(client)}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        title: 'Aplicativo travando',
        description: 'O aplicativo travou ao iniciar a sessão pela primeira vez.',
      });

    const ticketId = ticket.body.data.ticket.id;

    const assume = await request(app)
      .post(`/api/v1/tickets/${ticketId}/assume`)
      .set('Authorization', `Bearer ${signAccessToken(technician)}`)
      .set('Origin', 'http://localhost:5173');
    expect(assume.status).toBe(200);

    const created = await request(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${signAccessToken(client)}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        body: 'Preciso de uma atualização sobre a correção.',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.comment.body).toBe('Preciso de uma atualização sobre a correção.');

    const list = await request(app)
      .get(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${signAccessToken(technician)}`)
      .set('Origin', 'http://localhost:5173');

    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBeGreaterThan(0);

    const commentId = created.body.data.comment.id;

    const edited = await request(app)
      .patch(`/api/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${signAccessToken(client)}`)
      .set('Origin', 'http://localhost:5173')
      .send({ body: 'Atualizei o comentário para mais detalhes.' });

    expect(edited.status).toBe(200);
    expect(edited.body.data.comment.body).toBe('Atualizei o comentário para mais detalhes.');

    const removed = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${signAccessToken(client)}`)
      .set('Origin', 'http://localhost:5173');

    expect(removed.status).toBe(200);
    expect(removed.body.data.comment.deletedAt).toBeTruthy();
  });

  it('allows a single-level reply and rejects replies to replies', async () => {
    const sector = createSectorRecord('Suporte', true);
    const client = createUserRecord({
      name: 'Cliente Respostas',
      email: 'cliente.respostas@helpdesk.local',
      passwordHash: 'hash-client',
      role: Role.CLIENT,
      sectorId: sector.id,
    });
    const technician = createUserRecord({
      name: 'Técnico Respostas',
      email: 'tecnico.respostas@helpdesk.local',
      passwordHash: 'hash-tech',
      role: Role.TECHNICIAN,
      sectorId: sector.id,
    });

    const ticket = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${signAccessToken(client)}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        title: 'Erro de envio',
        description: 'O envio das mensagens falha em alguns casos específicos.',
      });

    const ticketId = ticket.body.data.ticket.id;

    await request(app)
      .post(`/api/v1/tickets/${ticketId}/assume`)
      .set('Authorization', `Bearer ${signAccessToken(technician)}`)
      .set('Origin', 'http://localhost:5173');

    const root = await request(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${signAccessToken(technician)}`)
      .set('Origin', 'http://localhost:5173')
      .send({ body: 'Vou verificar a causa raiz.' });

    const reply = await request(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${signAccessToken(client)}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        body: 'Obrigado, estou aguardando.',
        parentId: root.body.data.comment.id,
      });

    expect(reply.status).toBe(201);
    expect(reply.body.data.comment.parentId).toBe(root.body.data.comment.id);

    const nestedReply = await request(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${signAccessToken(client)}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        body: 'Essa resposta não deve ser permitida.',
        parentId: reply.body.data.comment.id,
      });

    expect(nestedReply.status).toBe(400);
    expect(nestedReply.body.error.code).toBe('INVALID_COMMENT_PARENT');
  });
});
