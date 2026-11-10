import { api, esc, toast, loading } from './util.js';

const TABS = [
  ['chat', '主要聊天', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>'],
  ['moments', '动态', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'],
  ['ideas', '点子', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/></svg>'],
  ['goals', '目标', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>'],
  ['library', '资源库', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/></svg>']
];
const SPACES = [
  ['office', 'Muse总裁办公室', '🧑‍💼'],
  ['agents', 'Agent 指挥中心', '🦾'],
  ['intel', '军事情报', '🛡️'],
  ['news', '新闻稿', '📰'],
  ['trading', 'TradingAgents', '📊'],
  ['quant', '量化交易', '📈'],
  ['stockstats', 'StockStats 技术指标', '📉'],
  ['review', '交易台审核', '🧾'],
  ['bot', 'OpenMausBot', '🤖'],
  ['create', '创建空间', '➕']
];
const ALL = ['home', ...TABS.map(t => t[0]), ...SPACES.map(s => s[0]), 'space', 'settings'];

const view = document.getElementById('view');
const homeBtn = document.getElementById('btnHome');
let userSpaces = [];
export const NAV = { TABS, SPACES, get userSpaces() { return userSpaces; } };
export async function refreshSpaces() { try { userSpaces = await api('/api/spaces'); } catch {} }

let cleanup = null, token = 0;
async function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  let page = parts[0];
  if (!ALL.includes(page)) page = 'home';
  homeBtn.classList.toggle('hidden', page === 'home');
  const my = ++token;
  if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
  cleanup = null;
  document.body.className = document.documentElement.className = page === 'agents' ? 'light' : page === 'news' ? 'paper' : '';
  view.innerHTML = '';
  window.scrollTo(0, 0);
  loading(true);
  try {
    const mod = await import(`./pages/${page}.js`);
    if (my !== token) return;
    const host = document.createElement('div'); view.appendChild(host);
    const c = await mod.default(host, { params: parts.slice(1), refreshSpaces, nav: NAV });
    if (my !== token) { if (typeof c === 'function') c(); return; }
    cleanup = c;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h2>页面出错了</h2><div class="muted">${esc(e.message)}</div></div>`;
  } finally {
    if (my === token) loading(false);
  }
}
window.addEventListener('hashchange', route);
refreshSpaces().then(() => { if ((location.hash.replace(/^#\/?/, '') || 'home').startsWith('home')) route(); });
route();
