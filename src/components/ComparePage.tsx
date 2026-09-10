import { useMemo, useState } from 'react'
import { calculateProfile, money } from '../lib/calculations'
import type { CalculatorProfile } from '../types'
import { Approx } from './Marks'
import { YearComparison } from './YearComparison'

interface Scenario {
  name: string
  city: string
  salary: number
  bonus: number
  personalSocialRate: number
  fundRate: number
  employerSocialRate: number
  employerFundRate: number
  spendingScale: number
}

const scenarioFrom = (profile: CalculatorProfile, name: string): Scenario => ({
  name,
  city: profile.city,
  salary: profile.monthlySalary,
  bonus: profile.annualBonus,
  personalSocialRate: profile.pensionRate + profile.medicalRate + profile.unemploymentRate,
  fundRate: profile.housingFundRate,
  employerSocialRate: profile.employerPensionRate + profile.employerMedicalRate + profile.employerUnemploymentRate + profile.employerInjuryRate,
  employerFundRate: profile.employerHousingFundRate,
  spendingScale: 100
})

export function ComparePage({ profile }: { profile: CalculatorProfile }) {
  const [a, setA] = useState<Scenario>(() => scenarioFrom(profile, '当前情景'))
  const [b, setB] = useState<Scenario>(() => ({ ...scenarioFrom(profile, '对比情景'), city: '自定义城市', salary: 25_000, spendingScale: 120 }))
  const results = useMemo(() => [a, b].map((scene) => {
    const socialTotal = scene.personalSocialRate
    const p: CalculatorProfile = {
      ...profile,
      city: scene.city,
      monthlySalary: scene.salary,
      annualBonus: scene.bonus,
      socialInsuranceBase: scene.salary,
      housingFundBase: scene.salary,
      applyCitySocialBaseLimits: false,
      pensionRate: socialTotal,
      medicalRate: 0,
      unemploymentRate: 0,
      housingFundRate: scene.fundRate,
      employerPensionRate: scene.employerSocialRate,
      employerMedicalRate: 0,
      employerUnemploymentRate: 0,
      employerInjuryRate: 0,
      employerHousingFundRate: scene.employerFundRate,
      expenses: Object.fromEntries(Object.entries(profile.expenses).map(([key, value]) => [key, value * scene.spendingScale / 100])) as CalculatorProfile['expenses']
    }
    return calculateProfile(p, 'neutral')
  }), [a, b, profile])
  const maxCost = Math.max(...results.map((item) => item.employerCost), 1)

  return (
    <div className="compare-page">
      <header className="page-intro"><span className="kicker">自定义情景对比</span><h1>不是“哪个城市税高”，<br />而是条件如何改变结果。</h1><p>城市社保缴费基数、比例和政策会调整。这里不内置未经逐条核验的“城市默认税负”，所有差异都由你明确输入。</p></header>
      <section className="compare-editors"><ScenarioEditor value={a} onChange={setA} index="A" /><ScenarioEditor value={b} onChange={setB} index="B" /></section>
      <section className="compare-result">
        <div className="compare-result-head"><div><span className="kicker">同口径比较</span><h2>{a.name} vs {b.name}</h2></div><p>基于 {profile.year} 年个税与流转税规则</p></div>
        <div className="compare-columns">
          {[a, b].map((scene, index) => {
            const result = results[index]
            return <article key={index}><div className="compare-name"><span>{index === 0 ? 'A' : 'B'}</span><div><b>{scene.name}</b><small>{scene.city}</small></div></div><div className="compare-cost"><span>企业用工成本</span><strong>{money(result.employerCost)}</strong><i><b style={{ width: `${result.employerCost / maxCost * 100}%` }} /></i></div><CompareLine label="税前收入" value={result.annualGross} /><CompareLine label="个人所得税" value={result.incomeTax} tax /><CompareLine label="个人缴费（非税）" value={result.personalSocial + result.housingFund} social /><CompareLine label="税后到手" value={result.takeHome} /><CompareLine label="消费价格内含税（中性估计）" value={result.vatEstimate + result.consumptionTaxEstimate} tax estimate /><CompareLine label="总可识别税费" value={result.identifiableTax} tax estimate /><div className="compare-ratio"><span>可识别税费／税前收入</span><strong><Approx>{(result.burdenRatio * 100).toFixed(1)}%</Approx></strong></div></article>
          })}
        </div>
        <div className="compare-delta"><span>两种情景的税后到手差额</span><strong>{money(Math.abs(results[1].takeHome - results[0].takeHome))}</strong><p>差额由收入、奖金和你输入的缴费参数共同形成，不用于评价城市整体税负。</p></div>
      </section>
      <YearComparison profile={profile} />
    </div>
  )
}

function ScenarioEditor({ value, onChange, index }: { value: Scenario; onChange: (value: Scenario) => void; index: string }) {
  const field = (key: keyof Scenario, next: string | number) => onChange({ ...value, [key]: next })
  return <article className="scenario-editor"><div className="scenario-editor__head"><span>{index}</span><input value={value.name} onChange={(event) => field('name', event.target.value)} aria-label={`${index}情景名称`} /></div><label><span>城市标签</span><input value={value.city} onChange={(event) => field('city', event.target.value)} /></label><div className="scenario-fields"><ScenarioNumber label="税前月薪／缴费基数" value={value.salary} onChange={(v) => field('salary', v)} suffix="元" /><ScenarioNumber label="全年奖金" value={value.bonus} onChange={(v) => field('bonus', v)} suffix="元" /><ScenarioNumber label="个人社保比例" value={value.personalSocialRate * 100} onChange={(v) => field('personalSocialRate', v / 100)} suffix="%" /><ScenarioNumber label="个人公积金比例" value={value.fundRate * 100} onChange={(v) => field('fundRate', v / 100)} suffix="%" /><ScenarioNumber label="单位社保比例" value={value.employerSocialRate * 100} onChange={(v) => field('employerSocialRate', v / 100)} suffix="%" /><ScenarioNumber label="单位公积金比例" value={value.employerFundRate * 100} onChange={(v) => field('employerFundRate', v / 100)} suffix="%" /><ScenarioNumber label="消费相对当前" value={value.spendingScale} onChange={(v) => field('spendingScale', v)} suffix="%" /></div></article>
}

function ScenarioNumber({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix: string }) {
  return <label><span>{label}</span><div><input type="number" min="0" step={suffix === '%' ? .5 : 500} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} /><b>{suffix}</b></div></label>
}

function CompareLine({ label, value, tax, social, estimate }: { label: string; value: number; tax?: boolean; social?: boolean; estimate?: boolean }) {
  return <div className={`compare-line ${tax ? 'is-tax' : ''} ${social ? 'is-social' : ''}`}><span>{label}</span><b>{estimate && <Approx />}{money(value)}</b></div>
}
