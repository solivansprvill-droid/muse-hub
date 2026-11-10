// TradingAgents 风格的多智能体分析流水线（参考 TauricResearch/TradingAgents 的角色设计，JS 重写）
const { iso } = require('./time');
// 分析师（技术面/新闻/基本面）→ 多空研究员辩论 → 研究经理裁决 → 交易员计划 → 风控三方辩论 → 组合经理最终决策
const fs = require('fs');
const path = require('path');
const { db, save, uid, log, DATA_DIR } = require('./store');
const { getDaily, sliceTo, snapshot, computeSeries, cleanSymbol } = require('./market');
const { fetchFeed } = require('./rss');
const llm = require('./llm');

const REPORT_DIR = path.join(DATA_DIR, 'reports');
const SECTIONS = [
  ['market', '技术面分析', 'Market Analyst'],
  ['news', '新闻分析', 'News Analyst'],
  ['fundamentals', '基本面分析', 'Fundamentals Analyst'],
  ['bull', '多头研究员观点', 'Bull Researcher'],
  ['bear', '空头研究员观点', 'Bear Researcher'],
  ['manager', '研究经理裁决', 'Research Manager'],
  ['trader', '交易员计划', 'Trader'],
  ['risky', '风控辩论 · 激进派', 'Aggressive Analyst'],
  ['safe', '风控辩论 · 保守派', 'Conservative Analyst'],
  ['neutral', '风控辩论 · 中性派', 'Neutral Analyst'],
  ['final', '组合经理最终决策', 'Portfolio Manager']
];
const jobs = new Map();
const f2 = x => (x == null || isNaN(x) ? '—' : Number(x).toFixed(2));

function indicatorTable(snap) {
  return [
    `| 指标 | 数值 |`, `|---|---|`,
    `| 收盘价 (${snap.date}) | ${f2(snap.close)} |`, `| SMA5 / SMA10 / SMA20 | ${f2(snap.sma5)} / ${f2(snap.sma10)} / ${f2(snap.sma20)} |`,
    `| SMA50 / SMA200 | ${f2(snap.sma50)} / ${f2(snap.sma200)} |`, `| MACD / 信号 / 柱 | ${f2(snap.macd)} / ${f2(snap.macds)} / ${f2(snap.macdh)} |`,
    `| RSI(14) | ${f2(snap.rsi14)} |`, `| 布林上/中/下轨 | ${f2(snap.bollUb)} / ${f2(snap.bollMid)} / ${f2(snap.bollLb)} |`,
    `| ATR(14) | ${f2(snap.atr14)} |`, `| 当日量 / 20日均量 | ${Math.round(snap.volume).toLocaleString()} / ${Math.round(snap.vol20 || 0).toLocaleString()} |`
  ].join('\n');
}

function priceStats(data) {
  const r = data.rows, c = r.map(x => x.close), n = c.length;
  const ret = k => (n > k ? (c[n - 1] / c[n - 1 - k] - 1) * 100 : null);
  const last252 = c.slice(-252);
  const dr = last252.slice(1).map((x, i) => Math.log(x / last252[i]));
  const vol = Math.sqrt(dr.reduce((a, b) => a + b * b, 0) / (dr.length || 1)) * Math.sqrt(252) * 100;
  return { r5: ret(5), r20: ret(20), r60: ret(60), r252: ret(252), hi: Math.max(...last252), lo: Math.min(...last252), vol };
}

function recentBars(data, k = 15) {
  return data.rows.slice(-k).map(r => `${r.date} 开${f2(r.open)} 高${f2(r.high)} 低${f2(r.low)} 收${f2(r.close)} 量${Math.round(r.volume).toLocaleString()}`).join('\n');
}

// ---------- 无 LLM 时的规则化模拟输出 ----------
function sim(key, ctx) {
  const s = ctx.snap, st = ctx.stats, sym = ctx.symbol;
  const trendUp = s.close > (s.sma50 || 0) && (s.sma50 || 0) > (s.sma200 || 0);
  const trendDn = s.close < (s.sma50 || Infinity) && (s.sma50 || 0) < (s.sma200 || Infinity);
  const macdUp = (s.macdh || 0) > 0;
  const rsiTxt = s.rsi14 > 70 ? '超买区' : s.rsi14 < 30 ? '超卖区' : s.rsi14 > 50 ? '偏强' : '偏弱';
  const score = (trendUp ? 2 : trendDn ? -2 : 0) + (macdUp ? 1 : -1) + (s.rsi14 > 70 ? -1 : s.rsi14 < 30 ? 1 : 0) + ((st.r20 || 0) > 0 ? 1 : -1);
  const rating = score >= 3 ? 'Buy' : score >= 1 ? 'Overweight' : score <= -3 ? 'Sell' : score <= -1 ? 'Underweight' : 'Hold';
  const action = score >= 1 ? 'BUY' : score <= -1 ? 'SELL' : 'HOLD';
  const entry = s.close, stop = s.close - 2 * (s.atr14 || 0), tgt = s.close + 3 * (s.atr14 || 0);
  const T = {
    market: `**${sym} 技术面概览（截至 ${s.date}）**\n\n${indicatorTable(s)}\n\n- 趋势：收盘价 ${f2(s.close)}，${s.close > s.sma50 ? '位于' : '低于'} SMA50（${f2(s.sma50)}），${s.close > s.sma200 ? '位于' : '低于'} SMA200（${f2(s.sma200)}）。${trendUp ? '多头排列，中期趋势向上。' : trendDn ? '空头排列，中期趋势向下。' : '均线纠缠，方向不明。'}\n- 动能：MACD 柱 ${f2(s.macdh)}，${macdUp ? '动能偏多' : '动能偏空'}；RSI(14) ${f2(s.rsi14)}，处于${rsiTxt}。\n- 波动：ATR(14) ${f2(s.atr14)}，约占股价 ${f2((s.atr14 / s.close) * 100)}%；年化波动率约 ${f2(st.vol)}%。\n- 区间：近一年最高 ${f2(st.hi)}、最低 ${f2(st.lo)}；近 5/20/60 日涨跌 ${f2(st.r5)}% / ${f2(st.r20)}% / ${f2(st.r60)}%。`,
    news: ctx.headlines.length ? `**近期新闻要点（${ctx.headlines.length} 条）**\n\n${ctx.headlines.slice(0, 10).map(h => `- ${h.title}（${h.at.slice(0, 10)}）`).join('\n')}\n\n（模拟模式未做语义分析，仅列出标题。配置 LLM 后会输出情绪判断与影响分析。）` : '未抓到相关新闻。',
    fundamentals: `**${ctx.name}（${sym}）基本面速览**\n\n- 近一年涨跌：${f2(st.r252)}%；52 周区间 ${f2(s.low52)} ~ ${f2(s.high52)}。\n- 当前价距 52 周高点 ${f2((s.close / (s.high52 || s.close) - 1) * 100)}%。\n- 免费行情源不含完整财报数据；配置 LLM 后会结合模型知识给出营收、利润率、估值等分析（需自行核对最新财报）。`,
    bull: `Bull Analyst：${trendUp ? '均线多头排列，趋势是我们的朋友。' : '短期调整给了更好的入场价。'}MACD 柱 ${f2(s.macdh)}、近 20 日 ${f2(st.r20)}%，${macdUp ? '动能已经转正' : '一旦动能拐头就是反转信号'}。只要守住 SMA200（${f2(s.sma200)}），中长期逻辑不变。`,
    bear: `Bear Analyst：RSI ${f2(s.rsi14)}（${rsiTxt}），${s.close < s.sma50 ? '价格还在 SMA50 下方，' : ''}年化波动 ${f2(st.vol)}% 意味着回撤可能很深。${!macdUp ? 'MACD 柱为负，空头动能未衰竭，' : ''}追高的风险收益比并不好。`,
    manager: `研究经理裁决：综合多空双方，技术打分 ${score}（-5~+5）。建议 **${action === 'BUY' ? '买入' : action === 'SELL' ? '减持/回避' : '观望'}**。理由：${trendUp ? '趋势向上' : trendDn ? '趋势向下' : '趋势不明'}，${macdUp ? '动能偏多' : '动能偏空'}，RSI ${rsiTxt}。`,
    trader: `Trader\n\nAction: ${action === 'BUY' ? 'Buy' : action === 'SELL' ? 'Sell' : 'Hold'}\n\nEntry Price: ${f2(entry)}\n\nStop Loss: ${f2(stop)}\n\nTarget: ${f2(tgt)}\n\nPosition Sizing: ${action === 'BUY' ? '计划仓位的 50% 先建，剩余等回踩确认' : '不新开仓'}\n\nFINAL TRANSACTION PROPOSAL: **${action}**`,
    risky: `Aggressive Analyst：波动就是机会。ATR ${f2(s.atr14)} 给了足够的盈亏空间，${action !== 'SELL' ? '建议仓位提高到计划的 70%。' : '空头趋势里也可以等反弹再做。'}`,
    safe: `Conservative Analyst：保护本金优先。止损应放在 ${f2(stop)}，单笔风险不超过总资金 1%。${s.rsi14 > 65 ? 'RSI 偏高，追涨要克制。' : ''}`,
    neutral: `Neutral Analyst：折中方案——按交易员计划的 50% 建仓，止损 ${f2(stop)}，到目标 ${f2(tgt)} 先兑现一半。`,
    final: `Rating: ${rating}\n\nFINAL TRANSACTION PROPOSAL: **${action}**\n\n组合经理总结：技术打分 ${score}，采纳中性派的仓位方案。入场 ${f2(entry)}、止损 ${f2(stop)}、目标 ${f2(tgt)}。\n\n> 模拟模式：未配置 LLM，以上内容由规则生成。在 .env 设置 LLM_API_KEY 后即可得到完整的多智能体推理报告。`
  };
  return T[key];
}

async function runStep(key, ctx, prompt) {
  if (!llm.llmConfigured()) return sim(key, ctx);
  const sys = `你是 TradingAgents 多智能体交易研究框架中的「${SECTIONS.find(s => s[0] === key)[2]}」。用简体中文输出 Markdown，专业、具体、引用给你的数据，不要编造未提供的数字；不确定的写明需核实。仅供研究，不构成投资建议。`;
  return llm.chat([{ role: 'system', content: sys }, { role: 'user', content: prompt }], { max_tokens: 1600 });
}

async function run({ ticker, date, analysts }) {
  const symbol = cleanSymbol(ticker);
  if (!symbol) throw new Error('请输入股票代码');
  const id = uid('ta');
  const job = { id, symbol, date, status: 'running', step: '准备数据', progress: 0, startedAt: iso(), mode: llm.llmConfigured() ? 'llm' : 'sim', error: null };
  jobs.set(id, job);
  db.ta.runs.unshift({ ...job }); save();
  (async () => {
    try {
      const full = await getDaily(symbol, '2y');
      const data = sliceTo(full, date);
      const snap = snapshot(data);
      const stats = priceStats(data);
      let headlines = [];
      try {
        headlines = await fetchFeed(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`, 20);
        if (date) headlines = headlines.filter(h => h.at.slice(0, 10) <= date);
      } catch {}
      if (headlines.length < 3) {
        // 历史日期：用 Google News 搜索该日期前一周的新闻
        try {
          const end = date || snap.date;
          const d0 = new Date(end + 'T00:00:00Z'); const d1 = new Date(d0.getTime() + 86400e3); const ds = new Date(d0.getTime() - 7 * 86400e3);
          const f = x => iso(x).slice(0, 10);
          const q = encodeURIComponent(`${symbol} stock after:${f(ds)} before:${f(d1)}`);
          const g = await fetchFeed(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, 20);
          headlines = headlines.concat(g.filter(h => h.at.slice(0, 10) <= end));
        } catch {}
      }
      const ctx = { symbol, name: data.name, snap, stats, headlines };
      const out = {};
      const use = new Set(analysts?.length ? analysts : ['market', 'news', 'fundamentals']);
      const base = `标的：${symbol}（${data.name}），分析日期：${snap.date}`;
      const steps = [
        ['market', () => use.has('market') ? runStep('market', ctx, `${base}\n\n技术指标：\n${indicatorTable(snap)}\n\n区间统计：近5/20/60/252日涨跌 ${f2(stats.r5)}%/${f2(stats.r20)}%/${f2(stats.r60)}%/${f2(stats.r252)}%，年化波动 ${f2(stats.vol)}%，一年高低 ${f2(stats.hi)}/${f2(stats.lo)}\n\n最近 15 根日线：\n${recentBars(data)}\n\n请写技术面分析报告：趋势、动能、波动、支撑阻力、交易含义，结尾附一张关键要点表格。`) : null],
        ['news', () => use.has('news') ? runStep('news', ctx, `${base}\n\n近期新闻标题与摘要：\n${headlines.slice(0, 15).map(h => `- [${h.at.slice(0, 10)}] ${h.title}：${h.content.slice(0, 200)}`).join('\n') || '（未抓到新闻）'}\n\n请写新闻与情绪分析：主要事件、情绪倾向、对股价的潜在影响，结尾附要点表格。`) : null],
        ['fundamentals', () => use.has('fundamentals') ? runStep('fundamentals', ctx, `${base}\n\n可用数据：52周区间 ${f2(snap.low52)}~${f2(snap.high52)}，现价 ${f2(snap.close)}，近一年涨跌 ${f2(stats.r252)}%。\n免费数据源不含财报，请基于你掌握的该公司公开信息写基本面分析（业务、增长、盈利能力、估值、风险），明确标注哪些数字需以最新财报核实。`) : null],
        ['bull', () => runStep('bull', ctx, `${base}\n\n分析师报告：\n${['market', 'news', 'fundamentals'].map(k => out[k] || '').join('\n\n').slice(0, 6000)}\n\n你是多头研究员，构建最强的看多论证，并预先反驳可能的空头观点。`)],
        ['bear', () => runStep('bear', ctx, `${base}\n\n分析师报告：\n${['market', 'news', 'fundamentals'].map(k => out[k] || '').join('\n\n').slice(0, 5000)}\n\n多头观点：\n${out.bull.slice(0, 2500)}\n\n你是空头研究员，逐条反驳多头，并给出最强的看空论证。`)],
        ['manager', () => runStep('manager', ctx, `${base}\n\n多头：\n${out.bull.slice(0, 3000)}\n\n空头：\n${out.bear.slice(0, 3000)}\n\n你是研究经理，评判这场辩论，给出明确立场（买入/卖出/持有）与投资计划（理由、策略、注意事项）。`)],
        ['trader', () => runStep('trader', ctx, `${base}\n现价 ${f2(snap.close)}，ATR(14) ${f2(snap.atr14)}\n\n研究经理计划：\n${out.manager.slice(0, 3000)}\n\n你是交易员，给出具体交易计划，按以下格式：Action / Reasoning / Entry Price / Stop Loss / Target / Position Sizing，最后一行必须是 "FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL**"。`)],
        ['risky', () => runStep('risky', ctx, `${base}\n\n交易员计划：\n${out.trader.slice(0, 2500)}\n\n你是激进派风控分析师，论证为什么应该更积极（更大仓位/更早入场），并反驳保守观点。`)],
        ['safe', () => runStep('safe', ctx, `${base}\n\n交易员计划：\n${out.trader.slice(0, 2000)}\n\n激进派观点：\n${out.risky.slice(0, 2000)}\n\n你是保守派风控分析师，指出风险，反驳激进派，给出保护本金的修改建议。`)],
        ['neutral', () => runStep('neutral', ctx, `${base}\n\n交易员计划：\n${out.trader.slice(0, 1500)}\n\n激进派：\n${out.risky.slice(0, 1500)}\n\n保守派：\n${out.safe.slice(0, 1500)}\n\n你是中性派风控分析师，权衡双方给出平衡方案。`)],
        ['final', () => runStep('final', ctx, `${base}\n\n研究经理计划：\n${out.manager.slice(0, 1500)}\n\n交易员计划：\n${out.trader.slice(0, 1500)}\n\n风控辩论：\n激进：${out.risky.slice(0, 1200)}\n保守：${out.safe.slice(0, 1200)}\n中性：${out.neutral.slice(0, 1200)}\n\n你是组合经理，做出最终决策。第一行必须是 "Rating: Buy/Overweight/Hold/Underweight/Sell"，然后给出决策理由与执行要点，最后一行是 "FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL**"。`)]
      ];
      for (let i = 0; i < steps.length; i++) {
        const [key, fn] = steps[i];
        job.step = SECTIONS.find(s => s[0] === key)[1];
        job.progress = Math.round((i / steps.length) * 100);
        const r = await fn();
        if (r) out[key] = r;
      }
      // 写报告文件
      const dir = path.join(REPORT_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      const sections = [];
      const created = iso();
      const header = `# ${symbol} · TradingAgents 完整报告\n\n- 标的：${data.name}（${symbol}）\n- 分析日期：${snap.date}\n- 生成时间：${created}\n- 模式：${job.mode === 'llm' ? 'LLM（' + (process.env.LLM_MODEL || 'deepseek-chat') + '）' : '模拟（规则生成）'}\n\n> 仅供研究，不构成投资建议。\n`;
      const groups = [
        ['I. Analyst Team Reports', ['market', 'news', 'fundamentals']],
        ['II. Research Team Decision', ['bull', 'bear', 'manager']],
        ['III. Trading Team Plan', ['trader']],
        ['IV. Risk Management Team Decision', ['risky', 'safe', 'neutral']],
        ['V. Portfolio Manager Decision', ['final']]
      ];
      let full_md = header;
      for (const [g, keys] of groups) {
        const present = keys.filter(k => out[k]);
        if (!present.length) continue;
        full_md += `\n## ${g}\n`;
        for (const k of present) {
          const [, title, en] = SECTIONS.find(s => s[0] === k);
          full_md += `\n### ${en} · ${title}\n\n${out[k]}\n`;
          const file = k + '.md';
          fs.writeFileSync(path.join(dir, file), `# ${symbol} · ${title}\n\n${out[k]}\n`);
          sections.push({ key: k, title, file, size: Buffer.byteLength(out[k]) });
        }
      }
      fs.writeFileSync(path.join(dir, 'complete_report.md'), full_md);
      const html = `<!doctype html><meta charset="utf-8"><title>${symbol} 完整报告</title><style>body{max-width:860px;margin:2rem auto;padding:0 1rem;font:16px/1.75 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#111;color:#ddd}h1,h2,h3{color:#fff}table{border-collapse:collapse}td,th{border:1px solid #444;padding:4px 8px}pre{white-space:pre-wrap}</style><body><pre>${full_md.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></body>`;
      fs.writeFileSync(path.join(dir, 'complete_report.html'), html);
      sections.unshift({ key: 'complete_html', title: '完整报告（网页版）', file: 'complete_report.html', size: Buffer.byteLength(html) });
      sections.unshift({ key: 'complete', title: '完整报告', file: 'complete_report.md', size: Buffer.byteLength(full_md) });
      const rating = (out.final.match(/Rating:\s*\**\s*([A-Za-z]+)/i) || [])[1] || '';
      const proposal = (out.final.match(/FINAL TRANSACTION PROPOSAL:\s*\**\s*(BUY|HOLD|SELL)/i) || out.trader.match(/FINAL TRANSACTION PROPOSAL:\s*\**\s*(BUY|HOLD|SELL)/i) || [])[1] || '';
      const rep = { id, symbol, name: data.name, date: snap.date, createdAt: created, mode: job.mode, rating, proposal: proposal.toUpperCase(), sections };
      db.ta.reports.unshift(rep);
      Object.assign(job, { status: 'done', step: '完成', progress: 100, finishedAt: iso(), reportId: id, rating: rep.rating, proposal: rep.proposal });
      log(`TradingAgents 跑完 ${symbol}（${snap.date}）：Rating ${rating || '—'}，${proposal || '—'}`, 'trading');
    } catch (e) {
      Object.assign(job, { status: 'error', error: e.message, finishedAt: iso() });
    }
    const i = db.ta.runs.findIndex(r => r.id === id);
    if (i >= 0) db.ta.runs[i] = { ...job };
    db.ta.runs = db.ta.runs.slice(0, 100);
    save();
  })();
  return job;
}

function getJob(id) { return jobs.get(id) || db.ta.runs.find(r => r.id === id); }
function reportFile(id, file) {
  const rep = db.ta.reports.find(r => r.id === id);
  if (!rep) return null;
  const sec = rep.sections.find(s => s.file === file);
  if (!sec) return null;
  return { rep, sec, path: path.join(REPORT_DIR, id, sec.file) };
}

module.exports = { run, getJob, reportFile, SECTIONS };
