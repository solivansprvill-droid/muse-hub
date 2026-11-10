import { api, toast } from '../util.js';

const ICONS = ['🗂️', '🚀', '🎯', '🧪', '🎨', '🏠', '✈️', '💼', '📚', '🎮', '🧠', '💰'];
export default async function (el, ctx) {
  let icon = ICONS[0];
  el.innerHTML = `<h1 class="page">创建空间</h1><div class="muted small">给一个项目或主题开个独立空间：里面可以记笔记、挂链接、放待办。创建后出现在左侧「空间」列表。</div>
    <div class="card"><label class="lbl">名称</label><input class="input" id="t" placeholder="如：个人网站改版" maxlength="30" />
      <label class="lbl">图标</label><div class="row wrap" id="icons">${ICONS.map((i, k) => `<button class="btn sm ${k ? '' : 'primary'}" data-i="${i}" style="font-size:18px">${i}</button>`).join('')}</div>
      <label class="lbl">一句话说明（可选）</label><input class="input" id="d" maxlength="80" />
      <button class="btn primary block" id="go" style="margin-top:16px">创建</button></div>`;
  el.querySelector('#icons').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; icon = b.dataset.i; el.querySelectorAll('#icons button').forEach(x => x.classList.toggle('primary', x === b)); };
  el.querySelector('#go').onclick = async () => {
    const title = el.querySelector('#t').value.trim(); if (!title) return toast('起个名字');
    const s = await api('/api/spaces', { method: 'POST', body: { title, icon, desc: el.querySelector('#d').value.trim(), notes: [] } });
    await ctx.refreshSpaces(); location.hash = '#/space/' + s.id;
  };
}
