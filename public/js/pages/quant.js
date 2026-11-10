import { api, esc, toast, n2, money, pct, lineChart } from '../util.js';

export default async function (el) {
  let strat = 'trend';
  el.innerHTML = `
    <div class="row" style="margin:6px 0"><h1 class="page" style="margin:0">量化交易</h1><div class="spacer"></div>
      <div class="tabs" id="st" style="margin:0;flex:none"><button data-s="trend" class="on">趋势 trend</button><button data-s="revert">均值回归 revert</button></div></div>
    <div class="muted small">自选股每日收盘后出信号（盘中的价格和量比是当日实时累计，以收盘为准）；回测用近 5 年日线。仅供研究，不构成投资建议，不连接券商、不下单。</div>
    <div class="card" id="sig"><div class="muted">加载自选股…</div></div>
    <div class="row"><h2 style="margin:8px 0">回测绩效</h2><div class="spacer"></div><span class="muted small" id="range"></span></div>
    <div class="card" id="perf"><div class="muted">回测中…</div></div>
    <div class="card"><div class="muted small">净值曲线（本金 $100,000）</div><canvas class="chart" id="eq"></canvas>
      <div class="muted small" style="margin-top:10px">回撤</div><canvas class="chart" id="dd" style="height:130px"></canvas></div>
    <div class="card"><h2>逐笔表现（已执行交易）</h2><div id="trades" class="small"></div></div>
    <div class="card"><h2>策略规则与风控</h2><div id="rules"></div></div>
    <div class="card"><h2>自选股</h2><div class="muted small">逗号分隔，最多 30 个（美股代码）</div>
      <div class="row" style="margin-top:8px"><input class="input mono" id="wl" /><button class="btn" id="saveWl">保存</button></div></div>`;
  el.querySelector('#st').onclick = e => { const s = e.target.dataset.s; if (!s) return; strat = s; el.querySelectorAll('#st button').forEach(b => b.classList.toggle('on', b.dataset.s === s)); load(); };
  const settings = await api('/api/settings');
  el.querySelector('#wl').value = settings.watchlist.join(', ');
  el.querySelector('#saveWl').onclick = async () => {
    try { await api('/api/settings', { method: 'PUT', body: { watchlist: el.querySelector('#wl').value.split(/[,，\s]+/) } }); toast('已保存'); load(); } catch (e) { toast(e.message); }
  };
  async function load() {
    el.querySelector('#sig').innerHTML = '<div class="muted">加载自选股…</div>';
    el.querySelector('#perf').innerHTML = '<div class="muted">回测中…（首次需要下载 5 年日线，约几秒）</div>';
    api('/api/quant/signals?strategy=' + strat).then(list => {
      el.querySelector('#sig').innerHTML = list.map(s => s.error ? `<div class="list-item"><b class="mono">${esc(s.symbol)}</b><span class="muted small">${esc(s.error)}</span></div>` : `
        <div style="padding:12px 0;border-bottom:1px solid var(--line)">
          <div class="row"><b class="mono">${esc(s.symbol)}</b><div class="spacer"></div>${s.signal ? '<span class="badge green">● 今日出信号</span>' : '<span class="dim small">— 无信号</span>'}</div>
          <div class="mono small muted" style="margin-top:4px">收盘 <span style="color:var(--text)">$${n2(s.close)}</span> &nbsp;RSI <span style="color:var(--text)">${n2(s.rsi, 1)}</span> &nbsp;量比 <span style="color:var(--text)">${n2(s.volRatio)}</span></div>
          <div class="mono small muted">SMA50 <span style="color:var(--text)">${n2(s.sma50)}</span> <span class="dim">· ${esc(s.date)}</span></div>
          ${s.signal ? `<div class="mono small" style="margin-top:6px;background:#0f1a16;padding:6px 10px;border-radius:8px">入场 $${n2(s.entry)} &nbsp;止损 <span class="down">$${n2(s.stop)}</span> &nbsp;目标 <span class="up">$${n2(s.target)}</span></div>` : ''}
        </div>`).join('');
    }).catch(e => (el.querySelector('#sig').innerHTML = `<div class="muted">${esc(e.message)}</div>`));
    try {
      const b = await api('/api/quant/backtest?strategy=' + strat);
      el.querySelector('#range').textContent = `${b.from} ~ ${b.to}`;
      const m = (lab, val, cls = '') => `<div class="metric"><div class="lab">${lab}</div><div class="val ${cls}">${val}</div></div>`;
      el.querySelector('#perf').innerHTML = `<div class="grid2">
        ${m('净收益', (b.net >= 0 ? '+' : '') + money(b.net, 0), b.net >= 0 ? 'up' : 'down')}${m('总回报', pct(b.totalReturn), b.totalReturn >= 0 ? 'up' : 'down')}
        ${m('期末资金', money(b.end, 0))}${m('交易数', b.trades)}
        ${m('胜率', n2(b.winRate, 1) + '%')}${m('盈亏比', n2(b.payoff))}
        ${m('夏普', n2(b.sharpe))}${m('年化', pct(b.annual))}
        ${m('最大回撤', n2(b.maxDD, 1) + '%', 'down')}</div>
        ${b.skipped.length ? `<div class="muted small" style="margin-top:8px">数据获取失败已跳过：${esc(b.skipped.join(', '))}</div>` : ''}`;
      const xl = arr => [0, Math.floor(arr.length / 3), Math.floor((arr.length * 2) / 3), arr.length - 1].map(i => [i, arr[i]?.date.slice(0, 7) || '']);
      lineChart(el.querySelector('#eq'), b.equity.map(e => e.equity), { color: '#2bc497', yFmt: v => '$' + Math.round(v / 1000) + 'k', xLabels: xl(b.equity) });
      lineChart(el.querySelector('#dd'), b.drawdown.map(e => e.dd), { color: '#e2475a', fill: 'rgba(226,71,90,.35)', yFmt: v => v.toFixed(0) + '%', xLabels: xl(b.drawdown), zeroLine: true });
      el.querySelector('#trades').innerHTML = b.tradeList.length ? `<div style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse">
        <tr class="muted" style="text-align:left"><th>代码</th><th>入场</th><th>离场</th><th>原因</th><th style="text-align:right">收益</th></tr>
        ${b.tradeList.map(t => `<tr style="border-top:1px solid var(--line)"><td>${esc(t.symbol)}</td><td>${t.entryDate.slice(2)}<br><span class="dim">$${n2(t.entry)}</span></td><td>${t.exitDate.slice(2)}<br><span class="dim">$${n2(t.exit)}</span></td><td>${esc(t.reason)}</td><td style="text-align:right" class="${t.pnl >= 0 ? 'up' : 'down'}">${pct(t.ret)}<br>${money(t.pnl, 0)}</td></tr>`).join('')}</table></div><div class="muted small" style="margin-top:6px">显示最近 ${b.tradeList.length} 笔</div>` : '<div class="muted">回测期内没有交易</div>';
      el.querySelector('#rules').innerHTML = `<div class="muted small">${esc(b.strategyName)}</div><ul>${b.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul><div class="muted small">风控与假设</div><ul>${b.risk.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`;
    } catch (e) { el.querySelector('#perf').innerHTML = `<div class="muted">回测失败：${esc(e.message)}</div>`; }
  }
  load();
}
