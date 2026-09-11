# 税镜 · 中国普通人真实税负计算器

面向中国普通居民的个人收入、消费与资产税费模拟器。所有结果严格区分直接税、强制性社会缴费、价格内含税与无法归属的经济成本。

线上地址：[`https://tax.foxapi.uk/`](https://tax.foxapi.uk/)

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 当前功能

- 年度工资、专项附加扣除和个人所得税估算；全年一次性奖金支持单独计税、并入综合所得及自动择低
- 社保基数、公积金基数与工资分离；个人社保、个人公积金、单位社保、单位公积金独立计算
- 上海 2026 社保基数上下限按 1—6 月和 7—12 月分别应用，可切换为手工基数
- 17 类消费支出与含税价格增值税拆分
- 默认展示中性消费估计，并同时给出保守口径与建模覆盖率
- 汽油按购买金额、油价和法定单位税额估算消费税
- 咖啡、手机、汽油、燃油车／新能源车单笔拆解
- 白酒、卷烟从价／从量消费税的可计算性解释
- 新房／二手房契税、卖方住房增值税与土地财政观察
- 上市公司股息红利、普通流通股与限售股投资税务场景
- “普通人的一天”可编辑消费时间线
- 20—80 岁生命周期模拟，并同时输出名义金额与 2026 年购买力
- 自定义城市、收入和缴费情景比较
- 2015、2020、2026 有限可比历史税制快照；2030 不预测未知规则
- “100 元收入旅行图”、税费组成、消费排名、可识别税负日
- 保守／中性两档估计口径；单位用工成本与附加税费放入扩展观察
- 版本化年度模型：12 个月工资、奖金月份、固定月度消费与房车／投资／一次性消费事件
- 五段主链路：三步快速建模 → 我的年度 → 场景试算 → 对比推演 → 年度报告
- 场景写入前影响预览、显式确认、重复防护与即时撤销
- 本地保存、URL 分享、PNG 长图与浏览器打印／PDF
- 官方政策来源、有效期、征税环节、纳税人和可信度字段
- 按年份筛选适用规则

## 验证

```bash
npm test
npm run build
```

界面验收重点视口：1440×900、1280×720、390×844。旧 `view=lab/day/assets/investment/life/compare` 链接会自动映射到新的场景或推演工作台。

## Cloudflare 部署

项目通过 Cloudflare Workers Static Assets 发布，Worker 名称为 `cn-consumption`，生产分支为 `master`。Cloudflare Workers Builds 使用以下配置：

自动部署已于 2026-09-11 启用；推送到 GitHub `master` 后，Cloudflare 会构建并发布新版本。

- Root directory：仓库根目录
- Build command：`npm run build`
- Deploy command：`npm run deploy`
- Production branch：`master`

本地应急部署需要先登录 Wrangler，再执行：

```bash
npm ci
npm test
npm run build
npm run deploy
```

`wrangler.jsonc` 会将 `dist` 作为 SPA 静态资源发布，并把 `tax.foxapi.uk` 绑定为 Custom Domain。Cloudflare API Token、`.dev.vars` 和其他环境凭据不得提交到仓库。

生产故障时，在 Cloudflare 控制台的 Worker **Version History** 中选择上一个健康版本回滚；源码仍以 GitHub `master` 的提交记录为准。

## 方法论边界

- 社保和住房公积金不是税，不纳入“总可识别税费”。
- 价格内含税是按法定税率进行的价税拆分估算，不等于经营者最终实缴税款。
- 企业所得税、上游附加、企业端社会缴费和土地出让收入不默认归入个人税负。
- 当前仅自动处理上海 2026 社保缴费基数上下限；其他城市的基数与比例由用户校准。
- 历史年份、住房交易、完整车辆消费税、生命周期模拟和 PNG 长图导出将在后续版本补齐。

税率数据位于 [`src/data/tax_rules.json`](src/data/tax_rules.json)。
