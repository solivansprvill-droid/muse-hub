export async function api(path, opts = {}) {
  const o = { ...opts, headers: { ...(opts.headers || {}) } };
  if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(path, o);
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error((data && data.error) || ('请求失败 ' + r.status));
  return data;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let tt;
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(tt); tt = setTimeout(() => el.classList.add('hidden'), ms);
}
export const loading = on => document.getElementById('loader').classList.toggle('hidden', !on);
export const n2 = (x, d = 2) => (x == null || isNaN(x) ? '—' : Number(x).toFixed(d));
export const n4 = x => (x == null || isNaN(x) ? '—' : (Math.abs(x) >= 1000 ? Number(x).toFixed(2) : Number(Number(x).toFixed(4)).toString()));
export const money = (x, d = 2) => (x == null || isNaN(x) ? '—' : (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const int = x => (x == null || isNaN(x) ? '—' : Math.round(x).toLocaleString('en-US'));
export const pct = (x, d = 1) => (x == null || isNaN(x) ? '—' : (x > 0 ? '+' : '') + Number(x).toFixed(d) + '%');
export function timeStr(iso, withDate = false) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  const t = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return withDate ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${t}:${p(d.getSeconds())}` : t;
}
export function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return '刚刚'; if (s < 3600) return Math.floor(s / 60) + ' 分钟前'; if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
  return Math.floor(s / 86400) + ' 天前';
}
export const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const kb = n => (n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB');

// 极简 Markdown 渲染（标题、粗体、斜体、列表、表格、引用、代码）
export function md(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let out = '', i = 0;
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { let b = ''; i++; while (i < lines.length && !/^```/.test(lines[i])) b += esc(lines[i++]) + '\n'; i++; out += `<pre><code>${b}</code></pre>`; continue; }
    const hm = l.match(/^(#{1,4})\s+(.*)/); if (hm) { out += `<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`; i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const rows = []; while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const body = rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
      out += '<table>' + body.map((r, k) => '<tr>' + cells(r).map(c => k === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table>';
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); let items = '';
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) items += `<li>${inline(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ''))}</li>`;
      out += ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`; continue;
    }
    if (/^>\s?/.test(l)) { let b = ''; while (i < lines.length && /^>\s?/.test(lines[i])) b += inline(lines[i++].replace(/^>\s?/, '')) + '<br>'; out += `<blockquote>${b}</blockquote>`; continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out += '<hr>'; i++; continue; }
    if (!l.trim()) { i++; continue; }
    let p = ''; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*\||\s*([-*+]|\d+\.)\s)/.test(lines[i])) p += (p ? '<br>' : '') + inline(lines[i++]);
    out += `<p>${p}</p>`;
  }
  return out;
}

// 简单 canvas 折线/面积图
export function lineChart(canvas, series, { color = '#2bc497', fill = null, yFmt = v => v, xLabels = [], zeroLine = false } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, hgt = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = hgt * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, hgt);
  if (!series.length) return;
  const pad = { l: 48, r: 8, t: 10, b: 22 };
  let min = Math.min(...series), max = Math.max(...series);
  if (zeroLine) max = Math.max(max, 0);
  if (min === max) { min -= 1; max += 1; }
  const X = i => pad.l + (i / (series.length - 1 || 1)) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / (max - min)) * (hgt - pad.t - pad.b);
  c.font = '10px ui-monospace, monospace'; c.fillStyle = '#6b7484'; c.strokeStyle = 'rgba(255,255,255,.06)';
  for (let k = 0; k <= 4; k++) { const v = min + (k / 4) * (max - min); const y = Y(v); c.beginPath(); c.moveTo(pad.l, y); c.lineTo(w - pad.r, y); c.stroke(); c.fillText(yFmt(v), 2, y + 3); }
  xLabels.forEach(([i, t]) => c.fillText(t, Math.min(X(i) - 18, w - 50), hgt - 6));
  c.beginPath(); series.forEach((v, i) => (i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))));
  if (fill) { c.lineTo(X(series.length - 1), Y(zeroLine ? 0 : min)); c.lineTo(X(0), Y(zeroLine ? 0 : min)); c.closePath(); c.fillStyle = fill; c.fill(); c.beginPath(); series.forEach((v, i) => (i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)))); }
  c.strokeStyle = color; c.lineWidth = 1.6; c.stroke();
}
