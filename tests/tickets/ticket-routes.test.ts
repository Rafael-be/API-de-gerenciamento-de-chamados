import request from 'supertest';
import app from '../../src/app';
import { createSectorRecord, createUserRecord } from '../../src/repositories/fakes/test-state';
import { signAccessToken } from '../../src/auth/session';
import { Role, TicketStatus } from '../../src/domain/enums';

describe('Ticket routes', () => {
  it('creates and lists tickets for the client, and exposes the count status', async () => {
    const sector = createSectorRecord('Suporte', true);
    const client = createUserRecord({
      name: 'Cliente Ticket',
      email: 'cliente.ticket@helpdesk.local',
      passwordHash: 'hash-client',
      role: Role.CLIENT,
      sectorId: sector.id,
    });

    const clientToken = signAccessToken(client);

    const created = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        title: 'VPN não conecta',
        description: 'O acesso à VPN falhou após a atualização do Windows.',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.ticket.title).toBe('VPN não conecta');

    const list = await request(app)
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173');

    expect(list.status).toBe(200);
    expect(list.body.data.items[0].title).toBe('VPN não conecta');

    const counts = await request(app)
      .get('/api/v1/tickets/counts')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173');

    expect(counts.status).toBe(200);
    expect(counts.body.data).toEqual(expect.objectContaining({ OPEN: 1 }));
  });

  it('validates access control, ticket detail and invalid states for client and technician', async () => {
    const sector = createSectorRecord('Atendimento', true);
    const client = createUserRecord({
      name: 'Cliente Validação',
      email: 'cliente.validacao@helpdesk.local',
      passwordHash: 'hash-client',
      role: Role.CLIENT,
      sectorId: sector.id,
    });
    const technician = createUserRecord({
      name: 'Técnico Validador',
      email: 'tecnico.validacao@helpdesk.local',
      passwordHash: 'hash-tech',
      role: Role.TECHNICIAN,
      sectorId: sector.id,
    });

    const clientToken = signAccessToken(client);
    const technicianToken = signAccessToken(technician);

    const created = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        title: 'Servidor lento',
        description: 'O servidor está respondendo muito devagar durante o expediente.',
      });

    const ticketId = created.body.data.ticket.id;

    const forbiddenList = await request(app)
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(forbiddenList.status).toBe(401);

    const invalidTicketId = await request(app)
      .get('/api/v1/tickets/0')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(invalidTicketId.status).toBe(400);

    const detail = await request(app)
      .get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(detail.status).toBe(200);
    expect(detail.body.data.ticket.title).toBe('Servidor lento');

    const notFound = await request(app)
      .get('/api/v1/tickets/999999')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(notFound.status).toBe(404);

    const patch = await request(app)
      .patch(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173')
      .send({ title: 'Servidor muito lento' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.ticket.title).toBe('Servidor muito lento');

    const invalidPatch = await request(app)
      .patch(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173')
      .send({ title: 'A' });
    expect(invalidPatch.status).toBe(400);

    const cancel = await request(app)
      .post(`/api/v1/tickets/${ticketId}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.ticket.status).toBe(TicketStatus.CANCELLED);

    const patchAfterCancel = await request(app)
      .patch(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173')
      .send({ description: 'Não deve funcionar' });
    expect(patchAfterCancel.status).toBe(400);
  });

  it('covers technician queue, mine and done views plus invalid assume/return/finish states', async () => {
    const sector = createSectorRecord('Suporte N2', true);
    const client = createUserRecord({
      name: 'Cliente Fila',
      email: 'cliente.fila@helpdesk.local',
      passwordHash: 'hash-client',
      role: Role.CLIENT,
      sectorId: sector.id,
    });
    const technician = createUserRecord({
      name: 'Técnico Fila',
      email: 'tecnico.fila@helpdesk.local',
      passwordHash: 'hash-tech',
      role: Role.TECHNICIAN,
      sectorId: sector.id,
    });

    const clientToken = signAccessToken(client);
    const technicianToken = signAccessToken(technician);

    const created = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        title: 'Monitor não pinga',
        description: 'O monitor está sem resposta e não carrega os dados. ',
      });

    const ticketId = created.body.data.ticket.id;

    const queue = await request(app)
      .get('/api/v1/technician/tickets?view=queue')
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(queue.status).toBe(200);
    expect(queue.body.data.items.some((item: { id: number }) => item.id === ticketId)).toBe(true);

    const mine = await request(app)
      .get('/api/v1/technician/tickets?view=mine')
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(mine.status).toBe(200);

    const assumeTicket = await request(app)
      .post(`/api/v1/tickets/${ticketId}/assume`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(assumeTicket.status).toBe(200);

    const returnTicket = await request(app)
      .post(`/api/v1/tickets/${ticketId}/return`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(returnTicket.status).toBe(200);

    const invalidReturn = await request(app)
      .post(`/api/v1/tickets/${ticketId}/return`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(invalidReturn.status).toBe(400);

    const reAssume = await request(app)
      .post(`/api/v1/tickets/${ticketId}/assume`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(reAssume.status).toBe(200);

    const finish = await request(app)
      .post(`/api/v1/tickets/${ticketId}/finish`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173')
      .send({ resolutionNote: 'Problema resolvido.' });
    expect(finish.status).toBe(200);

    const done = await request(app)
      .get('/api/v1/technician/tickets?view=done')
      .set('Authorization', `Bearer ${technicianToken}`)
      .set('Origin', 'http://localhost:5173');
    expect(done.status).toBe(200);
  });

  it('allows a technician to assume, return, and resolve an open ticket', async () => {
    const sector = createSectorRecord('Infra', true);
    const client = createUserRecord({
      name: 'Cliente Tech',
      email: 'cliente.tech@helpdesk.local',
      passwordHash: 'hash-client',
      role: Role.CLIENT,
      sectorId: sector.id,
    });
    const technician = createUserRecord({
      name: 'Técnico',
      email: 'tecnico.ticket@helpdesk.local',
      passwordHash: 'hash-tech',
      role: Role.TECHNICIAN,
      sectorId: sector.id,
    });

    const ticketResponse = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${signAccessToken(client)}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        title: 'Erro ao acessar e-mail',
        description: 'O usuário não consegue entrar no Outlook.',
      });

    const ticketId = ticketResponse.body.data.ticket.id;

    const assume = await request(app)
      .post(`/api/v1/tickets/${ticketId}/assume`)
      .set('Authorization', `Bearer ${signAccessToken(technician)}`)
      .set('Origin', 'http://localhost:5173');

    expect(assume.status).toBe(200);
    expect(assume.body.data.ticket.status).toBe(TicketStatus.IN_PROGRESS);

    const returnTicket = await request(app)
      .post(`/api/v1/tickets/${ticketId}/return`)
      .set('Authorization', `Bearer ${signAccessToken(technician)}`)
      .set('Origin', 'http://localhost:5173');

    expect(returnTicket.status).toBe(200);
    expect(returnTicket.body.data.ticket.status).toBe(TicketStatus.OPEN);

    const reAssume = await request(app)
      .post(`/api/v1/tickets/${ticketId}/assume`)
      .set('Authorization', `Bearer ${signAccessToken(technician)}`)
      .set('Origin', 'http://localhost:5173');

    expect(reAssume.status).toBe(200);

    const finish = await request(app)
      .post(`/api/v1/tickets/${ticketId}/finish`)
      .set('Authorization', `Bearer ${signAccessToken(technician)}`)
      .set('Origin', 'http://localhost:5173')
      .send({ resolutionNote: 'Problema resolvido.' });

    expect(finish.status).toBe(200);
    expect(finish.body.data.ticket.status).toBe(TicketStatus.RESOLVED);
  });
});
