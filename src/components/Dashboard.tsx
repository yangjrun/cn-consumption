import { FlowDiagram } from './FlowDiagram'
import { Approx, ConfidenceMark } from './Marks'
import { compactMoney, getFreedomDate, money, monthlyTaxSchedule } from '../lib/calculations'
import type { CalculatorProfile, MonthlyTaxPoint, TaxResult, ViewMode } from '../types'

const metricHelp = {
  income: '工资与奖金合计，不等同于企业实际用工成本。',
  takeHome: '税前收入扣除个人所得税、个人社保与住房公积金。',
  direct: '工资按年度综合所得计税；符合条件的全年一次性奖金按所选方式计算。',
  social: '个人养老、医疗、失业保险和住房公积金；它们不是税。',
  embedded: '消费含税价中按法定税率拆出的增值税，加能够从现有输入识别的选择性消费税。',
  total: '个人直接税与消费价格中可识别税收因素之和，不含社会缴费。'
}

function Metric({ label, value, tone, help, estimate, subline }: { label: string; value: number; tone?: string; help: string; estimate?: boolean; subline?: string }) {
  return (
    <article className={`metric ${tone ? `metric--${tone}` : ''}`} title={help}>
      <div className="metric__label"><span>{label}</span><span className="info-mark">i</span></div>
      <strong>{estimate && <span className="metric__approx">≈</span>}{money(value)}</strong>
      {subline && <small className="metric__subline">{subline}</small>}
    </article>
  )
}

const DONUT_RADIUS = 55
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

function Donut({ result }: { result: TaxResult }) {
  const total = Math.max(1, result.identifiableTax)
  const parts = [
    { key: 'income', value: result.incomeTax, stroke: 'var(--tax)' },
    { key: 'vat', value: result.vatEstimate, stroke: 'url(#donut-hatch-gold)' },
    { key: 'fuel', value: result.consumptionTaxEstimate, stroke: 'url(#donut-hatch-soft)' }
  ]
  let cursor = 0
  const segments = parts.map((part) => {
    const length = part.value / total * DONUT_CIRCUMFERENCE
    const segment = { ...part, length, offset: cursor }
    cursor += length
    return segment
  })

  return (
    <div className="donut-block">
      <div
        className="donut"
        role="img"
        aria-label={`可识别税费构成：个人所得税 ${money(result.incomeTax)}，增值税价税部分 ${money(result.vatEstimate)}，法定消费税 ${money(result.consumptionTaxEstimate)}，合计 ${money(result.identifiableTax)}。税负占税前收入 ${(result.burdenRatio * 100).toFixed(1)}%。`}
      >
        <svg className="donut__svg" viewBox="0 0 140 140" aria-hidden="true" focusable="false">
          <defs>
            <pattern id="donut-hatch-gold" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--gold)" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--paper)" strokeWidth="3" opacity=".8" />
            </pattern>
            <pattern id="donut-hatch-soft" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--tax-soft)" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--paper)" strokeWidth="3" opacity=".8" />
            </pattern>
          </defs>
          <circle cx="70" cy="70" r={DONUT_RADIUS} fill="none" stroke="var(--line)" strokeWidth="16" />
          {segments.filter((segment) => segment.length > 0).map((segment) => (
            <circle
              key={segment.key}
              cx="70"
              cy="70"
              r={DONUT_RADIUS}
              fill="none"
              stroke={segment.stroke}
              strokeWidth="16"
              strokeDasharray={`${segment.length} ${DONUT_CIRCUMFERENCE - segment.length}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 70 70)"
            />
          ))}
        </svg>
        <div className="donut__center"><strong>{(result.burdenRatio * 100).toFixed(1)}%</strong><span>占税前收入</span></div>
      </div>
      <ul className="legend-list">
        <li><span className="legend-dot legend-dot--income" /><div><b>个人所得税</b><small>直接税 · 实心</small></div><strong>{money(result.incomeTax)}</strong></li>
        <li><span className="legend-dot legend-dot--vat" /><div><b>增值税价税部分</b><small>价格内含税估算 · 斜纹</small></div><strong><Approx>{money(result.vatEstimate)}</Approx></strong></li>
        <li><span className="legend-dot legend-dot--fuel" /><div><b>法定消费税（已识别）</b><small>当前仅按汽油升数估算 · 斜纹</small></div><strong><Approx>{money(result.consumptionTaxEstimate)}</Approx></strong></li>
      </ul>
      <table className="sr-only">
        <caption>可识别税费构成明细</caption>
        <thead><tr><th scope="col">类目</th><th scope="col">金额</th></tr></thead>
        <tbody>
          <tr><th scope="row">个人所得税（直接税）</th><td>{money(result.incomeTax)}</td></tr>
          <tr><th scope="row">增值税价税部分（估算）</th><td>{money(result.vatEstimate)}</td></tr>
          <tr><th scope="row">法定消费税（已识别）</th><td>{money(result.consumptionTaxEstimate)}</td></tr>
          <tr><th scope="row">合计可识别税费</th><td>{money(result.identifiableTax)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

const MONTH_SEGMENTS: Array<{ key: 'salaryIncomeTax' | 'embeddedTax' | 'bonusTax'; className: string; label: string }> = [
  { key: 'salaryIncomeTax', className: 'month-bar__seg--salary', label: '工资个税' },
  { key: 'embeddedTax', className: 'month-bar__seg--embedded', label: '消费内含税' },
  { key: 'bonusTax', className: 'month-bar__seg--bonus', label: '奖金个税' }
]

/**
 * 12 个月税费节奏。
 *
 * 这里不再把年度金额除以 12——那会让 12 根柱子完全一样，图表等于没有信息。
 * 工资个税改按累计预扣法逐月推算：年初处于最低档、跨档后跳升，
 * 7 月还会因上海社保基数切换到新社保年度而改变扣除额。
 */
function MonthBars({ profile, result }: { profile: CalculatorProfile; result: TaxResult }) {
  const schedule = monthlyTaxSchedule(profile, result)
  const peak = schedule.reduce((best, point) => (point.total > best.total ? point : best), schedule[0])
  const max = Math.max(...schedule.map((point) => point.total), 1)
  const first = schedule[0]
  const last = schedule[11]
  const annualTotal = schedule.reduce((sum, point) => sum + point.total, 0)
  const hasBonus = result.annualBonusIncomeTax > 0
  const segments = MONTH_SEGMENTS.filter((segment) => segment.key !== 'bonusTax' || hasBonus)

  return (
    <div className="month-block">
      <div className="month-chart" role="list" aria-label="按月推算的可识别税费">
        {schedule.map((point) => {
          const height = (value: number) => (value > 0 ? value / max * 100 : 0)
          return (
            <div
              className="month-bar"
              key={point.month}
              role="listitem"
              aria-label={`${point.month} 月：可识别税费 ${money(point.total)}，其中工资个税 ${money(point.salaryIncomeTax)}、消费内含税 ${money(point.embeddedTax)}${point.bonusTax > 0 ? `、奖金个税 ${money(point.bonusTax)}` : ''}`}
              title={`${point.month} 月：${money(point.total)}`}
            >
              <span className="month-bar__plot" aria-hidden="true">
                {point.bonusTax > 0 && <i className="month-bar__seg month-bar__seg--bonus" style={{ height: `${height(point.bonusTax)}%` }} />}
                <i className="month-bar__seg month-bar__seg--embedded" style={{ height: `${height(point.embeddedTax)}%` }} />
                <i className="month-bar__seg month-bar__seg--salary" style={{ height: `${height(point.salaryIncomeTax)}%` }} />
              </span>
              <span className="month-bar__label" aria-hidden="true">{point.month}</span>
            </div>
          )
        })}
      </div>

      <ul className="month-legend">
        {segments.map((segment) => (
          <li key={segment.key}><i className={`month-key ${segment.className}`} />{segment.label}</li>
        ))}
      </ul>

      <dl className="month-facts">
        <div><dt>1 月</dt><dd>{money(first.total)}</dd></div>
        <div><dt>12 月</dt><dd>{money(last.total)}</dd></div>
        <div><dt>最高月份</dt><dd>{peak.month} 月 · {money(peak.total)}</dd></div>
        <div><dt>全年合计</dt><dd>{money(annualTotal)}</dd></div>
      </dl>

      <table className="sr-only">
        <caption>12 个月可识别税费推算明细</caption>
        <thead><tr><th scope="col">月份</th><th scope="col">工资个税</th><th scope="col">消费内含税</th><th scope="col">奖金个税</th><th scope="col">合计</th></tr></thead>
        <tbody>
          {schedule.map((point: MonthlyTaxPoint) => (
            <tr key={point.month}>
              <th scope="row">{point.month} 月</th>
              <td>{money(point.salaryIncomeTax)}</td>
              <td>{money(point.embeddedTax)}</td>
              <td>{money(point.bonusTax)}</td>
              <td>{money(point.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Dashboard({ result, profile, mode, onEdit }: { result: TaxResult; profile: CalculatorProfile; mode: ViewMode; onEdit: () => void }) {
  const ranked = [...result.expenseTaxes].filter((item) => item.spend > 0).sort((a, b) => b.total - a.total).slice(0, 5)
  const maxTax = Math.max(...ranked.map((item) => item.total), 1)

  return (
    <div className="dashboard-page">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="edition-line"><span>2026 个人税费观察</span><span>{profile.city}</span></div>
          <h1>你的工资条，<br />只告诉你看得见的税。</h1>
          <p>还有一些税，已经包含在你每天支付的价格里。我们把可识别的部分拆出来，也把不能确定的部分留白。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onEdit}>调整我的数据</button>
            <span><ConfidenceMark level="high" /> 当前结果基于 {profile.year} 年规则</span>
          </div>
        </div>
        <aside className="hero-statement">
          <span>你的可识别税负模拟</span>
          <strong><Approx>{(result.burdenRatio * 100).toFixed(1)}%</Approx></strong>
          <p>直接税 + 消费价格中可识别税收因素<br />÷ 年税前收入</p>
          <dl className="hero-facts">
            <div>
              <dt>总可识别税费</dt>
              <dd><Approx>{money(result.identifiableTax)}</Approx></dd>
            </div>
            <div>
              <dt>个人缴费（非税）</dt>
              <dd>{money(result.personalSocial + result.housingFund)}</dd>
            </div>
            <div>
              <dt>其中税上税（附加税费）</dt>
              <dd><Approx>{money(result.taxOnTaxEstimate)}</Approx></dd>
            </div>
          </dl>
          <small>不含社保、公积金，也不代表宏观税负。附加税费按{(result.surchargeRate * 100).toFixed(0)}% 费率单列，不并入总可识别税费。</small>
        </aside>
      </section>

      <section className="metric-grid" aria-label="年度摘要">
        <Metric label="年税前收入" value={result.annualGross} help={metricHelp.income} />
        <Metric label="税后到手" value={result.takeHome} help={metricHelp.takeHome} />
        <Metric label="直接税" value={result.incomeTax} tone="tax" help={metricHelp.direct} subline={profile.annualBonus > 0 ? `奖金${result.effectiveAnnualBonusTaxMethod === 'separate' ? '单独计税' : '并入综合所得'}` : undefined} />
        <Metric
          label="消费价格内含税估计"
          value={result.vatEstimate + result.consumptionTaxEstimate}
          tone="estimate"
          help={metricHelp.embedded}
          estimate
          subline={`${mode === 'conservative' ? `中性估计 ${money(result.centralEmbeddedTaxEstimate)}` : `保守口径 ${money(result.conservativeEmbeddedTaxEstimate)}`} · 建模覆盖 ${(result.consumptionSpendCoverage * 100).toFixed(0)}%`}
        />
      </section>

      {mode === 'broad' && (
        <section className="employer-ledger" aria-label="单位缴费与用工成本">
          <div><span>企业实际用工成本</span><strong>{money(result.employerCost)}</strong><small>税前工资 + 单位社保 + 单位公积金</small></div>
          <div><span>单位社会保险缴费</span><strong>{money(result.employerSocial)}</strong><small>不是个人直接税，也不从到手工资扣除</small></div>
          <div><span>单位住房公积金</span><strong>{money(result.employerHousingFund)}</strong><small>单独进入职工公积金账户</small></div>
        </section>
      )}

      <section className="section-block flow-section">
        <div className="section-heading">
          <div><span className="kicker">收入流向</span><h2>100 元收入旅行图</h2></div>
          <p>以税前收入为基准，先看工资阶段的分配，再看已录入消费中的价格内含税。</p>
        </div>
        <FlowDiagram result={result} />
      </section>

      <section className="analysis-grid">
        <article className="analysis-panel composition-panel">
          <div className="panel-heading"><div><span className="kicker">构成</span><h2>可识别税费</h2></div><ConfidenceMark level={mode === 'conservative' ? 'high' : 'model'} compact /></div>
          <Donut result={result} />
        </article>
        <article className="analysis-panel ranking-panel">
          <div className="panel-heading"><div><span className="kicker">消费</span><h2>哪些消费含税更多</h2></div><small>年估算</small></div>
          <ol className="rank-list">
            {ranked.map((item, index) => (
              <li key={item.key}>
                <span className="rank-index">0{index + 1}</span>
                <div><div className="rank-copy"><b>{item.label}</b><strong><Approx>{money(item.total)}</Approx></strong></div><div className="rank-track"><i style={{ width: `${item.total / maxTax * 100}%` }} /></div></div>
                <ConfidenceMark level={item.confidence} compact />
              </li>
            ))}
          </ol>
        </article>
        <article className="analysis-panel freedom-panel">
          <div className="panel-heading"><div><span className="kicker">模拟指标</span><h2>可识别税负日</h2></div><ConfidenceMark level="model" compact /></div>
          <div className="freedom-date"><strong>{getFreedomDate(profile.year, result.freedomDay)}</strong><span>全年第 {result.freedomDay} 天</span></div>
          <div className="calendar-track"><i style={{ width: `${result.freedomDay / 365 * 100}%` }} /><b style={{ left: `${result.freedomDay / 365 * 100}%` }} /></div>
          <div className="calendar-labels"><span>1 月 1 日</span><span>12 月 31 日</span></div>
          <p>把全年可识别税费与税前收入之比映射到 365 天。它不是官方指标，也不是“中国税收自由日”。</p>
        </article>
        <article className="analysis-panel monthly-panel">
          <div className="panel-heading"><div><span className="kicker">节奏</span><h2>12 个月税费折算</h2></div><small>累计预扣法 · 按实际节奏</small></div>
          <MonthBars profile={profile} result={result} />
          <p>工资个税按累计预扣法逐月推算：累计应纳税所得额跨过税率档位后，当月预扣额会跳升，因此年初低、年末高。个人社保在 7 月切换到新的社保年度基数，消费内含税按月均摊，全年一次性奖金税额集中计入 12 月。仅用于观察节奏，不含社保与公积金。</p>
        </article>
      </section>

      <section className="principle-note">
        <div className="principle-note__mark">≠</div>
        <div><h2>社会缴费不是税，价格内含税也不等于商家最终缴税。</h2><p>增值税估算是含税价格的理论价税拆分。企业实际应纳增值税还涉及进项抵扣；消费税是价内税、其税额进入增值税计税依据，附加税费又以增值税和消费税为基数——同一个价格上叠了不止一层税。消费税的法定纳税人与经济承担者也可能不同。</p></div>
        <span>{compactMoney(result.personalSocial + result.housingFund)}<small>个人社保 {money(result.personalSocial)} · 个人公积金 {money(result.housingFund)}</small></span>
      </section>
    </div>
  )
}
