// Muse 后端：Express + JSON 存储
require('./lib/env').loadEnv();
const { iso } = require('./lib/time');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { db, save, uid, log } = require('./lib/store');
const llm = require('./lib/llm');
const market = require('./lib/market');
const quant = require('./lib/quant');
const news = require('./lib/news');
const ta = require('./lib/ta');
const intel = require('./lib/intel');
const bot = require('./lib/bot');

const app = express();
app.use(express.json({ limit: '1mb' }));

// 可选：访问密码（部署到公网时建议设置 MUSE_PASSWORD）
if (process.env.MUSE_PASSWORD) {
  app.use((req, res, next) => {
    const h = req.headers.authorization || '';
    const [, b64] = h.split(' ');
    const pass = b64 ? Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':') : '';
    if (pass === process.env.MUSE_PASSWORD) return next();
    res.set('WWW-Authenticate', 'Basic realm="Muse"').status(401).send('需要密码');
  });
}

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => res.status(500).json({ error: e.message }));
const now = () => iso();

// ---------- 基础 ----------
app.get('/api/health', (req, res) => res.json({
  ok: true, llm: llm.llmConfigured(), model: llm.llmConfigured() ? process.env.LLM_MODEL || 'deepseek-chat' : null,
  firms: !!process.env.FIRMS_MAP_KEY, telegram: bot.telegramEnabled(), time: now()
}));
app.get('/api/settings', (req, res) => res.json(db.settings));
app.put('/api/settings', (req, res) => {
  const b = req.body || {};
  const clean = a => [...new Set((a || []).map(market.cleanSymbol).filter(Boolean))].slice(0, 30);
  if (Array.isArray(b.watchlist)) db.settings.watchlist = clean(b.watchlist);
  if (Array.isArray(b.stockstats)) db.settings.stockstats = clean(b.stockstats);
  if (Array.isArray(b.feeds)) db.settings.feeds = b.feeds.filter(f => /^https?:\/\//.test(f.url)).map(f => ({ name: String(f.name || f.url).slice(0, 40), url: f.url, category: String(f.category || '综合').slice(0, 10) }));
  save(); res.json(db.settings);
});

// ---------- 主要聊天 ----------
app.get('/api/chat', (req, res) => res.json(db.chats.slice(-100)));
app.post('/api/chat', wrap(async (req, res) => {
  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: '内容为空' });
  db.chats.push({ id: uid('c'), role: 'user', content, at: now() });
  let reply;
  if (llm.llmConfigured()) {
    const doing = db.office.tasks.filter(t => t.status === 'doing').map(t => t.title).join('、') || '无';
    const hist = db.chats.slice(-16).map(m => ({ role: m.role, content: m.content }));
    try {
      reply = await llm.chat([{ role: 'system', content: `你是 Muse，用户的个人 AI 总管，说话简洁、像靠谱的同事，用中文。当前进行中的任务：${doing}。` }, ...hist]);
    } catch (e) { reply = '调用模型失败：' + e.message; }
  } else reply = '（模拟模式）收到：「' + content + '」。在 .env 里配置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 后，我就能真正和你聊了。';
  const msg = { id: uid('c'), role: 'assistant', content: reply, at: now() };
  db.chats.push(msg); db.chats = db.chats.slice(-500); save();
  res.json(msg);
}));
app.delete('/api/chat', (req, res) => { db.chats = []; save(); res.json({ ok: true }); });

// ---------- 动态 ----------
app.get('/api/moments', (req, res) => res.json(db.moments.slice(0, 200)));
app.post('/api/moments', (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: '内容为空' });
  log(text, 'user'); res.json(db.moments[0]);
});
app.delete('/api/moments/:id', (req, res) => { db.moments = db.moments.filter(m => m.id !== req.params.id); save(); res.json({ ok: true }); });

// ---------- 通用列表：点子 / 目标 / 资源库 / 自建空间 ----------
for (const col of ['ideas', 'goals', 'resources', 'spaces']) {
  app.get(`/api/${col}`, (req, res) => res.json(db[col]));
  app.post(`/api/${col}`, (req, res) => {
    const b = req.body || {};
    if (!String(b.title || '').trim()) return res.status(400).json({ error: '标题不能为空' });
    const item = { ...b, id: uid(col[0]), title: String(b.title).trim().slice(0, 200), at: now() };
    if (col === 'spaces') item.notes = item.notes || [];
    db[col].unshift(item); save();
    log({ ideas: '新点子：', goals: '新目标：', resources: '收藏资源：', spaces: '创建空间：' }[col] + item.title, col);
    res.json(item);
  });
  app.put(`/api/${col}/:id`, (req, res) => {
    const it = db[col].find(x => x.id === req.params.id);
    if (!it) return res.status(404).json({ error: '不存在' });
    Object.assign(it, req.body || {}, { id: it.id, updatedAt: now() }); save(); res.json(it);
  });
  app.delete(`/api/${col}/:id`, (req, res) => { db[col] = db[col].filter(x => x.id !== req.params.id); save(); res.json({ ok: true }); });
}

// ---------- Muse 总裁办公室 ----------
const STATUS = { doing: '正在干', waiting: '等你', scheduled: '定时', shelved: '搁置', done: '已完成' };
function officeSummary() {
  const counts = Object.fromEntries(Object.keys(STATUS).map(k => [k, 0]));
  db.office.tasks.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
  const doing = db.office.tasks.filter(t => t.status === 'doing');
  const waiting = db.office.tasks.filter(t => t.status === 'waiting');
  const parts = [];
  if (doing[0]) parts.push('正在' + doing[0].title.replace(/^正在/, ''));
  if (doing[1]) parts.push(doing[1].title);
  if (waiting[0]) parts.push('等你：' + waiting[0].title);
  return { counts, line: parts.length ? parts.join(' · ') : '目前没有进行中的任务', posture: doing.length ? '坐着打字' : '靠着椅背', current: doing[0]?.title || null, tasks: db.office.tasks, labels: STATUS, updatedAt: now() };
}
app.get('/api/office', (req, res) => res.json(officeSummary()));
app.post('/api/office/tasks', (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: '任务标题不能为空' });
  const t = { id: uid('t'), title, detail: String(req.body?.detail || ''), status: STATUS[req.body?.status] ? req.body.status : 'doing', updatedAt: now() };
  db.office.tasks.unshift(t); save(); log('下达新任务：' + title, 'office'); res.json(officeSummary());
});
app.put('/api/office/tasks/:id', (req, res) => {
  const t = db.office.tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: '不存在' });
  if (req.body.status && STATUS[req.body.status]) { if (t.status !== req.body.status) log(`任务「${t.title}」→ ${STATUS[req.body.status]}`, 'office'); t.status = req.body.status; }
  if (req.body.title) t.title = String(req.body.title);
  if (req.body.detail != null) t.detail = String(req.body.detail);
  t.updatedAt = now(); save(); res.json(officeSummary());
});
app.delete('/api/office/tasks/:id', (req, res) => { db.office.tasks = db.office.tasks.filter(x => x.id !== req.params.id); save(); res.json(officeSummary()); });

// ---------- Agent 指挥中心 ----------
app.get('/api/agents', (req, res) => res.json(db.agents));
app.put('/api/agents/:id', (req, res) => {
  const a = db.agents.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: '不存在' });
  const b = req.body || {};
  const STATES = ['work', 'slack', 'think', 'happy', 'angry', 'drink', 'toilet', 'idle', 'walk', 'chat', 'auto'];
  if (b.status && STATES.includes(b.status)) { if (b.status === 'auto') a.mode = 'auto'; else { a.status = b.status; a.mode = 'manual'; } }
  if (b.action === 'assign') { a.status = 'work'; a.mode = 'manual'; const t = a.tasks.find(t => t.state === 'idle'); if (t) t.state = 'doing'; }
  if (b.action === 'stop') { a.status = 'idle'; a.mode = 'manual'; a.tasks.forEach(t => { if (t.state === 'doing') t.state = 'paused'; }); }
  if (b.action === 'resume') { a.mode = 'auto'; a.tasks.forEach(t => { if (t.state === 'paused') t.state = 'doing'; }); if (a.tasks.some(t => t.state === 'doing')) a.status = 'work'; }
  for (const k of ['name', 'nick', 'role']) if (b[k]) a[k] = String(b[k]).slice(0, 60);
  save(); res.json(a);
});
app.post('/api/agents/:id/tasks', (req, res) => {
  const a = db.agents.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: '不存在' });
  const title = String(req.body?.title || '').trim(); if (!title) return res.status(400).json({ error: '标题为空' });
  a.tasks.push({ id: uid('k'), title, state: req.body.state === 'doing' ? 'doing' : 'idle' }); save(); res.json(a);
});
app.put('/api/agents/:id/tasks/:tid', (req, res) => {
  const a = db.agents.find(x => x.id === req.params.id); const t = a?.tasks.find(x => x.id === req.params.tid);
  if (!t) return res.status(404).json({ error: '不存在' });
  if (['doing', 'idle', 'paused', 'done'].includes(req.body.state)) t.state = req.body.state;
  if (t.state === 'doing' && a.mode !== 'manual') a.status = 'work';
  save(); res.json(a);
});
app.delete('/api/agents/:id/tasks/:tid', (req, res) => {
  const a = db.agents.find(x => x.id === req.params.id); if (!a) return res.status(404).json({ error: '不存在' });
  a.tasks = a.tasks.filter(x => x.id !== req.params.tid); save(); res.json(a);
});
app.post('/api/agents/:id/command', wrap(async (req, res) => {
  const a = db.agents.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: '不存在' });
  const text = String(req.body?.text || '').trim(); if (!text) return res.status(400).json({ error: '指令为空' });
  a.tasks.push({ id: uid('k'), title: text.slice(0, 60), state: 'doing' });
  a.status = 'work';
  let reply;
  if (llm.llmConfigured()) {
    try { reply = await llm.chat([{ role: 'system', content: `你是 Agent「${a.name} · ${a.nick}」，职责：${a.role}。老板给你下了指令，先用一句话确认，然后直接给出执行结果（中文，简洁）。` }, { role: 'user', content: text }], { max_tokens: 1200 }); }
    catch (e) { reply = '调用模型失败：' + e.message; }
  } else reply = `（模拟）${a.name} 收到：「${text}」，已加入任务看板并开始干活。配置 LLM_API_KEY 后会返回真实执行结果。`;
  a.lastReply = { text, reply, at: now() };
  log(`给 ${a.id} ${a.name} 下指令：${text.slice(0, 40)}`, 'agents');
  save(); res.json({ agent: a, reply });
}));

// ---------- 军事情报 ----------
app.get('/api/intel/layers', (req, res) => res.json(intel.LAYERS));
app.get('/api/intel/iss', wrap(async (req, res) => res.json(await intel.iss())));
app.get('/api/intel/eonet', wrap(async (req, res) => res.json(await intel.eonet())));
app.get('/api/intel/firms', wrap(async (req, res) => res.json(await intel.firms())));

// ---------- 新闻稿 ----------
app.get('/api/news', (req, res) => res.json(news.list({ q: String(req.query.q || ''), day: String(req.query.day || '') })));
app.post('/api/news/sync', wrap(async (req, res) => res.json(await news.sync())));

// ---------- 行情 / 指标 ----------
app.get('/api/stocks/:symbol', wrap(async (req, res) => {
  const d = await market.getDaily(req.params.symbol, String(req.query.range || '1y'));
  res.json({ ...market.snapshot(d), rows: req.query.rows ? d.rows.slice(-Number(req.query.rows)) : undefined });
}));
app.get('/api/stockstats', wrap(async (req, res) => {
  const syms = req.query.symbols ? String(req.query.symbols).split(',') : db.settings.stockstats;
  const out = await Promise.all(syms.map(async s => { try { return market.snapshot(await market.getDaily(s, '2y')); } catch (e) { return { symbol: market.cleanSymbol(s), error: e.message }; } }));
  res.json(out);
}));
app.get('/api/quant/signals', wrap(async (req, res) => res.json(await quant.signals(db.settings.watchlist, String(req.query.strategy || 'trend')))));
app.get('/api/quant/backtest', wrap(async (req, res) => res.json(await quant.backtest(db.settings.watchlist, String(req.query.strategy || 'trend')))));
app.get('/api/quant/rules', (req, res) => res.json({ strategies: Object.fromEntries(Object.entries(quant.STRATS).map(([k, v]) => [k, { name: v.name, rules: v.rules }])), risk: quant.RISK }));

// ---------- TradingAgents ----------
app.post('/api/ta/run', wrap(async (req, res) => {
  const running = [...db.ta.runs].filter(r => r.status === 'running').length;
  if (running >= 2) return res.status(429).json({ error: '已有 2 个分析在跑，等一会儿' });
  res.json(await ta.run({ ticker: req.body?.ticker, date: req.body?.date, analysts: req.body?.analysts }));
}));
app.get('/api/ta/jobs/:id', (req, res) => { const j = ta.getJob(req.params.id); j ? res.json(j) : res.status(404).json({ error: '不存在' }); });
app.get('/api/ta/runs', (req, res) => res.json(db.ta.runs.map(r => ta.getJob(r.id) || r)));
app.get('/api/ta/reports', (req, res) => res.json(db.ta.reports));
app.get('/api/ta/reports/:id/:file', (req, res) => {
  const f = ta.reportFile(req.params.id, req.params.file);
  if (!f || !fs.existsSync(f.path)) return res.status(404).json({ error: '报告不存在' });
  if (req.query.download) res.attachment(`${f.rep.symbol}_${f.rep.date}_${f.sec.file}`);
  if (f.sec.file.endsWith('.html')) return res.type('html').send(fs.readFileSync(f.path, 'utf8'));
  res.type('text/markdown; charset=utf-8').send(fs.readFileSync(f.path, 'utf8'));
});
app.delete('/api/ta/reports/:id', (req, res) => {
  db.ta.reports = db.ta.reports.filter(r => r.id !== req.params.id); save();
  fs.rmSync(path.join(require('./lib/store').DATA_DIR, 'reports', path.basename(req.params.id)), { recursive: true, force: true });
  res.json({ ok: true });
});

// ---------- 交易台审核 ----------
app.get('/api/reviews', (req, res) => res.json(db.reviews));
app.post('/api/reviews', (req, res) => {
  const round = (db.reviews.reduce((m, r) => Math.max(m, r.round), 0) || 0) + 1;
  const prev = db.reviews.find(r => r.status !== 'done');
  const carry = prev ? prev.issues.filter(i => !i.fixed).map(i => ({ ...i, id: uid('i') })) : [];
  if (prev) prev.status = 'done';
  const rv = { id: uid('rv'), round, title: `交易台第 ${round} 轮复审`, status: 'fixing', at: now(), issues: carry };
  db.reviews.unshift(rv); save(); log(`开始交易台第 ${round} 轮复审（带入 ${carry.length} 个未修问题）`, 'review'); res.json(rv);
});
app.post('/api/reviews/:id/issues', (req, res) => {
  const rv = db.reviews.find(r => r.id === req.params.id); if (!rv) return res.status(404).json({ error: '不存在' });
  const text = String(req.body?.text || '').trim(); if (!text) return res.status(400).json({ error: '描述为空' });
  rv.issues.push({ id: uid('i'), level: ['high', 'mid', 'low'].includes(req.body.level) ? req.body.level : 'low', text, fixed: false }); save(); res.json(rv);
});
app.put('/api/reviews/:id/issues/:iid', (req, res) => {
  const rv = db.reviews.find(r => r.id === req.params.id); const it = rv?.issues.find(i => i.id === req.params.iid);
  if (!it) return res.status(404).json({ error: '不存在' });
  it.fixed = !!req.body.fixed;
  if (rv.issues.every(i => i.fixed) && rv.issues.length) { rv.status = 'passed'; log(`交易台第 ${rv.round} 轮复审完全通过 🎉`, 'review'); } else rv.status = 'fixing';
  save(); res.json(rv);
});
app.delete('/api/reviews/:id/issues/:iid', (req, res) => {
  const rv = db.reviews.find(r => r.id === req.params.id); if (!rv) return res.status(404).json({ error: '不存在' });
  rv.issues = rv.issues.filter(i => i.id !== req.params.iid); save(); res.json(rv);
});
app.post('/api/reviews/:id/ai', wrap(async (req, res) => {
  // 让 LLM 审一段代码/方案，结果写成问题清单
  const rv = db.reviews.find(r => r.id === req.params.id); if (!rv) return res.status(404).json({ error: '不存在' });
  const code = String(req.body?.code || '').slice(0, 12000); if (!code) return res.status(400).json({ error: '请粘贴要审的内容' });
  if (!llm.llmConfigured()) return res.status(400).json({ error: '未配置 LLM_API_KEY，无法自动审核' });
  const out = await llm.chat([{ role: 'system', content: '你是严格的交易系统代码审核员。逐条列出问题，每行格式："[高危|中危|低危] 问题描述"，只输出问题列表。' }, { role: 'user', content: code }], { max_tokens: 1500 });
  const map = { 高危: 'high', 中危: 'mid', 低危: 'low' };
  out.split('\n').forEach(l => { const m = l.match(/\[(高危|中危|低危)\]\s*(.+)/); if (m) rv.issues.push({ id: uid('i'), level: map[m[1]], text: m[2].trim(), fixed: false }); });
  save(); res.json(rv);
}));

// ---------- OpenMausBot ----------
app.get('/api/bot', (req, res) => res.json({ ...db.bot, telegram: bot.telegramEnabled(), log: db.bot.log.slice(-60) }));
app.post('/api/bot/message', wrap(async (req, res) => res.json({ reply: await bot.handle(req.body?.text, 'web') })));
app.put('/api/bot', (req, res) => { if (typeof req.body?.enabled === 'boolean') db.bot.enabled = req.body.enabled; save(); res.json(db.bot); });

// SPA 兜底
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Muse 已启动：http://localhost:${PORT}  (LLM: ${llm.llmConfigured() ? '已配置' : '未配置，走模拟模式'})`);
  bot.startTelegram();
  const mins = Number(process.env.NEWS_SYNC_MINUTES || 30);
  if (mins > 0) {
    setTimeout(() => news.sync().catch(() => {}), 5000);
    setInterval(() => news.sync().catch(() => {}), mins * 60e3);
  }
});
