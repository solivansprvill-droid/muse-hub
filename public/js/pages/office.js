import { api, esc, toast } from '../util.js';
import { createOffice } from '../three/office3d.js';

const COLORS = { doing: '#2bc4a4', waiting: '#e8a03a', scheduled: '#8b6cf0', shelved: '#8a93a3', done: '#40c070' };

export default async function (el) {
  el.innerHTML = `
    <h1 class="page">Muse 此刻的工作状态</h1>
    <div class="status-line"><span class="dot" style="background:#2bc497"></span><span id="line">正在读取…</span></div>
    <div class="chips" id="chips"></div>
    <div class="stage" id="stage" style="height:min(96vw,520px)">
      <div class="hud"><span class="dot" style="background:#2bc497"></span><span id="hud">待命中 · 姿势：坐着打字</span></div>
      <div class="hint">拖动旋转 · 滚轮或双指缩放 · 右键或双指拖动平移</div>
    </div>
    <div class="card">
      <h2>任务状态板</h2>
      <div class="muted small" id="snap"></div>
      <div id="tasks"><div class="muted" style="padding:12px 0">正在读取任务…</div></div>
      <div style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px">
        <div class="muted small" style="margin-bottom:8px">下达新任务</div>
        <input class="input" id="nt" placeholder="任务标题，如：整理本周新闻精选" maxlength="80" />
        <input class="input" id="nd" placeholder="补充说明（可选）" style="margin-top:8px" maxlength="200" />
        <div class="row" style="margin-top:10px">
          <select class="input" id="ns" style="width:auto"><option value="doing">正在干</option><option value="waiting">等你</option><option value="scheduled">定时</option><option value="shelved">搁置</option></select>
          <div class="spacer"></div>
          <button class="btn primary" id="add">下达</button>
        </div>
      </div>
    </div>`;
  const stageEl = el.querySelector('#stage');
  let office = null;
  try { office = createOffice(stageEl); } catch (e) { stageEl.insertAdjacentHTML('beforeend', `<div class="empty">3D 加载失败：${esc(e.message)}</div>`); }

  const today = new Date();
  const part = today.getHours() < 12 ? '早上' : today.getHours() < 18 ? '下午' : '晚上';
  el.querySelector('#snap').textContent = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')} ${part}的状态快照 · 改状态会立刻同步到 3D 里的双屏和后墙大显示屏，页面每 10 秒自动刷新一次`;

  function render(d) {
    el.querySelector('#line').textContent = d.line;
    el.querySelector('#chips').innerHTML = Object.entries(d.labels).map(([k, n]) => `<span class="chip"><span class="dot" style="background:${COLORS[k]}"></span>${n} ${d.counts[k] || 0}</span>`).join('');
    el.querySelector('#hud').textContent = d.current ? `正在干：${d.current} · 姿势：${d.posture}` : `待命中 · 姿势：${d.posture}`;
    const order = ['doing', 'waiting', 'scheduled', 'shelved', 'done'];
    const tasks = [...d.tasks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    el.querySelector('#tasks').innerHTML = tasks.length ? tasks.map(t => `
      <div class="task" data-id="${t.id}">
        <div class="t"><span class="pill st-${t.status}">${d.labels[t.status]}</span>${esc(t.title)}</div>
        ${t.detail ? `<div class="d">${esc(t.detail)}</div>` : '<div style="height:8px"></div>'}
        <div class="row wrap">
          ${order.filter(s => s !== t.status).map(s => `<button class="btn sm" data-st="${s}">${s === 'done' ? '完成' : d.labels[s]}</button>`).join('')}
          <div class="spacer"></div><button class="btn sm danger" data-del="1">删除</button>
        </div>
      </div>`).join('') : '<div class="muted" style="padding:12px 0">目前没有任务</div>';
    office?.setState({ tasks: d.tasks, current: d.current, working: !!d.current });
  }
  async function load() { try { render(await api('/api/office')); } catch (e) { toast(e.message); } }
  el.querySelector('#tasks').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.closest('.task').dataset.id;
    try {
      if (b.dataset.del) { if (!confirm('删除这个任务？')) return; render(await api('/api/office/tasks/' + id, { method: 'DELETE' })); }
      else render(await api('/api/office/tasks/' + id, { method: 'PUT', body: { status: b.dataset.st } }));
    } catch (er) { toast(er.message); }
  });
  el.querySelector('#add').onclick = async () => {
    const title = el.querySelector('#nt').value.trim(); if (!title) return toast('先写任务标题');
    try {
      render(await api('/api/office/tasks', { method: 'POST', body: { title, detail: el.querySelector('#nd').value, status: el.querySelector('#ns').value } }));
      el.querySelector('#nt').value = ''; el.querySelector('#nd').value = ''; toast('已下达');
    } catch (er) { toast(er.message); }
  };
  await load();
  const timer = setInterval(load, 10000);
  return () => { clearInterval(timer); office?.dispose(); };
}
