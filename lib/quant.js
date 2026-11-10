// 量化交易：今日信号 + 组合回测（仅研究用，不连券商、不下单）
const { getDaily, computeSeries } = require('./market');

const STRATS = {
  trend: {
    name: '趋势 trend',
    rules: [
      '入场：收盘价上穿 SMA20，且收盘价在 SMA50 之上，RSI(14) 在 50~72 之间',
      '止损：入场价 − 2 × ATR(14)',
      '目标：入场价 + 3 × ATR(14)',
      '离场：触及止损/目标，或收盘跌破 SMA50，或持有满 30 个交易日'
    ],
    entry(s, rows, i) {
      return s.sma20[i] && s.sma50[i] && s.rsi14[i] != null &&
        rows[i - 1].close <= s.sma20[i - 1] && rows[i].close > s.sma20[i] &&
        rows[i].close > s.sma50[i] && s.rsi14[i] > 50 && s.rsi14[i] < 72;
    },
    stop: (p, a) => p - 2 * a,
    target: (p, a) => p + 3 * a,
    exit: (s, rows, i, held) => rows[i].close < s.sma50[i] || held >= 30
  },
  revert: {
    name: '均值回归 revert',
    rules: [
      '入场：RSI(14) < 30 且收盘价在 SMA200 之上（长期向上中的超跌）',
      '止损：入场价 − 1.5 × ATR(14)',
      '目标：入场价 + 2 × ATR(14)',
      '离场：触及止损/目标，或 RSI 回到 60 以上，或持有满 10 个交易日'
    ],
    entry(s, rows, i) {
      return s.rsi14[i] != null && s.sma200[i] && s.rsi14[i] < 30 && rows[i].close > s.sma200[i];
    },
    stop: (p, a) => p - 1.5 * a,
    target: (p, a) => p + 2 * a,
    exit: (s, rows, i, held) => s.rsi14[i] > 60 || held >= 10
  }
};

const RISK = [
  '初始资金 $100,000，单笔仓位 = 当前净值的 20%，最多同时持有 5 只',
  '止损/目标按入场当天的 ATR 固定，盘中触及即按该价成交（回测假设）',
  '信号只用当日及以前的数据，次日不追价，按信号日收盘价成交',
  '不加杠杆、不做空、不计手续费和滑点——实盘表现会更差',
  '仅供研究，不构成投资建议'
];

async function loadAll(symbols, range) {
  const out = {};
  await Promise.all(symbols.map(async sym => {
    try {
      const d = await getDaily(sym, range);
      out[sym] = { d, s: computeSeries(d.rows) };
    } catch (e) {
      out[sym] = { error: e.message };
    }
  }));
  return out;
}

async function signals(symbols, strat = 'trend') {
  const S = STRATS[strat] || STRATS.trend;
  const all = await loadAll(symbols, '2y');
  return symbols.map(sym => {
    const x = all[sym];
    if (x.error) return { symbol: sym, error: x.error };
    const { d, s } = x, i = d.rows.length - 1, c = d.rows[i].close;
    const sig = i > 0 && S.entry(s, d.rows, i);
    return {
      symbol: sym, name: d.name, date: d.rows[i].date, close: c, rsi: s.rsi14[i], sma50: s.sma50[i],
      volRatio: s.vol5[i - 1] ? d.rows[i].volume / s.vol5[i - 1] : null,
      signal: !!sig,
      entry: sig ? c : null, stop: sig ? S.stop(c, s.atr14[i]) : null, target: sig ? S.target(c, s.atr14[i]) : null
    };
  });
}

async function backtest(symbols, strat = 'trend', capital = 100000) {
  const S = STRATS[strat] || STRATS.trend;
  const all = await loadAll(symbols, '5y');
  const ok = symbols.filter(s => !all[s].error);
  const idx = {};
  const dates = new Set();
  ok.forEach(sym => {
    idx[sym] = new Map(all[sym].d.rows.map((r, i) => [r.date, i]));
    all[sym].d.rows.forEach(r => dates.add(r.date));
  });
  const days = [...dates].sort();
  let cash = capital;
  const open = []; const trades = []; const equity = [];
  for (const day of days) {
    // 1) 处理离场
    for (let k = open.length - 1; k >= 0; k--) {
      const p = open[k]; const i = idx[p.sym].get(day); if (i == null) continue;
      const { d, s } = all[p.sym]; const r = d.rows[i]; p.held++;
      let px = null, why = '';
      if (r.low <= p.stop) { px = Math.min(r.open, p.stop); why = '止损'; }
      else if (r.high >= p.target) { px = Math.max(r.open, p.target); why = '目标'; }
      else if (S.exit(s, d.rows, i, p.held)) { px = r.close; why = '规则离场'; }
      if (px != null) {
        cash += p.qty * px;
        trades.push({ symbol: p.sym, entryDate: p.date, entry: p.entry, exitDate: day, exit: px, reason: why, pnl: p.qty * (px - p.entry), ret: (px / p.entry - 1) * 100 });
        open.splice(k, 1);
      }
    }
    // 2) 盯市
    let mv = 0;
    for (const p of open) { const i = idx[p.sym].get(day); const { d } = all[p.sym]; p.last = i != null ? d.rows[i].close : p.last; mv += p.qty * p.last; }
    const eq = cash + mv;
    // 3) 入场
    for (const sym of ok) {
      if (open.length >= 5) break;
      if (open.some(p => p.sym === sym)) continue;
      const i = idx[sym].get(day); if (i == null || i < 201) continue;
      const { d, s } = all[sym];
      if (!S.entry(s, d.rows, i)) continue;
      const px = d.rows[i].close; const alloc = Math.min(eq * 0.2, cash); if (alloc < px) continue;
      const qty = Math.floor(alloc / px); cash -= qty * px;
      open.push({ sym, date: day, entry: px, qty, stop: S.stop(px, s.atr14[i]), target: S.target(px, s.atr14[i]), held: 0, last: px });
    }
    let mv2 = 0; for (const p of open) mv2 += p.qty * p.last;
    equity.push({ date: day, equity: cash + mv2 });
  }
  // 指标
  const end = equity.length ? equity[equity.length - 1].equity : capital;
  let peak = capital, maxDD = 0; const dd = [];
  equity.forEach(e => { peak = Math.max(peak, e.equity); const x = (e.equity / peak - 1) * 100; dd.push({ date: e.date, dd: x }); maxDD = Math.min(maxDD, x); });
  const rets = equity.slice(1).map((e, i) => e.equity / equity[i].equity - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl <= 0);
  const avgW = wins.reduce((a, t) => a + t.pnl, 0) / (wins.length || 1);
  const avgL = Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / (losses.length || 1));
  const years = equity.length / 252;
  return {
    strategy: strat, strategyName: S.name, rules: S.rules, risk: RISK, symbols: ok, skipped: symbols.filter(s => all[s].error),
    capital, end, net: end - capital, totalReturn: (end / capital - 1) * 100, trades: trades.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0, payoff: avgL ? avgW / avgL : 0,
    sharpe: sd ? (mean / sd) * Math.sqrt(252) : 0, annual: years > 0 ? (Math.pow(end / capital, 1 / years) - 1) * 100 : 0,
    maxDD, equity: thin(equity, 400), drawdown: thin(dd, 400), tradeList: trades.slice(-60).reverse(),
    from: days[0], to: days[days.length - 1]
  };
}
function thin(a, n) { if (a.length <= n) return a; const step = a.length / n; const o = []; for (let i = 0; i < n; i++) o.push(a[Math.floor(i * step)]); o.push(a[a.length - 1]); return o; }

module.exports = { signals, backtest, STRATS, RISK };
