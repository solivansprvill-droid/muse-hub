# Muse · 个人 AI 指挥台

手机优先的深色 Web 应用，复刻视频里 Muse 的全部空间：

| 位置 | 功能 |
|---|---|
| 选项卡 · 主要聊天 | 和 Muse 对话（LLM），记录持久化 |
| 选项卡 · 动态 | 所有空间的操作自动记成动态，也可以手动发 |
| 选项卡 · 点子 / 目标 / 资源库 | 增删改查；点子一键变成 Muse 的任务，目标拖动进度 |
| **Muse总裁办公室** | "Muse 此刻的工作状态" + 正在干/等你/定时/搁置/已完成计数；three.js 3D 等距办公室（书架、L 形桌、双屏、沙发、城市夜景窗、后墙大屏），拖动旋转、滚轮/双指缩放、右键/双指平移；任务状态板改状态会**实时同步到 3D 里的双屏和后墙大屏**，每 10 秒自动刷新；下达新任务 |
| **Agent 指挥中心** | 浅色主题；查岗结果（空工位）、认真工作/等待中/已收尾/待机计数；全景 / 老板视角 / 巡逻一圈 / 抓摸鱼 四种镜头 + 自动转；9 个工位、低多边形小人，头顶名牌和状态气泡（认真工作、思考中、摸鱼中、上厕所、喝水、走动中、聊天中…），"自动"模式下小人会自己工作、喝水、串门；点小人打开面板：设置实时状态、任务看板（暂停/开始/删除/添加）、安排干活/停止干活/恢复启动、给 Agent 下指令（接 LLM，未配置时模拟） |
| **军事情报** | PolyGlobe 3D 情报图层：自绘 three.js 地球（真实国界 + 中文国名，可开关），六类示例信号点（预测市场热点、军事基地、火灾探测点、航母活动海域、疫情监测点、异常热源），**ISS 实时位置**（每 3 秒，含高度/速度/轨迹，一键 Locate ISS），**NASA EONET 实时野火**，**NASA FIRMS 实时火点点云**（需 key）；点亮点地球自动转过去并弹出事件卡 |
| **新闻稿** | 每日稿子：从 RSS 订阅源抓取、去重、按天分组；关键词搜索、日期标签、展开全文、复制全文；配置 LLM 后自动改写成中文短稿；每 30 分钟自动同步 + 立即同步 |
| **TradingAgents** | 跑分析 / 分析报告 / 运行历史 / 更多信息。多智能体流水线：技术面、新闻、基本面分析师 → 多头 ↔ 空头研究员辩论 → 研究经理裁决 → 交易员计划（Entry/Stop/Target/仓位 + FINAL TRANSACTION PROPOSAL）→ 风控激进/保守/中性三方辩论 → 组合经理最终 Rating。用真实日线计算指标、抓个股新闻；报告分篇查看、"完整报告"阅读器、复制全文、下载 .md / 网页版。也可终端运行 |
| **量化交易** | 自选股卡片（收盘、RSI、量比、SMA50、今日出信号 + 入场/止损/目标）；趋势 trend / 均值回归 revert 两套策略 5 年组合回测：净收益、总回报、期末资金、交易数、胜率、盈亏比、夏普、年化、最大回撤、净值曲线、回撤图、逐笔表现；策略规则与风控说明 |
| **StockStats 技术指标** | 每只股票：SMA5/10/20/50/200、MACD / 信号 / 柱、RSI(14)、布林上/中/下轨、ATR(14)、当日量、20 日均量；可增删代码 |
| **交易台审核** | 每轮复审的问题清单（高/中/低危），勾选修复、新一轮自动带入未修问题、全部修完即"完全通过"；可让 AI 审一段代码自动生成问题 |
| **OpenMausBot** | 机器人分身：/status /news /quote /task /help；网页内测试对话；配置 Telegram Token 后手机直接用 |
| **创建空间** | 自建空间（图标 + 名称），里面放笔记 / 待办 / 链接，出现在左侧空间列表 |

> ⚠️ 所有股票相关内容**仅供研究，不构成投资建议**。本项目只做分析：不连接券商、不下单、不涉及加密货币。

## 快速开始（本地）

需要 Node.js 18+。

```bash
git clone https://github.com/solivansprvill-droid/muse-hub.git
cd muse-hub
npm install
cp .env.example .env      # 可选：填 LLM key 等
npm start                 # 打开 http://localhost:3000
```

手机访问：电脑和手机在同一 Wi-Fi 下，打开 `http://电脑IP:3000`；也可以"添加到主屏幕"当 App 用。

## Docker 部署

```bash
cp .env.example .env      # 填好配置，公网部署务必设置 MUSE_PASSWORD
docker compose up -d --build
# 数据保存在 ./data（任务、Agent、稿子、报告、行情缓存）
```

不用 compose：

```bash
docker build -t muse-hub .
docker run -d --name muse -p 3000:3000 --env-file .env -v $PWD/data:/data muse-hub
```

## 不填任何 key 能用什么

| 功能 | 无 key | 需要的环境变量 |
|---|---|---|
| 总裁办公室 3D、任务板、Agent 指挥中心（状态/任务/镜头） | ✅ | — |
| 情报地球：国界、示例信号点、ISS 实时位置、EONET 实时野火 | ✅ | — |
| 情报地球：FIRMS 实时火点点云 | ❌ | `FIRMS_MAP_KEY` |
| 新闻稿：RSS 抓取、搜索、按天浏览（显示原文） | ✅ | — |
| 新闻稿：改写成中文短稿 | ❌ | `LLM_*` |
| 量化交易、StockStats 指标（Yahoo Finance 免费行情） | ✅ | — |
| TradingAgents | ✅ 模拟模式（真实指标 + 规则生成结论） | `LLM_*` 才有完整的多智能体推理 |
| 主要聊天、给 Agent 下指令、交易台 AI 审核 | 模拟回复 | `LLM_*` |
| OpenMausBot 命令（/status /news /quote /task） | ✅ 网页内 | `TELEGRAM_BOT_TOKEN` 接入 Telegram |

LLM 用任意 OpenAI 兼容接口：

```env
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxxx
LLM_MODEL=deepseek-chat
```

智谱 GLM：`https://open.bigmodel.cn/api/paas/v4` + `glm-4-flash`；通义千问：`https://dashscope.aliyuncs.com/compatible-mode/v1` + `qwen-plus`。

## 终端运行 TradingAgents

```bash
node scripts/ta-cli.js NVDA 2026-11-06
# 报告写到 data/reports/<id>/，网页「分析报告」里同步可见
```

## 自检

```bash
npm run smoke   # 启动一个假的 LLM 服务 + Muse，逐个测试主要接口
```

## 目录结构

```
server.js              Express 后端（全部 API）
lib/
  store.js seed.js     JSON 存储（data/db.json）与演示数据
  llm.js               OpenAI 兼容调用
  market.js            Yahoo 日线 + SMA/EMA/MACD/RSI/布林/ATR
  quant.js             信号与组合回测
  ta.js                TradingAgents 多智能体流水线
  news.js rss.js       新闻抓取与改写
  intel.js             ISS / EONET / FIRMS / 示例信号点
  bot.js               OpenMausBot + Telegram
public/
  index.html css/ js/  前端（原生 ES Module，无需构建）
  js/three/            office3d.js · agents3d.js · globe.js
  vendor/three/        three.js r160（本地化，离线可用）
  data/borders.json    国界线（Natural Earth 110m，经 world-atlas 转换）
scripts/               ta-cli.js · smoke.js
```

## 自定义

- **换成你自己的 Agent**：编辑 `lib/seed.js` 里的 `agents`（或删掉 `data/db.json` 重新生成）。
- **情报示例点**：`lib/intel.js` 的 `LAYERS.points`。
- **新闻源**：网页「设置」里改，每行 `名称 | RSS 地址 | 分类`。
- **自选股**：量化交易页底部 / StockStats 页顶部。

## 说明

- 行情来自 Yahoo Finance 公开 chart 接口，非官方，偶尔会限流；服务端缓存 30 分钟，失败时用旧缓存兜底。盘中价格和量是当日实时累计值。
- TradingAgents 的角色设计参考开源项目 [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents)，这里是 JavaScript 重写版，不依赖 Python。免费数据源不含完整财报，基本面部分由 LLM 基于公开知识分析，请自行核对。
- 情报地球上的六类地面信号点是整理版示例数据；ISS、EONET、FIRMS 为实时数据。
