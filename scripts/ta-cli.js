#!/usr/bin/env node
// 终端手动跑 TradingAgents：node scripts/ta-cli.js NVDA 2026-11-06
require('../lib/env').loadEnv();
const path = require('path');
const ta = require('../lib/ta');
const { DATA_DIR } = require('../lib/store');

const [ticker = 'NVDA', date = ''] = process.argv.slice(2);
(async () => {
  const job = await ta.run({ ticker, date, analysts: ['market', 'news', 'fundamentals'] });
  console.log(`开始分析 ${job.symbol} ${date || '(最新)'} · 模式：${job.mode === 'llm' ? 'LLM' : '模拟'}`);
  let last = '';
  while (true) {
    await new Promise(r => setTimeout(r, 800));
    const j = ta.getJob(job.id);
    if (j.step !== last) { console.log(`  [${j.progress}%] ${j.step}`); last = j.step; }
    if (j.status === 'done') {
      console.log(`完成：Rating ${j.rating || '—'} · FINAL TRANSACTION PROPOSAL: ${j.proposal || '—'}`);
      console.log('报告：' + path.join(DATA_DIR, 'reports', j.id, 'complete_report.md'));
      setTimeout(() => process.exit(0), 400);
      return;
    }
    if (j.status === 'error') { console.error('失败：' + j.error); process.exit(1); }
  }
})();
