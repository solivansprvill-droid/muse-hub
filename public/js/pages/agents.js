import { api, esc, toast } from '../util.js';
import { createAgentFloor, STATE_TEXT } from '../three/agents3d.js';

const SET_STATES = [['work', '认真工作'], ['slack', '摸鱼'], ['think', '思考'], ['happy', '开心'], ['angry', '生气'], ['drink', '喝水'], ['toilet', '上厕所'], ['idle', '待机'], ['auto', '自动']];

export default async function (el) {
  el.innerHTML = `
    <div class="muted small" style="text-align:center;margin:2px 0 8px">名单和任务是演示数据——随时可以换成你真实的 Agent</div>
    <div class="card">
      <h1 class="page" style="margin-top:0">Agent 指挥中心</h1>
      <div style="font-weight:600" id="summary">查岗中…</div>
      <div class="chips" id="chips"></div>
      <div class="muted small">共 <span id="cnt">9</span> 个工位——计数按工位实时状态算</div>
    </div>
    <div class="seg" id="views">
      <button data-v="overview" class="on">全景</button><button data-v="boss">老板视角</button><button data-v="patrol">巡逻一圈</button><button data-v="slacker">抓摸鱼</button>
    </div>
    <div class="row" style="justify-content:flex-end;margin:4px 0"><span>自动转</span><button class="switch on" id="rot" aria-label="自动转"></button></div>
    <div class="muted small" id="rotTip">自动转：镜头慢慢绕办公室转</div>
    <div class="stage" id="stage" style="height:min(110vw,560px);margin-top:8px"></div>
    <div id="panel"></div>`;
  let agents = await api('/api/agents');
  let selected = null;
  const floor = createAgentFloor(el.querySelector('#stage'), { onSelect: id => { selected = id; renderPanel(); floor.setView('focus', id); setSeg(null); el.querySelector('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  floor.setAgents(agents);
  floor.setAutoRotate(true);

  const setSeg = v => el.querySelectorAll('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  el.querySelector('#views').onclick = e => {
    const v = e.target.dataset.v; if (!v) return;
    if (v === 'slacker') {
      const id = floor.findSlacker();
      if (!id) return toast('查过了，现在没人摸鱼 👀');
      selected = id; floor.setView('focus', id); renderPanel(); toast('抓到了：' + agents.find(a => a.id === id)?.name);
    } else floor.setView(v);
    setSeg(v);
  };
  const rot = el.querySelector('#rot');
  rot.onclick = () => { const on = !rot.classList.contains('on'); rot.classList.toggle('on', on); floor.setAutoRotate(on); el.querySelector('#rotTip').textContent = on ? '自动转：镜头慢慢绕办公室转' : '自动转已关闭：可以手动拖动查看'; };

  function renderSummary() {
    const disp = floor.displayStates();
    const c = { work: 0, wait: 0, done: 0, idle: 0 }; const empty = [];
    agents.forEach(a => {
      const doing = a.tasks.some(t => t.state === 'doing'), paused = a.tasks.some(t => t.state === 'paused');
      const allDone = a.tasks.length && a.tasks.every(t => t.state === 'done');
      if (doing && a.status !== 'idle') c.work++; else if (paused) c.wait++; else if (allDone) c.done++; else c.idle++;
      const s = disp[a.id];
      if (s && floor.isAway(s)) empty.push(a.name);
      else if (!doing && !a.tasks.length) empty.push(a.name);
    });
    el.querySelector('#summary').textContent = empty.length ? `查岗结果：${empty.length} 个工位空着（${empty.join('、')}）` : '查岗结果：全员在岗';
    el.querySelector('#chips').innerHTML = `<span class="chip"><span class="dot" style="background:#2e8b4f"></span>认真工作 ${c.work}</span><span class="chip" style="background:#fff3dc;color:#b07a10"><span class="dot" style="background:#e8a03a"></span>等待中 ${c.wait}</span><span class="chip"><span class="dot" style="background:#7a8aa8"></span>已收尾 ${c.done}</span><span class="chip"><span class="dot" style="background:#b8c0b8"></span>待机 ${c.idle}</span>`;
    el.querySelector('#cnt').textContent = agents.length;
  }

  function renderPanel() {
    const a = agents.find(x => x.id === selected);
    const box = el.querySelector('#panel');
    if (!a) { box.innerHTML = ''; return; }
    const show = floor.displayStates()[a.id] || a.status;
    const doing = a.tasks.filter(t => t.state === 'doing'), idle = a.tasks.filter(t => t.state !== 'doing');
    const cur = a.mode === 'auto' ? 'auto' : a.status;
    box.innerHTML = `
      <div class="card">
        <div class="row"><h2 style="font-size:20px;margin:0">${esc(a.name)} · ${esc(a.nick)}</h2><div class="spacer"></div><button class="btn ghost sm" id="close" style="border:0;font-size:18px">✕</button></div>
        <div class="muted">${a.id} · ${doing.length ? '认真工作' : '待机'}</div>
        <div style="margin:6px 0 2px">${esc(a.role)}</div>
        <div class="muted">此刻状态：${STATE_TEXT[show] || show}</div>
        <h2 style="margin-top:16px">设置实时状态</h2>
        <div class="state-btns" id="states">${SET_STATES.map(([k, n]) => `<button data-s="${k}" class="${cur === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="muted small" style="margin-top:8px">点一下立刻生效，头顶气泡和计数跟着变；选"自动"就是不手动指定，小人自己工作、思考、喝水、串门。</div>
        <h2 style="margin-top:16px">任务看板 · 共 ${a.tasks.length} 条</h2>
        <div class="muted small">进行中 (${doing.length})</div>
        ${doing.map(t => `<div class="ktask" data-t="${t.id}"><span class="tt">${esc(t.title)}</span><button class="kbtn pause" data-op="paused">暂停</button><button class="kbtn del" data-op="del">删除</button></div>`).join('') || '<div class="muted small" style="padding:6px 0">—</div>'}
        <div class="muted small" style="margin-top:8px">待机 (${idle.length})</div>
        ${idle.map(t => `<div class="ktask" data-t="${t.id}"><span class="tt">${esc(t.title)}${t.state === 'paused' ? ' <span class="badge orange">已暂停</span>' : t.state === 'done' ? ' <span class="badge">已完成</span>' : ''}</span><button class="kbtn start" data-op="doing">开始</button><button class="kbtn del" data-op="del">删除</button></div>`).join('') || '<div class="muted small" style="padding:6px 0">—</div>'}
        <div class="row" style="margin-top:8px"><input class="input" id="newTask" placeholder="加一条任务到看板" /><button class="btn" id="addTask">添加</button></div>
        <div class="row wrap" style="margin-top:14px">
          <button class="btn primary" data-act="assign">安排干活</button>
          <button class="btn danger" data-act="stop">停止干活</button>
          <button class="btn" data-act="resume">恢复启动</button>
        </div>
        <div class="row" style="margin-top:12px"><input class="input" id="cmd" placeholder="给这位 Agent 下指令，比如：帮我写一份周报" /><button class="btn primary" id="send">发送</button></div>
        <div id="reply">${a.lastReply ? `<div class="ktask" style="display:block;margin-top:10px"><div class="muted small">上次指令：${esc(a.lastReply.text)}</div><div style="white-space:pre-wrap;margin-top:6px">${esc(a.lastReply.reply)}</div></div>` : ''}</div>
      </div>`;
  }
  async function update(p) { const a = await p; agents = agents.map(x => (x.id === a.id ? a : x)); floor.setAgents(agents); renderPanel(); renderSummary(); }
  el.querySelector('#panel').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = agents.find(x => x.id === selected); if (!a) return;
    try {
      if (b.id === 'close') { selected = null; renderPanel(); floor.setView('overview'); setSeg('overview'); return; }
      if (b.dataset.s) return update(api('/api/agents/' + a.id, { method: 'PUT', body: { status: b.dataset.s } }));
      if (b.dataset.act) { await update(api('/api/agents/' + a.id, { method: 'PUT', body: { action: b.dataset.act } })); return toast({ assign: '已安排干活', stop: '已停止干活', resume: '已恢复启动' }[b.dataset.act]); }
      if (b.dataset.op) {
        const tid = b.closest('.ktask').dataset.t;
        if (b.dataset.op === 'del') return update(api(`/api/agents/${a.id}/tasks/${tid}`, { method: 'DELETE' }));
        return update(api(`/api/agents/${a.id}/tasks/${tid}`, { method: 'PUT', body: { state: b.dataset.op } }));
      }
      if (b.id === 'addTask') { const v = el.querySelector('#newTask').value.trim(); if (!v) return; return update(api(`/api/agents/${a.id}/tasks`, { method: 'POST', body: { title: v } })); }
      if (b.id === 'send') {
        const text = el.querySelector('#cmd').value.trim(); if (!text) return toast('先写指令');
        b.disabled = true; b.textContent = '发送中…';
        const r = await api(`/api/agents/${a.id}/command`, { method: 'POST', body: { text } });
        agents = agents.map(x => (x.id === a.id ? r.agent : x)); floor.setAgents(agents); renderPanel(); renderSummary();
      }
    } catch (er) { toast(er.message); b.disabled = false; }
  });
  renderSummary();
  const t1 = setInterval(renderSummary, 2500);
  const t2 = setInterval(async () => { try { agents = await api('/api/agents'); floor.setAgents(agents); } catch {} }, 15000);
  return () => { clearInterval(t1); clearInterval(t2); floor.dispose(); };
}
