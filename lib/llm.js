// OpenAI 兼容接口（DeepSeek / GLM / Qwen / OpenAI / 本地 Ollama 都可以）
// 环境变量：LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
function llmConfigured() {
  return !!(process.env.LLM_API_KEY || process.env.LLM_BASE_URL?.includes('localhost'));
}

async function chat(messages, { temperature = 0.6, max_tokens = 1800, timeoutMs = 120000 } = {}) {
  if (!llmConfigured()) throw new Error('LLM 未配置（缺少 LLM_API_KEY）');
  const base = (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'deepseek-chat';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (process.env.LLM_API_KEY || 'none') },
      body: JSON.stringify({ model, messages, temperature, max_tokens })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('LLM 请求失败 ' + r.status + ': ' + (j.error?.message || JSON.stringify(j).slice(0, 200)));
    return j.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chat, llmConfigured };
