// 新闻稿：从 RSS 抓取 → 去重 → （可选）LLM 改写成中文稿子
const { iso } = require('./time');
const { db, save, uid, log } = require('./store');
const { fetchFeed } = require('./rss');
const llm = require('./llm');

let syncing = null;

function dayOf(s) {
  // 按北京时间分天
  return iso(new Date(new Date(s).getTime() + 8 * 3600e3)).slice(0, 10);
}

async function rewrite(item) {
  const out = await llm.chat([
    { role: 'system', content: '你是中文新媒体编辑。把给你的新闻改写成一条中文短稿：第一行是有冲击力但不标题党的中文标题（不超过 26 字），空一行后是 150~260 字的正文，口语化、信息准确、不编造，结尾可以抛一个问题引发讨论。只输出标题和正文。' },
    { role: 'user', content: `标题：${item.title}\n来源：${item.feed}\n内容：${item.content.slice(0, 1500)}` }
  ], { max_tokens: 600, temperature: 0.7, timeoutMs: 60000 });
  const [title, ...rest] = out.split(/\n+/);
  return { title: title.replace(/^[#\s*标题：:]+/, '').trim(), body: rest.join('\n').trim() };
}

async function sync() {
  if (syncing) return syncing;
  syncing = (async () => {
    const feeds = db.settings.feeds || [];
    const known = new Set(db.news.items.map(i => i.link));
    let added = 0; const errors = [];
    const fresh = [];
    await Promise.all(feeds.map(async f => {
      try {
        const items = await fetchFeed(f.url, 25);
        for (const it of items) {
          if (!it.link || known.has(it.link)) continue;
          known.add(it.link);
          fresh.push({ ...it, feed: f.name, category: f.category || '综合' });
        }
      } catch (e) { errors.push(f.name + '：' + e.message); }
    }));
    fresh.sort((a, b) => b.at.localeCompare(a.at));
    const maxRewrite = Number(process.env.NEWS_REWRITE_LIMIT || 8);
    let rewritten = 0;
    for (const it of fresh) {
      const item = { id: uid('n'), title: it.title, body: it.content || it.title, link: it.link, source: it.source || it.feed, feed: it.feed, category: it.category, at: it.at, day: dayOf(it.at), rewritten: false };
      if (llm.llmConfigured() && rewritten < maxRewrite) {
        try { const r = await rewrite(it); if (r.title && r.body) { item.title = r.title; item.body = r.body; item.original = it.title; item.rewritten = true; rewritten++; } } catch (e) { errors.push('改写失败：' + e.message); }
      }
      db.news.items.push(item); added++;
    }
    db.news.items.sort((a, b) => b.at.localeCompare(a.at));
    db.news.items = db.news.items.slice(0, Number(process.env.NEWS_MAX_ITEMS || 3000));
    db.news.lastSync = iso();
    save();
    if (added) log(`新闻稿同步完成：新增 ${added} 条${rewritten ? `，其中 ${rewritten} 条已改写` : ''}`, 'news');
    return { added, rewritten, errors, total: db.news.items.length };
  })();
  try { return await syncing; } finally { syncing = null; }
}

function list({ q = '', day = '' } = {}) {
  const items = db.news.items;
  const days = {};
  items.forEach(i => { days[i.day] = (days[i.day] || 0) + 1; });
  const dayList = Object.entries(days).sort((a, b) => b[0].localeCompare(a[0])).map(([d, n]) => ({ day: d, count: n }));
  const kw = q.trim().toLowerCase();
  let rows = items;
  if (kw) rows = rows.filter(i => (i.title + i.body + i.category + i.source).toLowerCase().includes(kw));
  const useDay = day || (!kw && dayList[0]?.day) || '';
  if (useDay) rows = rows.filter(i => i.day === useDay);
  return { total: items.length, dayCount: dayList.length, days: dayList, day: useDay, items: rows.slice(0, 200), lastSync: db.news.lastSync, llm: llm.llmConfigured() };
}

module.exports = { sync, list };
