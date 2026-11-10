// 初始演示数据——名单和任务是演示数据，随时可以换成你真实的 Agent
const { iso } = require('./time');
function seed() {
  const now = iso();
  const t = (id, title, status, detail) => ({ id, title, status, detail, updatedAt: now });
  const agent = (id, name, nick, role, status, desk, color, tasks) => ({ id, name, nick, role, status, mode: 'auto', desk, color, tasks });
  const tk = (title, state = 'idle') => ({ id: Math.random().toString(36).slice(2, 9), title, state });
  return {
    version: 1,
    office: {
      tasks: [
        t('t1', '修交易台第 6 轮', 'doing', '第六次复审剩 10 个低危，正在修，目标完全通过'),
        t('t2', '新闻监控中', 'doing', '每 30 分钟扫一遍订阅源，有大事就推送'),
        t('t3', 'Claude 申诉', 'waiting', '等你确认申诉材料后提交'),
        t('t4', '每日稿子整理', 'doing', '把今天抓到的新闻改写成稿子'),
        t('t5', '量化回测周报', 'doing', '趋势 / 均值回归两套策略的周度复盘'),
        t('t6', 'StockStats 指标刷新', 'doing', '自选股技术指标每日收盘后更新'),
        t('t7', '恋爱助理工作流 v2', 'shelved', '文案润色先放一放'),
        t('t8', '个人网站改版', 'shelved', '等素材')
      ]
    },
    agents: [
      agent('U01', 'Muse', '大脑', '总调度，拆任务、派活、盯进度', 'work', 0, '#7cc4a4', [tk('拆解今日任务', 'doing'), tk('盯交易台第 6 轮')]),
      agent('U02', 'ChatGPT', '笔杆子', '写东西的，稿子都归它', 'think', 1, '#8e7cc3', [tk('写新闻稿', 'doing'), tk('今日 X 新闻稿：写 3 条热点草稿'), tk('把交易台周报改成口语版'), tk('恋爱助理工作流 v2 文案润色')]),
      agent('U03', 'WorkBuddy', '摸鱼王', '杂活小能手，偶尔摸鱼', 'slack', 2, '#e8a65d', [tk('整理资源库链接', 'doing')]),
      agent('U04', 'Kimi', '长文王', '长文档阅读与总结', 'work', 3, '#5d9be8', [tk('读完 10-K 并总结', 'doing')]),
      agent('U05', 'DeepSeek Harness', '深思者', '深度推理、代码审查', 'idle', 4, '#4a6fd1', []),
      agent('U06', 'Claude', '文曲星', '代码与长文写作', 'work', 5, '#d98b5f', [tk('交易台代码复审', 'doing')]),
      agent('U07', 'Grok', '快嘴', '实时热点、X 舆情', 'work', 6, '#d14a6f', [tk('盯 X 热搜', 'doing')]),
      agent('U08', 'Gemini', '双子星', '多模态、图表解读', 'work', 7, '#4ab3d1', [tk('解读回测图表', 'doing')]),
      agent('U09', 'Qwen', '千问', '中文检索与翻译', 'idle', 8, '#c94a4a', [])
    ],
    chats: [
      { id: 'c0', role: 'assistant', content: '你好，我是 Muse。想让我干点什么？可以直接说，也可以去左边的空间看看各个 Agent 在忙什么。', at: now }
    ],
    moments: [
      { id: 'm0', text: 'Muse 上线了：总裁办公室、Agent 指挥中心、情报地球都已就位。', kind: 'system', at: now }
    ],
    ideas: [
      { id: 'i1', title: '把每日稿子自动发到公众号草稿箱', note: '', tag: '自动化', at: now, done: false },
      { id: 'i2', title: '情报地球加一个航班层', note: 'OpenSky API', tag: '情报', at: now, done: false }
    ],
    goals: [
      { id: 'g1', title: '交易台审核完全通过', progress: 80, due: '', at: now },
      { id: 'g2', title: '每日稿子连续 30 天不断更', progress: 40, due: '', at: now }
    ],
    resources: [
      { id: 'r1', title: 'TradingAgents (TauricResearch)', url: 'https://github.com/TauricResearch/TradingAgents', tag: '量化', at: now },
      { id: 'r2', title: 'NASA EONET API', url: 'https://eonet.gsfc.nasa.gov/docs/v3', tag: '情报', at: now },
      { id: 'r3', title: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/api/', tag: '情报', at: now }
    ],
    news: { items: [], lastSync: null },
    ta: { reports: [], runs: [] },
    reviews: [
      {
        id: 'rv6', round: 6, title: '交易台第 6 轮复审', status: 'fixing', at: now,
        issues: [
          ...Array.from({ length: 10 }, (_, i) => ({ id: 'iss' + i, level: 'low', text: ['日志里打印了完整请求体', '回测参数没有上下限校验', '错误提示是英文', '止损价保留位数不一致', '缓存过期时间写死', '空数据时图表报错', '日期时区未显式声明', '代码输入未转大写', '重复请求未去重', '导出文件名含空格'][i], fixed: false }))
        ]
      },
      {
        id: 'rv5', round: 5, title: '交易台第 5 轮复审', status: 'done', at: now,
        issues: [
          { id: 'a1', level: 'mid', text: '风控仓位可以超过 100%', fixed: true },
          { id: 'a2', level: 'high', text: '信号计算使用了未来数据（look-ahead）', fixed: true }
        ]
      }
    ],
    bot: {
      name: 'OpenMausBot', enabled: true,
      commands: [
        { cmd: '/status', desc: 'Muse 此刻在干什么' },
        { cmd: '/news', desc: '今天的稿子标题' },
        { cmd: '/quote NVDA', desc: '查最新收盘价与 RSI' },
        { cmd: '/task 标题', desc: '给 Muse 下达新任务' },
        { cmd: '/help', desc: '命令列表' }
      ],
      log: []
    },
    spaces: [],
    settings: {
      watchlist: ['AMZN', 'META', 'GOOGL', 'SPCX', 'LLY', 'ORCL', 'NVDA', 'TSLA'],
      stockstats: ['NVDA', 'AVGO', 'BA', 'AMZN', 'ASML', 'ASTS'],
      feeds: [
        { name: 'BBC 中文', url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml', category: '国际' },
        { name: 'Google 新闻·中文', url: 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans', category: '综合' },
        { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: '科技' },
        { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: '科技' },
        { name: 'CNBC Markets', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', category: '财经' }
      ]
    }
  };
}
module.exports = { seed };
