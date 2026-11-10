import { api, esc, toast } from '../util.js';

export default async function (el) {
  const [h, s] = await Promise.all([api('/api/health'), api('/api/settings')]);
  const ok = v => `<span class="badge ${v ? 'green' : ''}">${v ? '已配置' : '未配置'}</span>`;
  el.innerHTML = `<h1 class="page">设置</h1>
    <div class="card"><h2>服务状态</h2>
      <div class="list-item"><span style="flex:1">LLM（聊天 / Agent 指令 / TradingAgents / 新闻改写）</span>${ok(h.llm)}</div>
      <div class="list-item"><span style="flex:1">NASA FIRMS 实时火点</span>${ok(h.firms)}</div>
      <div class="list-item"><span style="flex:1">Telegram（OpenMausBot）</span>${ok(h.telegram)}</div>
      <div class="muted small" style="margin-top:8px">这些 key 只放在服务器的 .env 文件里，不会出现在网页上。改完 .env 需要重启服务。</div></div>
    <div class="card"><h2>新闻订阅源</h2><div class="muted small">每行一个：名称 | RSS 地址 | 分类</div>
      <textarea class="input mono" id="feeds" rows="7" style="margin-top:8px">${esc(s.feeds.map(f => `${f.name} | ${f.url} | ${f.category}`).join('\n'))}</textarea>
      <button class="btn primary" id="saveFeeds" style="margin-top:8px">保存</button></div>
    <div class="card"><h2>关于</h2><div class="muted small">Muse 个人 AI 指挥台。行情来自 Yahoo Finance，ISS 来自 wheretheiss.at，野火来自 NASA EONET。所有交易相关内容仅供研究，不构成投资建议；本项目不连接券商、不下单。</div></div>`;
  el.querySelector('#saveFeeds').onclick = async () => {
    const feeds = el.querySelector('#feeds').value.split('\n').map(l => l.split('|').map(x => x.trim())).filter(a => a[1]).map(([name, url, category]) => ({ name, url, category }));
    try { await api('/api/settings', { method: 'PUT', body: { feeds } }); toast('已保存'); } catch (e) { toast(e.message); }
  };
}
