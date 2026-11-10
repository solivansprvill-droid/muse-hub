import { api, esc, toast } from '../util.js';

const LV = { high: ['高危', 'red'], mid: ['中危', 'orange'], low: ['低危', 'blue'] };
export default async function (el, ctx) {
  const health = await api('/api/health');
  let reviews = await api('/api/reviews');
  let openId = reviews[0]?.id;
  function render() {
    const cur = reviews.find(r => r.status !== 'done') || reviews[0];
    const left = cur ? cur.issues.filter(i => !i.fixed) : [];
    const cnt = l => left.filter(i => i.level === l).length;
    el.innerHTML = `
      <h1 class="page">交易台审核</h1>
      <div class="muted small">交易台（量化交易 / TradingAgents）每一轮代码与策略复审的问题清单。修完所有问题即「完全通过」。</div>
      ${cur ? `<div class="card">
        <div class="row"><h2 style="margin:0">${esc(cur.title)}</h2><div class="spacer"></div><span class="badge ${cur.status === 'passed' ? 'green' : 'orange'}">${cur.status === 'passed' ? '完全通过' : cur.status === 'done' ? '已归档' : '修复中'}</span></div>
        <div class="chips"><span class="chip"><span class="dot" style="background:var(--red)"></span>高危 ${cnt('high')}</span><span class="chip"><span class="dot" style="background:var(--orange)"></span>中危 ${cnt('mid')}</span><span class="chip"><span class="dot" style="background:var(--blue)"></span>低危 ${cnt('low')}</span><span class="chip">已修 ${cur.issues.length - left.length}/${cur.issues.length}</span></div>
        <div style="height:6px;background:#1c2330;border-radius:3px;overflow:hidden"><div style="height:100%;width:${cur.issues.length ? ((cur.issues.length - left.length) / cur.issues.length) * 100 : 100}%;background:var(--green)"></div></div>
        <div class="muted small" style="margin-top:8px">${left.length ? `第 ${cur.round} 次复审剩 ${left.length} 个问题，目标完全通过` : '所有问题已修复 ✅'}</div>
      </div>` : ''}
      <div class="row"><button class="btn primary" id="newRound">开始新一轮复审</button><div class="spacer"></div></div>
      ${reviews.map(r => `<div class="card">
        <div class="row" data-toggle="${r.id}" style="cursor:pointer"><b>${esc(r.title)}</b><div class="spacer"></div><span class="muted small">${r.issues.filter(i => i.fixed).length}/${r.issues.length} 已修</span><span class="dim">${openId === r.id ? '▲' : '▼'}</span></div>
        ${openId === r.id ? `<div style="margin-top:8px">
          ${r.issues.map(i => `<div class="list-item" data-i="${i.id}" data-r="${r.id}"><input type="checkbox" ${i.fixed ? 'checked' : ''} style="accent-color:#22a37c;width:18px;height:18px"><span class="badge ${LV[i.level][1]}">${LV[i.level][0]}</span><span style="flex:1;${i.fixed ? 'text-decoration:line-through;color:var(--dim)' : ''}">${esc(i.text)}</span><button class="btn sm ghost" data-del="1">✕</button></div>`).join('') || '<div class="muted small">没有问题</div>'}
          <div class="row" style="margin-top:10px"><select class="input" id="lv-${r.id}" style="width:auto"><option value="low">低危</option><option value="mid">中危</option><option value="high">高危</option></select><input class="input" id="tx-${r.id}" placeholder="新增问题描述" /><button class="btn" data-add="${r.id}">添加</button></div>
          <details style="margin-top:10px"><summary class="muted small">让 AI 审一段代码 / 方案${health.llm ? '' : '（需配置 LLM）'}</summary>
            <textarea class="input mono" id="code-${r.id}" rows="6" placeholder="粘贴代码或策略说明" style="margin-top:8px"></textarea>
            <button class="btn" data-ai="${r.id}" style="margin-top:8px" ${health.llm ? '' : 'disabled'}>AI 审核并加入清单</button></details>
        </div>` : ''}
      </div>`).join('')}`;
  }
  el.addEventListener('click', async e => {
    try {
      const t = e.target.closest('[data-toggle]'); if (t) { openId = openId === t.dataset.toggle ? null : t.dataset.toggle; return render(); }
      if (e.target.id === 'newRound') { const rv = await api('/api/reviews', { method: 'POST' }); reviews = await api('/api/reviews'); openId = rv.id; return render(); }
      const row = e.target.closest('[data-i]');
      if (row && e.target.matches('input[type=checkbox]')) { await api(`/api/reviews/${row.dataset.r}/issues/${row.dataset.i}`, { method: 'PUT', body: { fixed: e.target.checked } }); reviews = await api('/api/reviews'); return render(); }
      if (row && e.target.dataset.del) { await api(`/api/reviews/${row.dataset.r}/issues/${row.dataset.i}`, { method: 'DELETE' }); reviews = await api('/api/reviews'); return render(); }
      const a = e.target.dataset.add; if (a) { const text = el.querySelector('#tx-' + a).value.trim(); if (!text) return; await api(`/api/reviews/${a}/issues`, { method: 'POST', body: { text, level: el.querySelector('#lv-' + a).value } }); reviews = await api('/api/reviews'); return render(); }
      const ai = e.target.dataset.ai; if (ai) { e.target.disabled = true; e.target.textContent = '审核中…'; await api(`/api/reviews/${ai}/ai`, { method: 'POST', body: { code: el.querySelector('#code-' + ai).value } }); reviews = await api('/api/reviews'); toast('已加入清单'); return render(); }
    } catch (er) { toast(er.message); }
  });
  render();
}
