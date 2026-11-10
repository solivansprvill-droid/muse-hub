// OpenMausBot：网页里可直接测试；配置 TELEGRAM_BOT_TOKEN 后自动接入 Telegram（长轮询）
const { iso } = require('./time');
const { db, save, uid, log } = require('./store');
const llm = require('./llm');
const { getDaily, snapshot } = require('./market');

async function handle(text, from = 'web') {
  text = String(text || '').trim();
  let reply;
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ');
  try {
    if (cmd === '/help' || cmd === '/start') reply = db.bot.commands.map(c => `${c.cmd} — ${c.desc}`).join('\n');
    else if (cmd === '/status') {
      const doing = db.office.tasks.filter(t => t.status === 'doing');
      reply = doing.length ? '正在干：\n' + doing.map(t => '• ' + t.title).join('\n') : 'Muse 目前没有进行中的任务';
    } else if (cmd === '/news') {
      const items = db.news.items.slice(0, 8);
      reply = items.length ? items.map((n, i) => `${i + 1}. ${n.title}`).join('\n') : '还没有稿子，先去新闻稿点「立即同步」';
    } else if (cmd === '/quote') {
      const s = snapshot(await getDaily(arg || 'NVDA', '1y'));
      reply = `${s.symbol} ${s.date} 收盘 ${s.close.toFixed(2)}（${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%）RSI ${s.rsi14?.toFixed(1)} SMA50 ${s.sma50?.toFixed(2)}`;
    } else if (cmd === '/task') {
      if (!arg) reply = '用法：/task 任务标题';
      else {
        db.office.tasks.unshift({ id: uid('t'), title: arg, status: 'doing', detail: '来自 OpenMausBot', updatedAt: iso() });
        log('OpenMausBot 下达新任务：' + arg, 'office');
        reply = '收到，已加入 Muse 的任务状态板：' + arg;
      }
    } else if (llm.llmConfigured()) {
      reply = await llm.chat([{ role: 'system', content: '你是 OpenMausBot，Muse 的聊天机器人分身，简洁友好地用中文回答。' }, { role: 'user', content: text }], { max_tokens: 600 });
    } else reply = '（模拟回复）我收到了：「' + text + '」。配置 LLM_API_KEY 后我就能真正回答了。发送 /help 查看命令。';
  } catch (e) {
    reply = '出错了：' + e.message;
  }
  db.bot.log.push({ id: uid('b'), from, text, reply, at: iso() });
  db.bot.log = db.bot.log.slice(-200);
  save();
  return reply;
}

let tgRunning = false;
async function startTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || tgRunning) return;
  tgRunning = true;
  const api = m => `https://api.telegram.org/bot${token}/${m}`;
  const allow = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  let offset = 0;
  console.log('[bot] Telegram 长轮询已启动');
  while (true) {
    try {
      const r = await fetch(api('getUpdates') + `?timeout=50&offset=${offset}`, { signal: AbortSignal.timeout(60000) });
      const j = await r.json();
      for (const u of j.result || []) {
        offset = u.update_id + 1;
        const msg = u.message; if (!msg?.text) continue;
        if (allow.length && !allow.includes(String(msg.chat.id))) continue;
        const reply = await handle(msg.text, 'telegram:' + msg.chat.id);
        await fetch(api('sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: msg.chat.id, text: reply.slice(0, 4000) }) });
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

module.exports = { handle, startTelegram, telegramEnabled: () => !!process.env.TELEGRAM_BOT_TOKEN };
