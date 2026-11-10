import { api, esc, toast, n4, int } from '../util.js';

export default async function (el) {
  el.innerHTML = `
    <h1 class="page">StockStats 技术指标</h1>
    <div class="muted small">日线收盘后计算：SMA、MACD(12,26,9)、RSI(14)、布林带(20,2)、ATR(14)、成交量。数据源 Yahoo Finance，缓存 30 分钟。</div>
    <div class="row" style="margin:12px 0"><input class="input mono" id="add" placeholder="添加代码，如 AAPL" /><button class="btn" id="addBtn">添加</button></div>
    <div id="list"><div class="muted">计算中…</div></div>
    <div class="note-foot">仅供研究，不构成投资建议</div>`;
  let settings = await api('/api/settings');
  async function load() {
    const list = await api('/api/stockstats');
    el.querySelector('#list').innerHTML = list.map(s => s.error ? `<div class="card"><div class="stock-head"><span class="sym">${esc(s.symbol)}</span><button class="btn sm danger" data-del="${esc(s.symbol)}">移除</button></div><div class="muted small">${esc(s.error)}</div></div>` : `
      <div class="card">
        <div class="stock-head"><div><span class="sym">${esc(s.symbol)}</span> <span class="dim small">${esc(s.name || '')}</span></div><div><span class="px">${n4(s.close)}</span> <span class="dim small">收盘价</span></div></div>
        <div class="kv">
          ${kv('SMA5', s.sma5)}${kv('SMA10', s.sma10)}${kv('SMA20', s.sma20)}${kv('SMA50', s.sma50)}${kv('SMA200', s.sma200)}${kv('RSI(14)', s.rsi14)}
          ${kv('MACD', s.macd)}${kv('MACD 信号', s.macds)}${kv('MACD 柱', s.macdh, s.macdh >= 0 ? 'up' : 'down')}${kv('布林中轨', s.bollMid)}
          ${kv('布林上轨', s.bollUb)}${kv('布林下轨', s.bollLb)}${kv('ATR(14)', s.atr14)}<div class="k">当日量</div><div class="v">${int(s.volume)}</div>
          <div class="k">20 日均量</div><div class="v">${int(s.vol20)}</div>
        </div>
        <div class="row" style="margin-top:10px"><span class="dim small">${esc(s.date)}</span><div class="spacer"></div><button class="btn sm ghost" data-del="${esc(s.symbol)}">移除</button></div>
      </div>`).join('') || '<div class="empty">还没有代码</div>';
  }
  const kv = (k, v, cls = '') => `<div class="k">${k}</div><div class="v ${cls}">${n4(v)}</div>`;
  async function saveList(arr) { settings = await api('/api/settings', { method: 'PUT', body: { stockstats: arr } }); await load(); }
  el.querySelector('#addBtn').onclick = async () => {
    const v = el.querySelector('#add').value.trim().toUpperCase(); if (!v) return;
    el.querySelector('#add').value = ''; toast('计算中…');
    try { await saveList([v, ...settings.stockstats]); } catch (e) { toast(e.message); }
  };
  el.querySelector('#list').onclick = async e => { const d = e.target.dataset.del; if (d) await saveList(settings.stockstats.filter(s => s !== d)); };
  await load();
}
