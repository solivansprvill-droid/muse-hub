import { api, esc, toast, ago } from '../util.js';

const ICON = { system: '⚙️', user: '📝', office: '🧑‍💼', agents: '🦾', news: '📰', trading: '📊', review: '🧾', ideas: '💡', goals: '🎯', resources: '📚', spaces: '🗂️' };
export default async function (el) {
  el.innerHTML = `<h1 class="page">动态</h1><div class="muted small">Muse 和各个 Agent 干了什么，都会记在这里。</div>
    <div class="card"><textarea class="input" id="tx" rows="2" placeholder="记一条动态…"></textarea><div class="row" style="margin-top:8px"><div class="spacer"></div><button class="btn primary" id="post">发布</button></div></div>
    <div class="card" id="list"></div>`;
  async function load() {
    const list = await api('/api/moments');
    el.querySelector('#list').innerHTML = list.map(m => `<div class="list-item" style="align-items:flex-start"><span style="font-size:18px">${ICON[m.kind] || '•'}</span><div style="flex:1"><div>${esc(m.text)}</div><div class="dim small">${ago(m.at)}</div></div><button class="btn sm ghost" data-del="${m.id}">✕</button></div>`).join('') || '<div class="empty">还没有动态</div>';
  }
  el.querySelector('#post').onclick = async () => { const t = el.querySelector('#tx').value.trim(); if (!t) return; await api('/api/moments', { method: 'POST', body: { text: t } }); el.querySelector('#tx').value = ''; toast('已发布'); load(); };
  el.querySelector('#list').onclick = async e => { const id = e.target.dataset.del; if (id) { await api('/api/moments/' + id, { method: 'DELETE' }); load(); } };
  await load();
}
