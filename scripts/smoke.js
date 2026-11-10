#!/usr/bin/env node
// 冒烟测试：启动一个假的 OpenAI 兼容服务 + Muse 服务，逐个打主要接口
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const MOCK_PORT = 39001, PORT = 39002;
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const j = JSON.parse(body || '{}');
    const sys = j.messages?.[0]?.content || '';
    let content = '这是模拟模型的回复。';
    if (sys.includes('Portfolio Manager')) content = 'Rating: Hold\n\n理由：测试。\n\nFINAL TRANSACTION PROPOSAL: **HOLD**';
    else if (sys.includes('Trader')) content = 'Action: Hold\n\nFINAL TRANSACTION PROPOSAL: **HOLD**';
    else if (sys.includes('新媒体编辑')) content = '测试标题\n\n测试正文。';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
  });
}).listen(MOCK_PORT);

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-smoke-'));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT, DATA_DIR: dataDir, NEWS_SYNC_MINUTES: '0', LLM_BASE_URL: `http://localhost:${MOCK_PORT}/v1`, LLM_API_KEY: 'test', LLM_MODEL: 'mock' },
  stdio: 'inherit'
});
const B = `http://localhost:${PORT}`;
const get = (p, o) => fetch(B + p, o).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + t.slice(0, 200)); try { return JSON.parse(t); } catch { return t; } });
const post = (p, b) => get(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) });
let fails = 0;
async function check(name, fn) {
  try { const r = await fn(); console.log('✔', name, r ?? ''); } catch (e) { fails++; console.log('✘', name, e.message); }
}
(async () => {
  await new Promise(r => setTimeout(r, 1200));
  await check('health', async () => { const h = await get('/api/health'); if (!h.llm) throw new Error('llm 未识别'); return ''; });
  await check('chat (LLM)', async () => (await post('/api/chat', { content: '你好' })).content.slice(0, 20));
  await check('office', async () => (await get('/api/office')).line);
  await check('office add task', async () => (await post('/api/office/tasks', { title: '冒烟测试任务' })).counts.doing);
  await check('agent command', async () => (await post('/api/agents/U02/command', { text: '写周报' })).reply.slice(0, 20));
  await check('ideas CRUD', async () => (await post('/api/ideas', { title: '测试点子' })).id);
  await check('intel layers', async () => (await get('/api/intel/layers')).points.length + ' 点');
  await check('intel iss', async () => { const d = await get('/api/intel/iss'); return `${d.lat.toFixed(1)},${d.lng.toFixed(1)}`; });
  await check('intel eonet', async () => (await get('/api/intel/eonet')).length + ' 个野火');
  await check('news sync', async () => { const r = await post('/api/news/sync'); return `新增 ${r.added}，改写 ${r.rewritten}`; });
  await check('stock NVDA', async () => { const s = await get('/api/stocks/NVDA'); return `${s.date} ${s.close.toFixed(2)} RSI ${s.rsi14.toFixed(1)}`; });
  await check('stockstats', async () => (await get('/api/stockstats')).length + ' 只');
  await check('quant signals', async () => (await get('/api/quant/signals')).filter(s => s.signal).length + ' 个信号');
  await check('quant backtest', async () => { const b = await get('/api/quant/backtest?strategy=revert'); return `${b.trades} 笔 收益 ${b.totalReturn.toFixed(1)}%`; });
  await check('TradingAgents (LLM)', async () => {
    const j = await post('/api/ta/run', { ticker: 'AAPL', date: '' });
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const s = await get('/api/ta/jobs/' + j.id);
      if (s.status === 'done') { const md = await get(`/api/ta/reports/${j.id}/complete_report.md`); return `Rating ${s.rating} / ${s.proposal} · ${md.length} 字`; }
      if (s.status === 'error') throw new Error(s.error);
    }
    throw new Error('超时');
  });
  await check('reviews', async () => (await get('/api/reviews')).length + ' 轮');
  await check('bot /status', async () => (await post('/api/bot/message', { text: '/status' })).reply.split('\n')[0]);
  await check('SPA fallback', async () => { const t = await get('/agents'); if (!String(t).includes('<title>Muse</title>')) throw new Error('index 未返回'); return ''; });
  console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
  srv.kill(); mock.close(); fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})();
