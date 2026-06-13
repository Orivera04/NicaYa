import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/db';

let clientToken: string;
let riderToken: string;
let riderProfileId: string;
let tripId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@triptest.motoya' } } });

  // Create client
  const clientRes = await request(app).post('/api/auth/register').send({
    name: 'Trip Client',
    email: 'tripclient@triptest.motoya',
    password: 'password123',
    role: 'CLIENT',
  });
  clientToken = clientRes.body.data.accessToken;

  // Create rider
  const riderRes = await request(app).post('/api/auth/register').send({
    name: 'Trip Rider',
    email: 'triprider@triptest.motoya',
    password: 'password123',
    role: 'RIDER',
  });
  riderToken = riderRes.body.data.accessToken;
  const riderId = riderRes.body.data.user.id;

  // Activate rider subscription
  const profile = await prisma.riderProfile.findUnique({ where: { userId: riderId } });
  riderProfileId = profile!.id;

  await prisma.riderProfile.update({
    where: { id: riderProfileId },
    data: {
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'APPROVED',
    },
  });
});

afterAll(async () => {
  await prisma.trip.deleteMany({
    where: { client: { email: { endsWith: '@triptest.motoya' } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@triptest.motoya' } } });
  await prisma.$disconnect();
});

describe('POST /api/trips', () => {
  it('creates a trip request as client', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        originLat: 12.1364,
        originLng: -86.2514,
        originAddress: 'Test Origin',
        destLat: 12.1504,
        destLng: -86.2694,
        destAddress: 'Test Destination',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trip.status).toBe('REQUESTED');
    expect(res.body.data.trip.suggestedPrice).toBeGreaterThan(0);
    tripId = res.body.data.trip.id;
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/trips').send({
      originLat: 12.1,
      originLng: -86.2,
      originAddress: 'A',
      destLat: 12.2,
      destLng: -86.3,
      destAddress: 'B',
    });
    expect(res.status).toBe(401);
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ originAddress: 'Only address' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/trips/:id/accept', () => {
  it('rider can accept an available trip', async () => {
    const res = await request(app)
      .put(`/api/trips/${tripId}/accept`)
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trip.status).toBe('ACCEPTED');
  });

  it('cannot accept a trip that is already accepted', async () => {
    const res = await request(app)
      .put(`/api/trips/${tripId}/accept`)
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(409);
  });
});

describe('GET /api/trips', () => {
  it('returns trips for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/trips')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.total).toBeGreaterThan(0);
  });
});
