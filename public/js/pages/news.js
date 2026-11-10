import { api, esc, toast, timeStr } from '../util.js';

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export default async function (el) {
  el.innerHTML = `
    <div class="row" style="margin:6px 0 10px"><div><div class="news-title" style="font-size:24px">每日稿子</div><div class="muted small" id="stat">—</div></div><div class="spacer"></div><button class="btn" id="sync" style="border-color:#5a534a;background:transparent;border-radius:4px">立即同步</button></div>
    <input class="input" id="q" placeholder="搜关键词：标题、正文、分类" style="border-radius:4px;background:#191715;border-color:#2c2925" />
    <div class="daytabs" id="days" style="margin-top:12px"></div>
    <div id="dayHead" class="news-title" style="font-size:18px;margin:10px 0 0;color:#cfc6b8"></div>
    <div id="list"></div>
    <div class="note-foot" id="foot"></div>`;
  let state = { q: '', day: '' };
  const fmtDay = d => { const dt = new Date(d + 'T12:00:00'); return `${d} · ${dt.getMonth() + 1}月${dt.getDate()}日 ${WEEK[dt.getDay()]}`; };
  async function load() {
    const d = await api(`/api/news?q=${encodeURIComponent(state.q)}&day=${encodeURIComponent(state.day)}`);
    el.querySelector('#stat').textContent = `共 ${d.total} 条 · ${d.dayCount} 天`;
    el.querySelector('#days').innerHTML = d.days.map(x => `<button data-day="${x.day}" class="${x.day === d.day ? 'on' : ''}">${x.day.slice(5)} · ${x.count}条</button>`).join('');
    el.querySelector('#dayHead').textContent = d.day ? `${fmtDay(d.day)} · 共 ${d.items.length} 条` : state.q ? `搜索「${state.q}」· ${d.items.length} 条` : '';
    const n = d.items.length;
    el.querySelector('#list').innerHTML = n ? d.items.map((it, i) => {
      let host = ''; try { host = new URL(it.link).hostname.replace(/^www\./, ''); } catch {}
      return `<div class="news-item" data-i="${i}">
        <div class="meta"><b>第${n - i}条</b> · ${timeStr(it.at)} 轮次 · ${esc(it.category)}${it.rewritten ? ' · 已改写' : ''}</div>
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.body)}</p>
        <div class="row more hidden" style="margin-top:12px;font-size:13px;color:#8b8378">来源：<a href="${esc(it.link)}" target="_blank" rel="noopener" style="color:#d4473a">${esc(host || it.source)}</a><div class="spacer"></div><button class="btn sm copy" style="background:transparent;border-color:#3a3530;border-radius:4px">复制全文</button></div>
      </div>`;
    }).join('') : `<div class="empty">${d.total ? '没有匹配的稿子' : '还没有稿子，点右上角「立即同步」从订阅源抓取'}</div>`;
    el.querySelector('#foot').textContent = d.lastSync ? `上次同步 ${new Date(d.lastSync).toLocaleString('zh-CN', { hour12: false })} · ${d.llm ? 'LLM 改写已开启' : '未配置 LLM：显示原文摘要'}` : '';
    el.querySelector('#list').onclick = async e => {
      const item = e.target.closest('.news-item'); if (!item) return;
      const it = d.items[item.dataset.i];
      if (e.target.closest('.copy')) { await navigator.clipboard?.writeText(`${it.title}\n\n${it.body}\n\n来源：${it.link}`).catch(() => {}); return toast('已复制全文'); }
      if (e.target.closest('a')) return;
      item.classList.toggle('open'); item.querySelector('.more').classList.toggle('hidden');
    };
  }
  el.querySelector('#days').onclick = e => { const b = e.target.closest('button'); if (!b) return; state.day = b.dataset.day; state.q = ''; el.querySelector('#q').value = ''; load(); };
  let qt; el.querySelector('#q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value.trim(); state.day = ''; load(); }, 300); };
  el.querySelector('#sync').onclick = async e => {
    const b = e.target; b.disabled = true; b.textContent = '同步中…';
    try { const r = await api('/api/news/sync', { method: 'POST' }); toast(`新增 ${r.added} 条${r.errors.length ? `，${r.errors.length} 个源失败` : ''}`); state.day = ''; await load(); }
    catch (er) { toast(er.message); } finally { b.disabled = false; b.textContent = '立即同步'; }
  };
  await load();
}
