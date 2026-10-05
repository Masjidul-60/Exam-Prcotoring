const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const DB = path.join(__dirname, 'data', 'db.json');
const SNAPS = path.join(__dirname, 'data', 'snaps');
fs.mkdirSync(SNAPS, { recursive: true });

const exam = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json')));
const load = () => (fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : {});
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const isAdmin = (req) => (req.headers['x-admin-pass'] || req.query.pass) === ADMIN_PASS;

// Start exam
app.post('/api/start', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 60);
  const roll = String(req.body.roll || '').trim().slice(0, 30);
  if (!name || !roll) return res.status(400).json({ error: 'Name and roll required' });
  const db = load();
  const id = crypto.randomBytes(8).toString('hex');
  const startedAt = Date.now();
  db[id] = { id, name, roll, startedAt, endsAt: startedAt + exam.durationMin * 60000,
    events: [], violations: 0, snaps: [], submitted: false, score: null };
  save(db);
  res.json({
    id, title: exam.title, endsAt: db[id].endsAt, maxViolations: exam.maxViolations,
    questions: exam.questions.map((q) => ({ q: q.q, options: q.options })),
  });
});

// Log suspicious event
app.post('/api/event', (req, res) => {
  const db = load();
  const s = db[req.body.id];
  if (!s || s.submitted) return res.status(400).json({ error: 'Invalid session' });
  s.events.push({ t: Date.now(), type: String(req.body.type).slice(0, 40), detail: String(req.body.detail || '').slice(0, 120) });
  s.violations++;
  save(db);
  res.json({ violations: s.violations, terminate: s.violations >= exam.maxViolations });
});

// Webcam snapshot
app.post('/api/snapshot', (req, res) => {
  const db = load();
  const s = db[req.body.id];
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(req.body.image || '');
  if (!s || s.submitted || !m) return res.status(400).json({ error: 'Bad request' });
  const file = `${Date.now()}.jpg`;
  fs.mkdirSync(path.join(SNAPS, s.id), { recursive: true });
  fs.writeFileSync(path.join(SNAPS, s.id, file), Buffer.from(m[1], 'base64'));
  s.snaps.push(file);
  save(db);
  res.json({ ok: true });
});

// Submit answers
app.post('/api/submit', (req, res) => {
  const db = load();
  const s = db[req.body.id];
  if (!s) return res.status(400).json({ error: 'Invalid session' });
  if (!s.submitted) {
    const ans = req.body.answers || {};
    s.score = exam.questions.reduce((n, q, i) => n + (Number(ans[i]) === q.answer ? 1 : 0), 0);
    s.total = exam.questions.length;
    s.submitted = true;
    s.reason = String(req.body.reason || 'manual').slice(0, 40);
    save(db);
  }
  res.json({ score: s.score, total: s.total });
});

// Admin
app.get('/api/admin/sessions', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(Object.values(load()).sort((a, b) => b.startedAt - a.startedAt));
});
app.get('/api/admin/snap/:id/:file', (req, res) => {
  if (!isAdmin(req)) return res.status(401).end();
  const id = path.basename(req.params.id), f = path.basename(req.params.file);
  res.sendFile(path.join(SNAPS, id, f));
});

app.listen(PORT, () => console.log(`Exam Proctor running: http://localhost:${PORT}  (admin: /admin.html, pass: ${ADMIN_PASS})`));
