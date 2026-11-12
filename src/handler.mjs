import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assess, checklistFor } from '../risk.mjs';
import { seed, MANAGERS } from '../seed.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = path.join(process.env.VERCEL ? '/tmp' : root, 'data.json');
const PORT = process.env.PORT || 3000;
let novices = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : seed();
const save = () => fs.writeFileSync(DB, JSON.stringify(novices, null, 1));
save();

const view = n => ({ ...n, a: assess(n) });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

const body = req => new Promise((res, rej) => {
  let b = ''; req.on('data', c => (b += c));
  req.on('end', () => { try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); } });
});

export const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  try {
    const p = url.pathname;
    let m;
    if (p === '/api/managers') return send(200, MANAGERS);
    if (p === '/api/novices' && req.method === 'GET') return send(200, novices.map(view));
    if ((m = p.match(/^\/api\/novices\/(\w+)\/checkins$/)) && req.method === 'POST') {
      const n = novices.find(x => x.id === m[1]); if (!n) return send(404, { error: 'нет такого' });
      const b = await body(req);
      const mood = Number(b.mood);
      if (!(mood >= 1 && mood <= 5)) return send(400, { error: 'настроение 1–5' });
      const a = assess(n);
      if (a.pending == null) return send(400, { error: 'нет контрольной точки для встречи' });
      n.checkins.push({ milestone: a.pending, date: new Date().toISOString().slice(0, 10), mood, tasksClear: !!b.tasksClear, conditions: !!b.conditions, note: String(b.note || '').slice(0, 500) });
      save(); return send(200, view(n));
    }
    if ((m = p.match(/^\/api\/novices\/(\w+)\/tasks\/(\d+)$/)) && req.method === 'POST') {
      const n = novices.find(x => x.id === m[1]); const t = n?.tasks[+m[2]]; if (!t) return send(404, { error: 'нет такого' });
      t.done = !t.done; save(); return send(200, view(n));
    }
    if ((m = p.match(/^\/api\/novices\/(\w+)\/buddy$/)) && req.method === 'POST') {
      const n = novices.find(x => x.id === m[1]); if (!n) return send(404, { error: 'нет такого' });
      n.buddy = String((await body(req)).buddy || '').slice(0, 100); save(); return send(200, view(n));
    }
    if ((m = p.match(/^\/api\/novices\/(\w+)\/left$/)) && req.method === 'POST') {
      const n = novices.find(x => x.id === m[1]); if (!n) return send(404, { error: 'нет такого' });
      const b = await body(req); const a = assess(n);
      n.status = 'left'; n.leftDay = a.day; n.leftReason = String(b.reason || 'не указана').slice(0, 100);
      save(); return send(200, view(n));
    }
    // Приём из Битрикс24: исходящий вебхук по задаче «Приём» приводится к такому виду
    if (p === '/api/hire' && req.method === 'POST') {
      const b = await body(req);
      const mgr = MANAGERS.find(x => x.id === b.managerId);
      if (!b.name || !mgr) return send(400, { error: 'нужны name и managerId' });
      const n = { id: 'n' + Date.now(), name: String(b.name).slice(0, 100), role: String(b.role || ''), dept: mgr.dept, site: mgr.site, managerId: mgr.id, buddy: '', hireDate: b.hireDate || new Date().toISOString().slice(0, 10), status: 'active', checkins: [], tasks: checklistFor(mgr.dept) };
      novices.push(n); save(); return send(200, view(n));
    }
    if (p === '/api/reset' && req.method === 'POST') { novices = seed(); save(); return send(200, { ok: true }); }

    const file = path.join(root, 'public', p === '/' ? 'index.html' : p);
    if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { send(500, { error: String(e.message) }); }
};

if (!process.env.VERCEL) http.createServer(handler).listen(PORT, () => console.log('http://localhost:' + PORT));
