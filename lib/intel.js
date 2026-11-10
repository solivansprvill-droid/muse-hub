// 军事情报：ISS 实时位置、NASA EONET 野火、NASA FIRMS 火点（需 MAP_KEY）、整理版示例信号点
const { UA } = require('./market');
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const h = cache.get(key);
  if (h && Date.now() - h.t < ttlMs) return h.v;
  try {
    const v = await fn();
    cache.set(key, { t: Date.now(), v });
    return v;
  } catch (e) {
    if (h) return h.v;
    throw e;
  }
}

const P = (layer, name, lat, lng, w = 1, note = '') => ({ layer, name, lat, lng, w, note });
// 整理版示例信号点（2026-11-08 快照，用于演示图层效果，可在此文件里替换成你的数据源）
const LAYERS = {
  snapshot: '2026-11-08',
  defs: [
    { id: 'market', name: '预测市场热点', color: '#2ec4c4' },
    { id: 'base', name: '军事基地', color: '#f0a020' },
    { id: 'fire', name: '火灾探测点', color: '#f06a2a' },
    { id: 'carrier', name: '航母活动海域', color: '#28c26a' },
    { id: 'epidemic', name: '疫情监测点', color: '#b04ad8' },
    { id: 'heat', name: '异常热源', color: '#e8304a' },
    { id: 'firms', name: 'FIRMS 实时点云 · LIVE', color: '#ff4d2e', live: true },
    { id: 'eonet', name: 'EONET 实时野火', color: '#ff9a2e', live: true }
  ],
  points: [
    P('market', '乌克兰停火合约', 50.45, 30.52, 1.4, '预测市场成交活跃'), P('market', '台海局势合约', 25.03, 121.56, 1.2), P('market', '委内瑞拉政局', 10.48, -66.9, 1),
    P('market', '伊朗核谈判', 35.69, 51.39, 1.2), P('market', '美联储议息', 38.9, -77.04, 1.3), P('market', '加沙停火', 31.5, 34.47, 1.1),
    P('base', '拉姆施泰因空军基地', 49.44, 7.6), P('base', '迪戈加西亚', -7.31, 72.41), P('base', '关岛安德森空军基地', 13.58, 144.93), P('base', '嘉手纳空军基地', 26.35, 127.77),
    P('base', '乌代德空军基地', 25.12, 51.31), P('base', '莱蒙尼尔营地（吉布提）', 11.55, 43.15), P('base', '珍珠港-希卡姆', 21.35, -157.95), P('base', '诺福克海军基地', 36.95, -76.33),
    P('base', '塞瓦斯托波尔', 44.6, 33.5), P('base', '塔尔图斯', 34.9, 35.87),
    P('fire', '澳大利亚北领地火点', -14.5, 132.3, 1.2), P('fire', '亚马孙南部火点', -10.2, -55.4, 1.1), P('fire', '西伯利亚火点', 62.0, 129.7), P('fire', '加州火点', 38.5, -121.5),
    P('carrier', '南海', 15, 115, 1.3), P('carrier', '阿拉伯海', 18, 63, 1.2), P('carrier', '东地中海', 34, 32), P('carrier', '菲律宾海', 20, 130), P('carrier', '红海', 20, 38, 1.1), P('carrier', '西太平洋', 30, 140),
    P('epidemic', '孟加拉国登革热', 23.7, 90.4, 1.2), P('epidemic', '金沙萨猴痘', -4.3, 15.3, 1.1), P('epidemic', '拉各斯拉沙热', 6.5, 3.4), P('epidemic', '圣保罗登革热', -23.55, -46.63),
    P('heat', '乌克兰东部前线', 48.0, 37.8, 2), P('heat', '加沙', 31.4, 34.4, 1.8), P('heat', '苏丹喀土穆', 15.5, 32.5, 1.6), P('heat', '缅甸', 21, 96, 1.3),
    P('heat', '也门', 15.4, 44.2, 1.4), P('heat', '萨赫勒（马里）', 16, -1, 1.2), P('heat', '刚果（金）东部', -1.7, 29.2, 1.3)
  ]
};

async function iss() {
  return cached('iss', 3000, async () => {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('ISS ' + r.status);
    const j = await r.json();
    return { lat: j.latitude, lng: j.longitude, altitude: j.altitude, velocity: j.velocity, visibility: j.visibility, ts: j.timestamp };
  });
}

async function eonet() {
  return cached('eonet', 10 * 60e3, async () => {
    const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=300&days=30', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('EONET ' + r.status);
    const j = await r.json();
    return (j.events || []).map(e => {
      const g = e.geometry?.[e.geometry.length - 1];
      if (!g || g.type !== 'Point') return null;
      return { id: e.id, name: e.title, lng: g.coordinates[0], lat: g.coordinates[1], date: g.date, link: e.sources?.[0]?.url || e.link };
    }).filter(Boolean);
  });
}

async function firms() {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return { enabled: false, points: [], note: '未配置 FIRMS_MAP_KEY，FIRMS 图层不可用（申请：https://firms.modaps.eosdis.nasa.gov/api/map_key/）' };
  return cached('firms', 30 * 60e3, async () => {
    const r = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('FIRMS ' + r.status);
    const lines = (await r.text()).trim().split('\n');
    const head = lines.shift().split(',');
    const iLat = head.indexOf('latitude'), iLng = head.indexOf('longitude'), iFrp = head.indexOf('frp');
    let pts = lines.map(l => { const c = l.split(','); return { lat: +c[iLat], lng: +c[iLng], frp: +c[iFrp] || 0 }; }).filter(p => !isNaN(p.lat));
    pts.sort((a, b) => b.frp - a.frp);
    pts = pts.slice(0, Number(process.env.FIRMS_MAX_POINTS || 4000));
    return { enabled: true, points: pts, total: lines.length };
  });
}

module.exports = { LAYERS, iss, eonet, firms };
