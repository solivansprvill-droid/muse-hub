// 标准 ISO 时间字符串（不依赖 Date.prototype.toISOString，避免个别运行环境被改写）
const p = (n, l = 2) => String(n).padStart(l, '0');
function iso(d = new Date()) {
  d = d instanceof Date ? d : new Date(d);
  if (isNaN(d.getTime())) d = new Date();
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}Z`;
}
module.exports = { iso };
