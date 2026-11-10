// 行情数据（Yahoo Finance chart 接口，免 key）+ 技术指标
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');

const CACHE_DIR = path.join(DATA_DIR, 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });
const mem = new Map();
const TTL = (Number(process.env.MARKET_CACHE_MINUTES) || 30) * 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function cleanSymbol(s) {
  return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9.\-^=]/g, '').slice(0, 15);
}

// 返回 [{date:'YYYY-MM-DD', open, high, low, close, volume}]，按日期升序
async function getDaily(symbol, range = '2y') {
  symbol = cleanSymbol(symbol);
  if (!symbol) throw new Error('股票代码不能为空');
  const key = symbol + '_' + range;
  const hit = mem.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const file = path.join(CACHE_DIR, key + '.json');
  try {
    const st = fs.statSync(file);
    if (Date.now() - st.mtimeMs < TTL) {
      const v = JSON.parse(fs.readFileSync(file, 'utf8'));
      mem.set(key, { t: st.mtimeMs, v });
      return v;
    }
  } catch {}
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr;
  for (const h of hosts) {
    try {
      const url = `https://${h}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includeAdjustedClose=true`;
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      if (!res) throw new Error(j?.chart?.error?.description || ('无数据 ' + symbol));
      const q = res.indicators.quote[0];
      const tz = res.meta.exchangeTimezoneName || 'America/New_York';
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      const rows = [];
      (res.timestamp || []).forEach((ts, i) => {
        if (q.close[i] == null) return;
        rows.push({ date: fmt.format(new Date(ts * 1000)), open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] || 0 });
      });
      const v = { symbol, name: res.meta.longName || res.meta.shortName || symbol, currency: res.meta.currency, exchange: res.meta.exchangeName, meta: { fiftyTwoWeekHigh: res.meta.fiftyTwoWeekHigh, fiftyTwoWeekLow: res.meta.fiftyTwoWeekLow, regularMarketPrice: res.meta.regularMarketPrice }, rows };
      if (!rows.length) throw new Error('无数据 ' + symbol);
      fs.writeFileSync(file, JSON.stringify(v));
      mem.set(key, { t: Date.now(), v });
      return v;
    } catch (e) {
      lastErr = e;
    }
  }
  // 网络失败时用过期缓存兜底
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  throw lastErr;
}

// ---------- 指标 ----------
function sma(arr, n) {
  const out = new Array(arr.length).fill(null);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i];
    if (i >= n) s -= arr[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}
function ema(arr, n) {
  const out = new Array(arr.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    if (i === n - 1) prev = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
    else if (i >= n) prev = arr[i] * k + prev * (1 - k);
    out[i] = i >= n - 1 ? prev : null;
  }
  return out;
}
function rsi(arr, n = 14) {
  const out = new Array(arr.length).fill(null);
  let g = 0, l = 0;
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    const up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) {
      g += up; l += dn;
      if (i === n) { g /= n; l /= n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    } else {
      g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n;
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
  }
  return out;
}
function atr(rows, n = 14) {
  const out = new Array(rows.length).fill(null);
  let prev = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const tr = i === 0 ? r.high - r.low : Math.max(r.high - r.low, Math.abs(r.high - rows[i - 1].close), Math.abs(r.low - rows[i - 1].close));
    if (i < n) { prev = (prev || 0) + tr; if (i === n - 1) { prev /= n; out[i] = prev; } }
    else { prev = (prev * (n - 1) + tr) / n; out[i] = prev; }
  }
  return out;
}
function stdev(arr, n) {
  const m = sma(arr, n);
  return arr.map((_, i) => {
    if (m[i] == null) return null;
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (arr[j] - m[i]) ** 2;
    return Math.sqrt(s / n);
  });
}

function computeSeries(rows) {
  const c = rows.map(r => r.close), v = rows.map(r => r.volume);
  const ema12 = ema(c, 12), ema26 = ema(c, 26);
  const macd = c.map((_, i) => (ema12[i] != null && ema26[i] != null ? ema12[i] - ema26[i] : null));
  const firstMacd = macd.findIndex(x => x != null);
  const sigPart = ema(macd.slice(firstMacd), 9);
  const macds = macd.map((_, i) => (i >= firstMacd ? sigPart[i - firstMacd] : null));
  const mid = sma(c, 20), sd = stdev(c, 20);
  return {
    sma5: sma(c, 5), sma10: sma(c, 10), sma20: mid, sma50: sma(c, 50), sma200: sma(c, 200),
    macd, macds, macdh: macd.map((m, i) => (m != null && macds[i] != null ? m - macds[i] : null)),
    rsi14: rsi(c, 14), bollUb: mid.map((m, i) => (m != null ? m + 2 * sd[i] : null)), bollMid: mid,
    bollLb: mid.map((m, i) => (m != null ? m - 2 * sd[i] : null)), atr14: atr(rows, 14), vol20: sma(v, 20), vol5: sma(v, 5)
  };
}

function snapshot(data) {
  const rows = data.rows, s = computeSeries(rows), i = rows.length - 1;
  const pick = k => (s[k][i] == null ? null : s[k][i]);
  const prevVol5 = i > 0 ? s.vol5[i - 1] : null;
  return {
    symbol: data.symbol, name: data.name, date: rows[i].date, close: rows[i].close,
    change: i > 0 ? (rows[i].close / rows[i - 1].close - 1) * 100 : 0,
    sma5: pick('sma5'), sma10: pick('sma10'), sma20: pick('sma20'), sma50: pick('sma50'), sma200: pick('sma200'),
    macd: pick('macd'), macds: pick('macds'), macdh: pick('macdh'), rsi14: pick('rsi14'),
    bollUb: pick('bollUb'), bollMid: pick('bollMid'), bollLb: pick('bollLb'), atr14: pick('atr14'),
    vol20: pick('vol20'), volume: rows[i].volume, volRatio: prevVol5 ? rows[i].volume / prevVol5 : null,
    high52: data.meta?.fiftyTwoWeekHigh, low52: data.meta?.fiftyTwoWeekLow
  };
}

// 截至某日的数据（TradingAgents 分析日期用）
function sliceTo(data, date) {
  if (!date) return data;
  const rows = data.rows.filter(r => r.date <= date);
  if (!rows.length) throw new Error('该日期之前没有行情数据');
  return { ...data, rows };
}

module.exports = { getDaily, computeSeries, snapshot, sliceTo, cleanSymbol, sma, rsi, atr, UA };
