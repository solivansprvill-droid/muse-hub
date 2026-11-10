import { api, esc, toast } from '../util.js';
import { createGlobe } from '../three/globe.js';

export default async function (el) {
  el.innerHTML = `
    <h1 class="page">🌍 3D 情报地球 — 首页态势总览</h1>
    <p class="muted" style="font-size:14.5px">首页第一屏就是这颗地球：<b style="color:#e6e9ef">带真实国界划分（国界 + 主要国家名称）</b>，拖动旋转、滚轮 / 双指缩放。每一个<b style="color:#e6e9ef">亮点都对应一条事件</b>——点亮点或点卫星，地球会自动转到这个位置并弹出事件卡。<b style="color:#e6e9ef">橙色点云是真·实时数据</b>：服务端用环境变量里的 key 拉取 NASA FIRMS 卫星热点（按辐射功率 FRP 取前 N 个，未配置 key 时不显示）和 NASA EONET 近 30 天进行中野火；地面六类亮点为整理版<b style="color:#e6e9ef">示例信号点</b>（<span id="snapDate">2026-11-08</span> 快照）；<b style="color:#e6e9ef">ISS 是真的</b>：国际空间站位置每 3 秒从 wheretheiss.at 实时更新。</p>
    <div class="card" style="padding:14px">
      <div style="letter-spacing:2px;font-weight:700;font-size:15px">POLYGLOBE 3D · 情报图层</div>
      <div class="muted small" style="margin:4px 0 10px">拖动旋转 · 缩放 · 点亮点看对应事件 · 国界/国名可开关</div>
      <button class="mono" id="iss" style="width:100%;text-align:left;background:#0e2233;border:1px solid #1f4a5e;border-radius:10px;padding:8px 12px;color:#bfe6ff;font-size:13px;line-height:1.6">🛰️ <b style="font-family:var(--sans)">Locate ISS</b> · 正在用 API 推算国际空间站位置…</button>
      <div class="stage" id="stage" style="height:min(100vw,560px);margin-top:10px;background:radial-gradient(circle at 50% 50%,#10203d,#070b14 70%);border:0"></div>
      <div class="chips" id="layers"></div>
      <div id="pick"></div>
      <div class="muted small" id="firmsNote"></div>
    </div>
    <div class="card">
      <h2>实时事件 · NASA EONET 野火</h2>
      <div id="eonetList" class="small"><div class="muted">加载中…</div></div>
    </div>`;
  let globe;
  const pickBox = el.querySelector('#pick');
  try {
    globe = createGlobe(el.querySelector('#stage'), {
      onPick: d => {
        pickBox.innerHTML = `<div class="card" style="background:#0f1726;margin:8px 0"><div class="row"><b>${esc(d.name || '')}</b><div class="spacer"></div><span class="badge">${esc(layerName(d.layer))}</span></div>
          <div class="muted small">${d.lat != null ? `${(+d.lat).toFixed(2)}°, ${(+d.lng).toFixed(2)}°` : ''} ${d.date ? ' · ' + esc(String(d.date).slice(0, 10)) : ''}</div>
          ${d.note ? `<div style="margin-top:4px">${esc(d.note)}</div>` : ''}${d.link ? `<a href="${esc(d.link)}" target="_blank" rel="noopener" class="small">查看来源</a>` : ''}</div>`;
      }
    });
  } catch (e) { el.querySelector('#stage').innerHTML = `<div class="empty">WebGL 不可用：${esc(e.message)}</div>`; }
  const layers = await api('/api/intel/layers');
  el.querySelector('#snapDate').textContent = layers.snapshot;
  const nameOf = Object.fromEntries(layers.defs.map(d => [d.id, d.name]));
  const layerName = id => nameOf[id] || (id === 'iss' ? '卫星' : id);
  globe?.setPoints(layers.defs, layers.points);
  const toggles = [...layers.defs, { id: 'borders', name: '国界', color: '#8fb4e8' }, { id: 'names', name: '国名', color: '#cfe0ff' }];
  const lay = el.querySelector('#layers');
  lay.innerHTML = toggles.map(d => `<span class="chip toggle" data-id="${d.id}"><span class="dot" style="background:${d.color}"></span>${d.name}</span>`).join('');
  lay.onclick = e => { const c = e.target.closest('.chip'); if (!c) return; const off = c.classList.toggle('off'); globe?.setVisible(c.dataset.id, !off); };

  // ISS
  const issBtn = el.querySelector('#iss');
  issBtn.onclick = () => globe?.locateIss();
  async function pollIss() {
    try {
      const d = await api('/api/intel/iss');
      globe?.setIss(d);
      const t = new Date(d.ts * 1000).toLocaleTimeString('zh-CN', { hour12: false });
      issBtn.innerHTML = `🛰️ <b style="font-family:var(--sans)">Locate ISS</b> · 高度 ${d.altitude.toFixed(0)} km · 速度 ${Math.round(d.velocity).toLocaleString()} km/h · ${Math.abs(d.lat).toFixed(2)}°${d.lat >= 0 ? 'N' : 'S'}, ${Math.abs(d.lng).toFixed(2)}°${d.lng >= 0 ? 'E' : 'W'} · ${t}`;
    } catch (e) { issBtn.textContent = '🛰️ ISS 位置获取失败：' + e.message; }
  }
  pollIss(); const t1 = setInterval(pollIss, 3000);

  api('/api/intel/eonet').then(list => {
    globe?.setEonet(list);
    el.querySelector('#eonetList').innerHTML = list.length ? list.slice(0, 30).map(e => `<div class="list-item"><span class="dot" style="background:#ff9a2e"></span><span style="flex:1">${esc(e.name)}</span><span class="dim">${esc(String(e.date).slice(0, 10))}</span></div>`).join('') + `<div class="muted small" style="margin-top:6px">共 ${list.length} 个进行中事件 · 来源 NASA EONET</div>` : '<div class="muted">暂无进行中的野火事件</div>';
  }).catch(e => (el.querySelector('#eonetList').innerHTML = `<div class="muted">EONET 获取失败：${esc(e.message)}</div>`));
  api('/api/intel/firms').then(f => {
    if (f.enabled) { globe?.setFirms(f.points); el.querySelector('#firmsNote').textContent = `FIRMS：近 24 小时 ${f.total} 个热点，显示 FRP 最高的 ${f.points.length} 个`; }
    else el.querySelector('#firmsNote').textContent = f.note;
  }).catch(e => (el.querySelector('#firmsNote').textContent = 'FIRMS 获取失败：' + e.message));

  return () => { clearInterval(t1); globe?.dispose(); };
}
