import { api, esc, toast, ago } from '../util.js';

export default async function (el, ctx) {
  const id = ctx.params[0];
  let s = (await api('/api/spaces')).find(x => x.id === id);
  if (!s) { el.innerHTML = '<div class="empty">空间不存在</div>'; return; }
  const save = async () => { s = await api('/api/spaces/' + s.id, { method: 'PUT', body: { notes: s.notes } }); render(); };
  function render() {
    el.innerHTML = `<div class="row"><h1 class="page">${esc(s.icon || '🗂️')} ${esc(s.title)}</h1><div class="spacer"></div><button class="btn sm danger" id="delS">删除空间</button></div>
      ${s.desc ? `<div class="muted">${esc(s.desc)}</div>` : ''}
      <div class="card"><div class="row"><select class="input" id="k" style="width:auto"><option value="note">笔记</option><option value="todo">待办</option><option value="link">链接</option></select><input class="input" id="t" placeholder="内容 / 链接" /><button class="btn primary" id="add">添加</button></div></div>
      <div class="card">${(s.notes || []).map((n, i) => `<div class="list-item" data-i="${i}" style="align-items:flex-start">
        ${n.kind === 'todo' ? `<input type="checkbox" ${n.done ? 'checked' : ''} style="accent-color:#22a37c;width:18px;height:18px;margin-top:3px">` : `<span>${n.kind === 'link' ? '🔗' : '📝'}</span>`}
        <div style="flex:1;white-space:pre-wrap;${n.done ? 'text-decoration:line-through;color:var(--dim)' : ''}">${n.kind === 'link' ? `<a href="${esc(n.text)}" target="_blank" rel="noopener">${esc(n.text)}</a>` : esc(n.text)}<div class="dim small">${ago(n.at)}</div></div>
        <button class="btn sm ghost" data-del="1">✕</button></div>`).join('') || '<div class="empty">还没有内容</div>'}</div>`;
    el.querySelector('#add').onclick = () => { const t = el.querySelector('#t').value.trim(); if (!t) return; s.notes = [{ kind: el.querySelector('#k').value, text: t, done: false, at: new Date().toISOString() }, ...(s.notes || [])]; save(); };
    el.querySelector('#delS').onclick = async () => { if (!confirm('删除这个空间？')) return; await api('/api/spaces/' + s.id, { method: 'DELETE' }); await ctx.refreshSpaces(); toast('已删除'); location.hash = '#/home'; };
  }
  el.addEventListener('click', e => { const r = e.target.closest('[data-i]'); if (!r) return; const i = +r.dataset.i; if (e.target.dataset.del) { s.notes.splice(i, 1); save(); } else if (e.target.type === 'checkbox') { s.notes[i].done = e.target.checked; save(); } });
  render();
}
