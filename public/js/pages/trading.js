import { api, esc, toast, md, kb, timeStr } from '../util.js';

function lastWeekday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function openReader({ title, sub, url, filename }) {
  const r = document.createElement('div'); r.className = 'reader';
  r.innerHTML = `<div class="reader-head"><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(title)}</div><div class="mono dim small">${esc(sub)}</div></div><button class="btn sm" id="rc">关闭</button></div>
    <div class="reader-body md" id="rb"><div class="muted">加载中…</div></div>
    <div class="reader-foot"><button class="btn primary" id="cp">复制全文（方便分享）</button><button class="btn" id="dl">下载报告文件</button></div>`;
  document.body.appendChild(r);
  let text = '';
  const isHtml = url.endsWith('.html');
  fetch(url).then(x => x.text()).then(t => { text = t; r.querySelector('#rb').innerHTML = isHtml ? `<iframe srcdoc="${esc(t)}" style="width:100%;height:75vh;border:0;background:#111"></iframe>` : md(t); });
  r.querySelector('#rc').onclick = () => r.remove();
  r.querySelector('#cp').onclick = async () => { try { await navigator.clipboard.writeText(text); toast('已复制全文'); } catch { toast('复制失败，请长按选择'); } };
  r.querySelector('#dl').onclick = () => { const a = document.createElement('a'); a.href = url + '?download=1'; a.download = filename || ''; a.click(); };
}

export default async function (el) {
  const health = await api('/api/health');
  el.innerHTML = `
    <p class="muted" style="font-size:14.5px;margin-top:4px">多智能体 LLM 交易研究框架：分析师取数分析、多空辩论、交易员提案、风控与投资组合经理把关。仅供研究——本页所有数字均为历史数据计算结果，不是投资建议。</p>
    <div class="tabs" id="tabs"><button data-t="run" class="on">跑分析</button><button data-t="reports">分析报告</button><button data-t="history">运行历史</button><button data-t="info">更多信息</button></div>
    <div id="body"></div>`;
  const body = el.querySelector('#body');
  let tab = 'run', pollT = null, openRep = null;
  const setTab = t => { tab = t; el.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); render(); };
  el.querySelector('#tabs').onclick = e => e.target.dataset.t && setTab(e.target.dataset.t);

  async function render() {
    clearInterval(pollT);
    if (tab === 'run') {
      body.innerHTML = `
        <div class="card" style="border-color:${health.llm ? '#1f7a5c' : '#7a5c1f'};background:${health.llm ? '#0f2a22' : '#2a220f'}">
          <div class="row" style="align-items:flex-start"><span class="dot" style="background:${health.llm ? '#2bc497' : '#e8a03a'};margin-top:8px"></span>
          <div><div style="font-weight:600;font-size:16px">${health.llm ? '配置已就绪，可以跑一轮分析' : '未配置 LLM：将以模拟模式运行'}</div>
          <div class="muted small" style="margin-top:4px">${health.llm ? `点下方「运行分析」即可跑一轮：后台运行 1–3 分钟，本页自动刷新进度。跑完的报告在下方「分析报告」里，点开就能看全文、复制或下载。当前模型：${esc(health.model)}` : '模拟模式用真实行情计算指标、按规则生成各角色结论，几秒出结果。想要完整的多智能体推理，在 .env 里填 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL（DeepSeek、GLM、Qwen、OpenAI 均可）后重启。'}</div></div></div>
        </div>
        <div class="card">
          <h2>跑一轮分析</h2>
          <div class="muted small">输入代码和日期点「运行分析」：分析在本机后台真正运行，约 1–3 分钟，期间本页每 5 秒自动刷新进度；跑完报告出现在下方「分析报告」里，点开就能看。分析师组合固定为 market,news,fundamentals（技术面、新闻、基本面）。</div>
          <label class="lbl">股票代码</label><input class="input mono" id="tk" value="NVDA" />
          <label class="lbl">分析日期</label><input class="input mono" id="dt" type="date" value="${lastWeekday()}" />
          <label class="lbl">分析师</label>
          <div class="row wrap small">${[['market', '技术面'], ['news', '新闻'], ['fundamentals', '基本面']].map(([k, n]) => `<label class="chip"><input type="checkbox" value="${k}" checked style="accent-color:#22a37c"> ${n}</label>`).join('')}</div>
          <button class="btn primary block" id="go" style="margin-top:14px;padding:12px">运行分析</button>
          <div id="job"></div>
          <details style="margin-top:10px" class="muted small"><summary>也可以在终端手动运行</summary><pre class="mono" style="white-space:pre-wrap;background:#0f131b;padding:10px;border-radius:8px;margin-top:8px">node scripts/ta-cli.js NVDA 2026-11-06\n# 报告写入 data/reports/&lt;id&gt;/，网页「分析报告」里同步可见</pre></details>
        </div>
        <div class="card"><h2>最近报告</h2><div id="recent"></div></div>`;
      body.querySelector('#go').onclick = async () => {
        const analysts = [...body.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value);
        try {
          const j = await api('/api/ta/run', { method: 'POST', body: { ticker: body.querySelector('#tk').value, date: body.querySelector('#dt').value, analysts } });
          track(j.id);
        } catch (e) { toast(e.message); }
      };
      const runs = await api('/api/ta/runs');
      const running = runs.find(r => r.status === 'running'); if (running) track(running.id);
      const reps = await api('/api/ta/reports');
      body.querySelector('#recent').innerHTML = reps.slice(0, 3).map(repRow).join('') || '<div class="muted small">还没有报告</div>';
    }
    if (tab === 'reports') {
      const reps = await api('/api/ta/reports');
      body.innerHTML = `<div class="card">${reps.length ? reps.map(r => repRow(r) + (openRep === r.id ? sections(r) : '')).join('') : '<div class="empty">还没有报告，去「跑分析」跑一轮</div>'}</div>`;
    }
    if (tab === 'history') {
      const runs = await api('/api/ta/runs');
      body.innerHTML = `<div class="card">${runs.length ? runs.map(r => `<div class="list-item"><div style="flex:1"><div class="mono" style="font-weight:600">${esc(r.symbol)} <span class="dim small">${esc(r.date || '')}</span></div><div class="muted small">${new Date(r.startedAt).toLocaleString('zh-CN', { hour12: false })} · ${r.mode === 'llm' ? 'LLM' : '模拟'}${r.error ? ' · ' + esc(r.error) : ''}</div></div>
        <span class="badge ${r.status === 'done' ? 'green' : r.status === 'error' ? 'red' : 'orange'}">${r.status === 'done' ? '完成' : r.status === 'error' ? '失败' : esc(r.step) + ' ' + r.progress + '%'}</span></div>`).join('') : '<div class="empty">暂无运行记录</div>'}</div>`;
      if (runs.some(r => r.status === 'running')) pollT = setInterval(() => tab === 'history' && render(), 5000);
    }
    if (tab === 'info') {
      body.innerHTML = `<div class="card md">${md(`### 流水线
1. **分析师团队**：技术面（Market）、新闻（News）、基本面（Fundamentals）
2. **研究团队**：多头研究员 ↔ 空头研究员辩论，研究经理裁决
3. **交易员**：给出 Action / Entry / Stop / Target / 仓位，以及 \`FINAL TRANSACTION PROPOSAL\`
4. **风控团队**：激进派、保守派、中性派三方辩论
5. **组合经理**：最终 \`Rating\`（Buy / Overweight / Hold / Underweight / Sell）

### 数据
- 行情：Yahoo Finance 日线（免 key，服务端缓存 30 分钟），指标在本地计算
- 新闻：Yahoo Finance 个股 RSS
- 基本面：免费源不含完整财报，由 LLM 基于公开信息分析，需自行核对

### 配置（.env）
| 变量 | 说明 |
|---|---|
| LLM_BASE_URL | OpenAI 兼容地址，如 https://api.deepseek.com/v1 、https://open.bigmodel.cn/api/paas/v4 |
| LLM_API_KEY | 模型 key |
| LLM_MODEL | 如 deepseek-chat、glm-4-flash |

角色设计参考开源项目 TauricResearch/TradingAgents，本项目为 JavaScript 重写版，不依赖 Python。

> 仅供研究，不构成投资建议。本项目不连接券商、不下单。`)}<div class="muted small">当前：LLM ${health.llm ? '已配置（' + esc(health.model) + '）' : '未配置（模拟模式）'}</div></div>`;
    }
  }
  function repRow(r) {
    return `<div class="list-item" data-rep="${r.id}" style="cursor:pointer"><div style="flex:1"><div class="mono" style="font-weight:600">${esc(r.symbol)} <span class="dim small">${esc(r.date)}</span></div><div class="muted small">${new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false })} · ${r.mode === 'llm' ? 'LLM' : '模拟'}</div></div>
      ${r.rating ? `<span class="badge blue">Rating: ${esc(r.rating)}</span>` : ''}<span class="badge ${r.proposal === 'BUY' ? 'green' : r.proposal === 'SELL' ? 'red' : 'orange'}">${esc(r.proposal || '—')}</span></div>`;
  }
  function sections(r) {
    const when = new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false });
    return `<div style="padding:4px 0 10px"><button class="btn primary block" data-open="${r.id}|complete_report.md">看完整报告</button>
      <div style="text-align:center;margin:10px 0;color:#2bc497;cursor:pointer" data-fold="1">收起分篇 ▲</div>
      ${r.sections.map(s => `<div class="list-item" data-open="${r.id}|${s.file}" style="cursor:pointer"><div style="flex:1"><div>${esc(s.title)}</div><div class="dim small mono">${kb(s.size)} · ${when}</div></div><span class="dim">›</span></div>`).join('')}
      <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn sm danger" data-delrep="${r.id}">删除报告</button></div></div>`;
  }
  body.addEventListener('click', async e => {
    const o = e.target.closest('[data-open]');
    if (o) {
      const [id, file] = o.dataset.open.split('|');
      const r = (await api('/api/ta/reports')).find(x => x.id === id); const s = r.sections.find(x => x.file === file);
      return openReader({ title: `${r.symbol} · ${s.title}`, sub: `${file} · ${new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false })}`, url: `/api/ta/reports/${id}/${file}`, filename: `${r.symbol}_${r.date}_${file}` });
    }
    if (e.target.closest('[data-fold]')) { openRep = null; return render(); }
    const d = e.target.closest('[data-delrep]');
    if (d) { if (!confirm('删除这份报告？')) return; await api('/api/ta/reports/' + d.dataset.delrep, { method: 'DELETE' }); openRep = null; return render(); }
    const row = e.target.closest('[data-rep]');
    if (row) { openRep = openRep === row.dataset.rep ? null : row.dataset.rep; if (tab !== 'reports') return setTab('reports'); render(); }
  });
  function track(id) {
    const box = body.querySelector('#job'); if (!box) return;
    const tick = async () => {
      try {
        const j = await api('/api/ta/jobs/' + id);
        box.innerHTML = `<div class="card" style="background:#0f131b;margin-top:12px"><div class="row"><b class="mono">${esc(j.symbol)}</b><span class="muted small">${esc(j.date || '')}</span><div class="spacer"></div><span class="badge ${j.status === 'done' ? 'green' : j.status === 'error' ? 'red' : 'orange'}">${j.status === 'done' ? '完成' : j.status === 'error' ? '失败' : '运行中'}</span></div>
          <div class="muted small" style="margin-top:6px">${j.status === 'running' ? `当前步骤：${esc(j.step)}` : j.status === 'error' ? esc(j.error) : `Rating ${esc(j.rating || '—')} · ${esc(j.proposal || '—')}`}</div>
          <div style="height:6px;background:#1c2330;border-radius:3px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${j.progress}%;background:#22a37c;transition:width .4s"></div></div>
          ${j.status === 'done' ? `<button class="btn primary block" style="margin-top:10px" data-open="${j.reportId}|complete_report.md">看完整报告</button>` : ''}</div>`;
        if (j.status !== 'running') { clearInterval(pollT); const rec = body.querySelector('#recent'); if (rec) rec.innerHTML = (await api('/api/ta/reports')).slice(0, 3).map(repRow).join(''); }
      } catch (e) { clearInterval(pollT); }
    };
    clearInterval(pollT); tick(); pollT = setInterval(tick, health.llm ? 5000 : 1500);
  }
  render();
  return () => { clearInterval(pollT); document.querySelectorAll('.reader').forEach(r => r.remove()); };
}
