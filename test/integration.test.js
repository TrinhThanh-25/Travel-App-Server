import request from 'supertest';
import { expect } from 'chai';

let app;
let dbModule;
let agent;

describe('API integration tests', function () {
  // increase timeout for DB migrations
  this.timeout(10000);

  before(async () => {
    // use an in-memory SQLite DB for tests
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = ':memory:';

    // import DB and wait for migrations
    dbModule = await import('../db/connect.js');
    await dbModule.ready;

    // import app after DB ready
    const appModule = await import('../server.js');
    app = appModule.default;
    agent = request(app);
  });

  it('should register, login and return /auth/me', async () => {
    // register
    const reg = await agent.post('/auth/register').send({ username: 'testuser', email: 't@example.com', password: 'password' });
    expect(reg.status).to.equal(200);
    expect(reg.body).to.have.property('userId');
    const userId = reg.body.userId;

    // login
    const login = await agent.post('/auth/login').send({ email: 't@example.com', password: 'password' });
    expect(login.status).to.equal(200);
    expect(login.body).to.have.property('token');
    const token = login.body.token;

    // me
    const me = await agent.get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).to.equal(200);
    expect(me.body).to.have.property('id', userId);
  });

  it('should add location and list it', async () => {
    const res = await agent.post('/api/locations').send({ name: 'Loc A', city: 'CityX' });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('id');

    const list = await agent.get('/api/locations');
    expect(list.status).to.equal(200);
    expect(list.body).to.be.an('array');
    expect(list.body.some(l => l.name === 'Loc A')).to.be.true;
  });

  it('should list trips and get trip detail', async () => {
    const list = await agent.get('/api/trips');
    expect(list.status).to.equal(200);
    expect(list.body).to.have.property('data');
    expect(list.body.data).to.be.an('array');
    if (list.body.data.length > 0) {
      const firstId = list.body.data[0].id;
      const detail = await agent.get(`/api/trips/${firstId}`);
      expect(detail.status).to.equal(200);
      expect(detail.body).to.have.property('id', firstId);
      expect(detail.body).to.have.property('locations');
      expect(detail.body.locations).to.be.an('array');
    }
  });

  it('should create challenge, join and complete it to give points', async () => {
    // create a challenge worth 10 points
    const ch = await agent.post('/api/challenges').send({ name: 'Ch A', reward_point: 10 });
    expect(ch.status).to.equal(200);
    expect(ch.body).to.have.property('id');
    const challengeId = ch.body.id;

    // register another user to join challenge
    const reg2 = await agent.post('/auth/register').send({ username: 'player', email: 'p@example.com', password: 'secret123' });
    const playerId = reg2.body.userId;

    // join
    const join = await agent.post(`/api/challenges/${challengeId}/join`).send({ user_id: playerId });
    expect(join.status).to.equal(200);

    // complete
    const complete = await agent.post(`/api/challenges/${challengeId}/complete`).send({ user_id: playerId });
    expect(complete.status).to.equal(200);

    // verify user has +10 points
    const profile = await agent.get(`/api/users/${playerId}`);
    expect(profile.status).to.equal(200);
    expect(profile.body).to.have.property('total_point');
    expect(profile.body.total_point).to.equal(10);
  });

  it('should add a reward and allow redeem when user has enough points', async () => {
    // create user with points
    const reg = await agent.post('/auth/register').send({ username: 'redeemer', email: 'r@example.com', password: 'pwd12345' });
    const uid = reg.body.userId;
    // top-up points directly via DB for test
    await new Promise((resolve, reject) => {
      dbModule.default.run('UPDATE users SET total_point = ? WHERE id = ?', [50, uid], function (e) {
        if (e) return reject(e);
        resolve();
      });
    });

    // add reward costing 20
    const r = await agent.post('/api/rewards').send({ name: '20-off', cost: 20 });
    expect(r.status).to.equal(200);
    const rewardId = r.body.id;

    // redeem
    const redeem = await agent.post('/api/rewards/redeem').send({ user_id: uid, reward_id: rewardId });
    expect(redeem.status).to.equal(200);
    expect(redeem.body).to.have.property('newTotalPoints');
    expect(redeem.body.newTotalPoints).to.equal(30);
    expect(redeem.body).to.have.property('voucher');
  });
});
