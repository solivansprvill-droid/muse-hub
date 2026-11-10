const { XMLParser } = require('fast-xml-parser');
const { iso } = require('./time');
const { UA } = require('./market');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', cdataPropName: false });

const txt = v => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v['#text'] ?? v['@href'] ?? '');
  return String(v);
};
const strip = s => txt(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

async function fetchFeed(url, limit = 30) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!r.ok) throw new Error('RSS ' + r.status);
  const x = parser.parse(await r.text());
  let items = x?.rss?.channel?.item || x?.feed?.entry || x?.['rdf:RDF']?.item || [];
  if (!Array.isArray(items)) items = [items];
  return items.slice(0, limit).map(it => {
    let link = it.link;
    if (Array.isArray(link)) link = link.find(l => l['@rel'] !== 'self') || link[0];
    link = typeof link === 'object' ? link['@href'] || txt(link) : txt(link);
    const body = strip(it['content:encoded'] || it.content || it.description || it.summary || '');
    return {
      title: strip(it.title),
      link,
      content: body,
      at: iso(new Date(txt(it.pubDate || it.published || it.updated || it['dc:date']) || Date.now())),
      source: strip(it.source) || ''
    };
  }).filter(i => i.title);
}

module.exports = { fetchFeed, strip };
