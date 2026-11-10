import { api, esc, toast, timeStr } from '../util.js';

export default async function (el) {
  let b = await api('/api/bot');
  el.innerHTML = `
    <h1 class="page">🤖 OpenMausBot</h1>
    <div class="muted small">Muse 的聊天机器人分身。网页里可以直接测试；在 .env 配置 TELEGRAM_BOT_TOKEN 后自动接入 Telegram，手机上发命令就能查状态、看稿子、下任务。</div>
    <div class="card">
      <div class="row"><b>状态</b><div class="spacer"></div><span class="badge ${b.telegram ? 'green' : ''}">${b.telegram ? 'Telegram 已接入' : 'Telegram 未配置'}</span></div>
      <div class="muted small" style="margin-top:6px">命令</div>
      ${b.commands.map(c => `<div class="list-item" style="padding:8px 0"><code class="mono" style="color:#7ee0bd;cursor:pointer" data-cmd="${esc(c.cmd)}">${esc(c.cmd)}</code><span class="muted small">${esc(c.desc)}</span></div>`).join('')}
    </div>
    <div class="card">
      <h2>测试对话</h2>
      <div id="log" style="max-height:52vh;overflow-y:auto"></div>
      <div class="row" style="margin-top:10px"><input class="input" id="msg" placeholder="发送 /help 或任意消息" /><button class="btn primary" id="send">发送</button></div>
    </div>`;
  const logEl = el.querySelector('#log');
  const renderLog = () => {
    logEl.innerHTML = b.log.map(m => `<div class="msg user" style="max-width:90%">${esc(m.text)}<div class="dim small">${esc(m.from)} · ${timeStr(m.at)}</div></div><div class="msg assistant" style="max-width:90%">${esc(m.reply)}</div>`).join('') || '<div class="muted small">还没有消息</div>';
    logEl.scrollTop = logEl.scrollHeight;
  };
  renderLog();
  async function send(text) {
    if (!text) return;
    el.querySelector('#msg').value = '';
    try { await api('/api/bot/message', { method: 'POST', body: { text } }); b = await api('/api/bot'); renderLog(); } catch (e) { toast(e.message); }
  }
  el.querySelector('#send').onclick = () => send(el.querySelector('#msg').value.trim());
  el.querySelector('#msg').onkeydown = e => e.key === 'Enter' && send(e.target.value.trim());
  el.onclick = e => { const c = e.target.dataset.cmd; if (c) { el.querySelector('#msg').value = c.split(' ')[0] + ' '; el.querySelector('#msg').focus(); } };
}
