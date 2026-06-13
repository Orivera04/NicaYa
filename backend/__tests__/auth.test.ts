import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/db';

beforeAll(async () => {
  // Clean test users
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.motoya' } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.motoya' } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('registers a client successfully', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Client',
      email: 'client@test.motoya',
      password: 'password123',
      role: 'CLIENT',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('client@test.motoya');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('registers a rider and creates a profile', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Rider',
      email: 'rider@test.motoya',
      password: 'password123',
      role: 'RIDER',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('RIDER');
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Dupe',
      email: 'dupe@test.motoya',
      password: 'password123',
      role: 'CLIENT',
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Dupe 2',
      email: 'dupe@test.motoya',
      password: 'password123',
      role: 'CLIENT',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('DUPLICATE_EMAIL');
  });

  it('validates required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'missing@test.motoya',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Test',
      email: 'login@test.motoya',
      password: 'secret123',
      role: 'CLIENT',
    });
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.motoya',
      password: 'secret123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects invalid password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.motoya',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.motoya',
      password: 'password123',
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Me Test',
      email: 'me@test.motoya',
      password: 'password123',
      role: 'CLIENT',
    });
    accessToken = res.body.data.accessToken;
  });

  it('returns user info with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@test.motoya');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});
