import { api, esc, toast, md } from '../util.js';

export default async function (el) {
  el.innerHTML = `<div class="chat-wrap"><div class="row"><h1 class="page" style="margin:0">主要聊天</h1><div class="spacer"></div><button class="btn sm ghost" id="clear">清空</button></div>
    <div class="chat-list" id="list"></div>
    <div class="composer"><textarea class="input" placeholder="和 Muse 说点什么…" id="ta"></textarea><button class="btn primary" id="send" style="border-radius:23px">发送</button></div></div>`;
  const list = el.querySelector('#list');
  let msgs = await api('/api/chat');
  const render = () => { list.innerHTML = msgs.map(m => `<div class="msg ${m.role}">${m.role === 'assistant' ? `<div class="md" style="white-space:normal">${md(m.content)}</div>` : esc(m.content)}</div>`).join(''); list.scrollTop = list.scrollHeight; };
  render();
  const ta = el.querySelector('#ta');
  async function send() {
    const content = ta.value.trim(); if (!content) return;
    ta.value = ''; msgs.push({ role: 'user', content }); msgs.push({ role: 'assistant', content: '…' }); render();
    try { const r = await api('/api/chat', { method: 'POST', body: { content } }); msgs[msgs.length - 1] = r; }
    catch (e) { msgs[msgs.length - 1] = { role: 'assistant', content: '出错了：' + e.message }; }
    render();
  }
  el.querySelector('#send').onclick = send;
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } };
  el.querySelector('#clear').onclick = async () => { if (!confirm('清空聊天记录？')) return; await api('/api/chat', { method: 'DELETE' }); msgs = []; render(); toast('已清空'); };
}
