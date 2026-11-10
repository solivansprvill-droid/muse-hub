import { api, esc, toast, ago } from '../util.js';

export default async function (el) {
  el.innerHTML = `<h1 class="page">点子</h1><div class="muted small">突然冒出来的想法先丢这里，成熟了一键变成 Muse 的任务。</div>
    <div class="card"><input class="input" id="t" placeholder="一个点子…" /><div class="row" style="margin-top:8px"><input class="input" id="tag" placeholder="标签（可选）" style="max-width:140px" /><input class="input" id="note" placeholder="补充（可选）" /><button class="btn primary" id="add">记下</button></div></div>
    <div class="card" id="list"></div>`;
  async function load() {
    const list = await api('/api/ideas');
    el.querySelector('#list').innerHTML = list.map(i => `<div class="list-item" data-id="${i.id}" style="align-items:flex-start">
      <input type="checkbox" ${i.done ? 'checked' : ''} style="accent-color:#22a37c;width:18px;height:18px;margin-top:3px">
      <div style="flex:1"><div style="${i.done ? 'text-decoration:line-through;color:var(--dim)' : ''}">${esc(i.title)}</div>${i.note ? `<div class="muted small">${esc(i.note)}</div>` : ''}<div class="dim small">${i.tag ? `<span class="badge">${esc(i.tag)}</span> ` : ''}${ago(i.at)}</div></div>
      <button class="btn sm" data-act="task">变成任务</button><button class="btn sm ghost" data-act="del">✕</button></div>`).join('') || '<div class="empty">还没有点子</div>';
  }
  el.querySelector('#add').onclick = async () => {
    const title = el.querySelector('#t').value.trim(); if (!title) return;
    await api('/api/ideas', { method: 'POST', body: { title, tag: el.querySelector('#tag').value.trim(), note: el.querySelector('#note').value.trim(), done: false } });
    el.querySelectorAll('.card input').forEach(i => (i.value = '')); load();
  };
  el.querySelector('#list').onclick = async e => {
    const row = e.target.closest('[data-id]'); if (!row) return; const id = row.dataset.id;
    if (e.target.matches('input[type=checkbox]')) { await api('/api/ideas/' + id, { method: 'PUT', body: { done: e.target.checked } }); return load(); }
    if (e.target.dataset.act === 'del') { await api('/api/ideas/' + id, { method: 'DELETE' }); return load(); }
    if (e.target.dataset.act === 'task') { const title = row.querySelector('div > div').textContent; await api('/api/office/tasks', { method: 'POST', body: { title, detail: '来自点子', status: 'doing' } }); toast('已交给 Muse，去总裁办公室看看'); }
  };
  await load();
}
