import { api, esc, toast } from '../util.js';

export default async function (el) {
  el.innerHTML = `<h1 class="page">目标</h1><div class="muted small">长期目标和进度，拖动滑块更新。</div>
    <div class="card"><input class="input" id="t" placeholder="新目标，如：交易台审核完全通过" /><div class="row" style="margin-top:8px"><label class="muted small">截止</label><input class="input" type="date" id="due" style="max-width:180px" /><div class="spacer"></div><button class="btn primary" id="add">添加</button></div></div>
    <div id="list"></div>`;
  async function load() {
    const list = await api('/api/goals');
    el.querySelector('#list').innerHTML = list.map(g => `<div class="card" data-id="${g.id}">
      <div class="row"><b style="flex:1">${g.progress >= 100 ? '✅ ' : ''}${esc(g.title)}</b><span class="mono">${g.progress}%</span><button class="btn sm ghost" data-del="1">✕</button></div>
      ${g.due ? `<div class="dim small">截止 ${esc(g.due)}</div>` : ''}
      <input type="range" min="0" max="100" step="5" value="${g.progress}" style="width:100%;accent-color:#22a37c;margin-top:8px">
    </div>`).join('') || '<div class="empty">还没有目标</div>';
  }
  el.querySelector('#add').onclick = async () => { const title = el.querySelector('#t').value.trim(); if (!title) return; await api('/api/goals', { method: 'POST', body: { title, due: el.querySelector('#due').value, progress: 0 } }); el.querySelector('#t').value = ''; load(); };
  el.querySelector('#list').addEventListener('change', async e => { const c = e.target.closest('[data-id]'); if (c && e.target.type === 'range') { await api('/api/goals/' + c.dataset.id, { method: 'PUT', body: { progress: Number(e.target.value) } }); if (Number(e.target.value) >= 100) toast('目标达成 🎉'); load(); } });
  el.querySelector('#list').addEventListener('input', e => { const c = e.target.closest('[data-id]'); if (c && e.target.type === 'range') c.querySelector('.mono').textContent = e.target.value + '%'; });
  el.querySelector('#list').addEventListener('click', async e => { const c = e.target.closest('[data-id]'); if (c && e.target.dataset.del) { await api('/api/goals/' + c.dataset.id, { method: 'DELETE' }); load(); } });
  await load();
}
