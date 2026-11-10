import { api, esc } from '../util.js';

export default async function (el) {
  el.innerHTML = `<h1 class="page">资源库</h1><div class="muted small">常用链接、文档、工具，按标签筛选。</div>
    <div class="card"><input class="input" id="t" placeholder="名称" /><input class="input" id="u" placeholder="https://…" style="margin-top:8px" /><div class="row" style="margin-top:8px"><input class="input" id="tag" placeholder="标签" style="max-width:160px" /><div class="spacer"></div><button class="btn primary" id="add">收藏</button></div></div>
    <div class="chips" id="tags"></div><div class="card" id="list"></div>`;
  let filter = '';
  async function load() {
    const list = await api('/api/resources');
    const tags = [...new Set(list.map(r => r.tag).filter(Boolean))];
    el.querySelector('#tags').innerHTML = ['', ...tags].map(t => `<span class="chip toggle ${filter === t ? '' : 'off'}" data-tag="${esc(t)}">${t ? esc(t) : '全部'}</span>`).join('');
    const rows = list.filter(r => !filter || r.tag === filter);
    el.querySelector('#list').innerHTML = rows.map(r => `<div class="list-item"><div style="flex:1;min-width:0"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><div class="dim small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.url || '')}</div></div>${r.tag ? `<span class="badge">${esc(r.tag)}</span>` : ''}<button class="btn sm ghost" data-del="${r.id}">✕</button></div>`).join('') || '<div class="empty">空空如也</div>';
  }
  el.querySelector('#add').onclick = async () => { const title = el.querySelector('#t').value.trim(); if (!title) return; await api('/api/resources', { method: 'POST', body: { title, url: el.querySelector('#u').value.trim(), tag: el.querySelector('#tag').value.trim() } }); el.querySelectorAll('.card input').forEach(i => (i.value = '')); load(); };
  el.querySelector('#tags').onclick = e => { const c = e.target.closest('[data-tag]'); if (c) { filter = c.dataset.tag; load(); } };
  el.querySelector('#list').onclick = async e => { const id = e.target.dataset.del; if (id) { await api('/api/resources/' + id, { method: 'DELETE' }); load(); } };
  await load();
}
