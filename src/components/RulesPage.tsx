
import { useMemo, useState } from 'react'
import taxRules from '../data/tax_rules.json'
import type { TaxRule } from '../types'
import { ConfidenceMark } from './Marks'
import { rulesForYear } from '../lib/rules'
import { PageIntro } from './PageShell'
import { socialInsuranceLabels, socialInsuranceRules } from '../lib/socialInsurance'
import type { SocialBaseRule, SocialRateRule } from '../lib/socialInsuranceTypes'

const CONDITION_LABELS = { medicalTier: '医保档次', hukou: '户籍' } as const
const MEDICAL_TIER_LABELS = { tier1: '一档', tier2: '二档' } as const
const HUKOU_LABELS = { local: '本市户籍', nonlocal: '非本市户籍' } as const
const BASIS_LABELS = { salary: '工资基数', reference: '固定参考基数', none: '固定金额项目' } as const
const ratePercent = (value: number) => (value * 100).toFixed(2) + '%'
const fixedAmount = (value?: number) => value ? ' + ' + value.toFixed(2) + ' 元' : ''
const dateLabel = (value: string) => value.slice(0, 10)

function SocialSourceLinks({ ids }: { ids: string[] }) {
  return <div className="rule-source-links">{ids.map((id) => {
    const source = socialInsuranceRules.sources.find((item) => item.id === id)
    return source
      ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
      : <span key={id}>{id}</span>
  })}</div>
}

function Conditions({ conditions }: { conditions?: SocialBaseRule['conditions'] }) {
  if (!conditions) return null
  const parts = Object.entries(conditions).map(([key, value]) => {
    if (key === 'medicalTier') return CONDITION_LABELS.medicalTier + '：' + MEDICAL_TIER_LABELS[value as 'tier1' | 'tier2']
    if (key === 'hukou') return CONDITION_LABELS.hukou + '：' + HUKOU_LABELS[value as 'local' | 'nonlocal']
    return key
  })
  return <small>{parts.join(' · ')}</small>
}

function SocialRulesSection({ city, onCityChange, latestVerified }: { city: string; onCityChange: (city: string) => void; latestVerified: string }) {
  const baseRules = socialInsuranceRules.baseRules.filter((rule) => city === '全部' || rule.city === city)
  const rateRules = socialInsuranceRules.rateRules.filter((rule) => city === '全部' || rule.city === city)
  return <section className="rules-table-wrap social-rules-section">
    <div className="rules-table-title social-rules-title">
      <div><h2>social_insurance_rules.json</h2><p>{'基数与费率分开管理，按缴费所属月份匹配规则；明确截止日期的政策不自动延长。'}</p></div>
      <label className="rule-city-filter"><span>{'城市筛选'}</span><select value={city} onChange={(event) => onCityChange(event.target.value)} aria-label="城市筛选"><option value="全部">{'全部城市'}</option>{socialInsuranceRules.cities.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
    </div>
    <div className="rules-summary social-rules-summary">
      <div><strong>{socialInsuranceRules.cities.length}</strong><span>{'覆盖城市'}</span></div>
      <div><strong>{socialInsuranceRules.baseRules.length}</strong><span>{'基数规则段'}</span></div>
      <div><strong>{socialInsuranceRules.rateRules.length}</strong><span>{'费率规则段'}</span></div>
      <div><strong>{latestVerified}</strong><span>{'最近核验'}</span></div>
    </div>
    <div className="social-rules-block">
      <div className="rules-table-title"><h3>{'基数规则'}</h3><p>{'各险种分别定义基数口径、上下限与固定参考基数。'}</p></div>
      <div className="rules-table social-rules-table" role="table" aria-label="社保基数规则">
        <div className="rules-row rules-row--head" role="row"><span>{'城市'}</span><span>{'适用险种与条件'}</span><span>{'基数口径'}</span><span>{'有效期／来源'}</span></div>
        {baseRules.map((rule) => <div className="rules-row" role="row" key={rule.id}>
          <div><strong>{rule.city}</strong><span>{rule.population}</span><Conditions conditions={rule.conditions} /></div>
          <div><strong>{rule.insurances.map((kind) => socialInsuranceLabels[kind]).join('、')}</strong><span>{BASIS_LABELS[rule.basis]}</span></div>
          <div><strong>{rule.basis === 'none' ? '固定金额' : rule.basis === 'reference' ? '参考 ' + rule.reference : rule.lower + ' — ' + (rule.upper ?? '无上限')}</strong><small>{rule.basis === 'salary' ? '按申报工资或单位工资总额核定' : rule.note}</small></div>
          <div><span>{dateLabel(rule.effectiveFrom)} — {rule.effectiveTo ? dateLabel(rule.effectiveTo) : '现行'}</span><SocialSourceLinks ids={rule.sourceIds} /></div>
        </div>)}
      </div>
    </div>
    <div className="social-rules-block">
      <div className="rules-table-title"><h3>{'费率规则'}</h3><p>{'支持固定金额附加、医保与生育合并计费及工伤基准与用户核定值。'}</p></div>
      <div className="rules-table social-rules-table" role="table" aria-label="社保费率规则">
        <div className="rules-row rules-row--head" role="row"><span>{'城市与险种'}</span><span>{'个人／单位费率'}</span><span>{'个税可扣与合并计费'}</span><span>{'有效期／来源'}</span></div>
        {rateRules.map((rule) => <div className="rules-row" role="row" key={rule.id}>
          <div><strong>{rule.city} · {socialInsuranceLabels[rule.insurance]}</strong><span>{rule.population}</span><Conditions conditions={rule.conditions} /></div>
          <div><strong>{'个人 ' + ratePercent(rule.personalRate) + fixedAmount(rule.personalFixed)}</strong><span>{'单位 ' + ratePercent(rule.employerRate) + fixedAmount(rule.employerFixed)}</span>{rule.employerRateRange && <small>{'单位基准 ' + ratePercent(rule.employerRateRange[0]) + ' — ' + ratePercent(rule.employerRateRange[1])}</small>}</div>
          <div><strong>{rule.taxDeductible ? '个人可税前扣除' : '个人不可税前扣除'}</strong><span>{rule.includes?.length ? '已含：' + rule.includes.map((kind) => socialInsuranceLabels[kind]).join('、') : rule.paymentSource === 'medical-account' ? '医保个账划转，不重复扣薪' : ''}</span>{rule.note && <small>{rule.note}</small>}</div>
          <div><span>{dateLabel(rule.effectiveFrom)} — {rule.effectiveTo ? dateLabel(rule.effectiveTo) : '现行'}</span><SocialSourceLinks ids={rule.sourceIds} /></div>
        </div>)}
      </div>
    </div>
  </section>
}

export function RulesPage() {
  const rules = taxRules as TaxRule[]
  const [year, setYear] = useState(2026)
  const [city, setCity] = useState('全部')
  const activeRules = rulesForYear(rules, year)
  const latestSocialVerified = useMemo(() => socialInsuranceRules.sources.reduce((latest, item) => item.verifiedAt > latest ? item.verifiedAt : latest, ''), [])
  return (
    <div className="rules-page">
      <PageIntro
        stage={{ index: '05', label: '规则依据' }}
        title={'每一个数字，都应该能追溯。'}
        lead={'税率只采用财政部、国家税务总局、全国人大及政府官方网站。规则以生效区间组织，便于未来扩展年度对比。'}
      />

      <section className="rules-summary">
        <div><strong>{rules.length}</strong><span>{'条已核验规则'}</span></div>
        <div><strong>{year}</strong><span>{'正在查看的制度年份'}</span></div>
        <div><strong>100%</strong><span>{'官方来源覆盖'}</span></div>
        <div><strong>{latestSocialVerified}</strong><span>{'最近核验'}</span></div>
      </section>

      <section className="rules-table-wrap">
        <div className="rules-table-title"><h2>tax_rules.json</h2><div className="rule-year-switch"><span>{'适用年份'}</span>{[2015, 2020, 2026].map((item) => <button key={item} className={year === item ? 'is-active' : ''} onClick={() => setYear(item)}>{item}</button>)}<button disabled title="2030 年规则尚未发布">2030?</button></div></div>
        <div className="rules-table" role="table" aria-label="税率规则表">
          <div className="rules-row rules-row--head" role="row"><span>{'税种与类别'}</span><span>{'计算方法'}</span><span>{'征税环节'}</span><span>{'有效期／来源'}</span></div>
          {activeRules.map((rule) => (
            <div className="rules-row" role="row" key={rule.id}>
              <div><strong>{rule.tax_name}</strong><span>{rule.category}</span><ConfidenceMark level={rule.confidence} /></div>
              <div><code>{rule.calculation_method}</code><small>{'计税依据：'}{rule.tax_base}</small></div>
              <div><strong>{rule.taxable_stage}</strong><small>{'法定纳税人：'}{rule.taxpayer}</small></div>
              <div><span>{rule.effective_from} — {rule.effective_to ?? '现行'}</span><a href={rule.source_url} target="_blank" rel="noreferrer">{rule.source_title}</a><small>{'核验：'}{rule.last_verified}</small></div>
            </div>
          ))}
        </div>
      </section>

      <SocialRulesSection city={city} onCityChange={setCity} latestVerified={latestSocialVerified} />

      <section className="methodology-grid">
        <div className="methodology-title"><span className="kicker">{'方法论边界'}</span><h2>{'三条不能跨越的线'}</h2></div>
        <article><b>{'税与社会缴费分开'}</b><p>{'社保与住房公积金单列，不纳入“总可识别税费”。单位缴费也不倒推为个人直接税。'}</p></article>
        <article><b>{'税款与经济负担分开'}</b><p>{'法定纳税人负责申报；经济税负可能由消费者、员工和股东共同承担，零售价无法给出唯一答案。'}</p></article>
        <article><b>{'流转环节避免重复计算'}</b><p>{'进口税、零售增值税、消费税不能脱离各自税基直接相加。无法建立可靠抵扣链时只作知识展示。'}</p></article>
      </section>
    </div>
  )
}
