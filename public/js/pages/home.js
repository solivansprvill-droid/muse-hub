import { esc } from '../util.js';

// Muse 空间：原左侧抽屉里的选项卡和空间都放在这里
export default async function (el, ctx) {
  const { TABS, SPACES } = ctx.nav;
  el.innerHTML = `
    <div class="home-head">
      <img class="home-ava" src="/img/avatar.svg" alt="Muse" />
      <div><div class="home-title">Muse 空间</div><div class="muted small">选项卡与空间都在这里</div></div>
      <a class="icon-btn sm" href="#/settings" aria-label="设置" style="margin-left:auto">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>
      </a>
    </div>
    <input class="drawer-search home-search" id="hs" placeholder="搜索" />
    <div class="drawer-sec">选项卡</div>
    <nav class="home-nav" id="hTabs"></nav>
    <div class="drawer-sec">空间</div>
    <nav class="home-nav" id="hSpaces"></nav>`;
  const render = (filter = '') => {
    const f = filter.trim().toLowerCase();
    const show = n => !f || n.toLowerCase().includes(f);
    el.querySelector('#hTabs').innerHTML = TABS.filter(t => show(t[1])).map(([id, name, ico]) => `<a href="#/${id}"><span class="ico">${ico}</span>${name}</a>`).join('');
    const sp = [
      ...SPACES.slice(0, -1).map(s => ({ href: '#/' + s[0], name: s[1], ico: s[2] })),
      ...ctx.nav.userSpaces.map(s => ({ href: '#/space/' + s.id, name: s.title, ico: s.icon || '🗂️' })),
      { href: '#/create', name: '创建空间', ico: '➕' }
    ];
    el.querySelector('#hSpaces').innerHTML = sp.filter(s => show(s.name)).map(s => `<a href="${s.href}"><span class="ico">${s.ico}</span>${esc(s.name)}</a>`).join('');
  };
  el.querySelector('#hs').oninput = e => render(e.target.value);
  render();
}
