import { useEffect, useMemo, useState } from 'react'
import { annualIncomeTax, money } from '../lib/calculations'
import type { CalculatorProfile } from '../types'
import { Approx, ConfidenceMark } from './Marks'
import { PageIntro } from './PageShell'

interface LifeYear {
  age: number
  income: number
  tax: number
  social: number
  embedded: number
  assetTax: number
  realFactor: number
}

export function LifecyclePage({ embeddedRate, profile, onUseScenario }: { embeddedRate: number; profile?: CalculatorProfile; onUseScenario?: (profile: CalculatorProfile, label: string) => void }) {
  const profileSpend = profile ? Object.values(profile.expenses).reduce((sum, value) => sum + value, 0) * 12 : 72_000
  const restore = () => {
    try { return JSON.parse(sessionStorage.getItem('taxlens.lifecycle.v1') ?? '{}') as Record<string, number> } catch { return {} }
  }
  const saved = useMemo(restore, [])
  const [workAge, setWorkAge] = useState(saved.workAge ?? 22)
  const [retireAge, setRetireAge] = useState(saved.retireAge ?? 60)
  const [endAge, setEndAge] = useState(saved.endAge ?? 80)
  const [startingSalary, setStartingSalary] = useState(saved.startingSalary ?? profile?.monthlySalary ?? 8_000)
  const [salaryGrowth, setSalaryGrowth] = useState(saved.salaryGrowth ?? 4)
  const [annualSpend, setAnnualSpend] = useState(saved.annualSpend ?? profileSpend)
  const [spendGrowth, setSpendGrowth] = useState(saved.spendGrowth ?? 2.5)
  const [inflation, setInflation] = useState(saved.inflation ?? 2)
  const [houseAge, setHouseAge] = useState(saved.houseAge ?? 32)
  const [housePrice, setHousePrice] = useState(saved.housePrice ?? 2_000_000)
  const [carInterval, setCarInterval] = useState(saved.carInterval ?? 10)
  const [carPrice, setCarPrice] = useState(saved.carPrice ?? 150_000)

  useEffect(() => {
    try { sessionStorage.setItem('taxlens.lifecycle.v1', JSON.stringify({ workAge, retireAge, endAge, startingSalary, salaryGrowth, annualSpend, spendGrowth, inflation, houseAge, housePrice, carInterval, carPrice })) } catch { /* session draft is optional */ }
  }, [annualSpend, carInterval, carPrice, endAge, houseAge, housePrice, inflation, retireAge, salaryGrowth, spendGrowth, startingSalary, workAge])

  const syncFromProfile = () => {
    if (!profile) return
    setStartingSalary(profile.monthlySalary)
    setAnnualSpend(profileSpend)
  }
  const useStartingYear = () => {
    if (!profile || !onUseScenario) return
    const currentMonthlySpend = Object.values(profile.expenses).reduce((sum, value) => sum + value, 0)
    const targetMonthlySpend = annualSpend / 12
    const expenses = currentMonthlySpend > 0
      ? Object.fromEntries(Object.entries(profile.expenses).map(([key, value]) => [key, value * targetMonthlySpend / currentMonthlySpend])) as CalculatorProfile['expenses']
      : { ...profile.expenses, other: targetMonthlySpend }
    onUseScenario({ ...profile, monthlySalary: startingSalary, socialInsuranceBase: startingSalary, housingFundBase: startingSalary, expenses }, '用一生推演的起始年度替换模型')
  }

  const model = useMemo(() => {
    const years: LifeYear[] = []
    const safeEnd = Math.max(workAge, endAge)
    const safeRetire = Math.max(workAge, Math.min(retireAge, safeEnd))
    for (let age = workAge; age <= safeEnd; age += 1) {
      const n = age - workAge
      const income = age < safeRetire ? startingSalary * 12 * Math.pow(1 + salaryGrowth / 100, n) : 0
      const social = income * .105
      const tax = annualIncomeTax(income - social - 60_000)
      const spend = annualSpend * Math.pow(1 + spendGrowth / 100, n)
      const embedded = spend * embeddedRate
      const buysHouse = age === houseAge
      const buysCar = age >= Math.max(workAge, 28) && carInterval > 0 && (age - Math.max(workAge, 28)) % carInterval === 0 && age < safeRetire
      const assetTax = (buysHouse ? housePrice * .01 : 0) + (buysCar ? (carPrice / 1.13 * .1 + carPrice * 13 / 113) : 0)
      const realFactor = Math.pow(1 + inflation / 100, n)
      years.push({ age, income, tax, social, embedded, assetTax, realFactor })
    }
    const sum = (key: keyof Pick<LifeYear, 'income' | 'tax' | 'social' | 'embedded' | 'assetTax'>, real = false) => years.reduce((total, year) => total + Number(year[key]) / (real ? year.realFactor : 1), 0)
    return {
      years,
      nominal: { income: sum('income'), tax: sum('tax'), social: sum('social'), embedded: sum('embedded'), assetTax: sum('assetTax') },
      real: { income: sum('income', true), tax: sum('tax', true), social: sum('social', true), embedded: sum('embedded', true), assetTax: sum('assetTax', true) }
    }
  }, [annualSpend, carInterval, carPrice, embeddedRate, endAge, houseAge, housePrice, inflation, retireAge, salaryGrowth, spendGrowth, startingSalary, workAge])

  const decades = useMemo(() => {
    const groups = new Map<number, LifeYear[]>()
    model.years.forEach((year) => { const decade = Math.floor(year.age / 10) * 10; groups.set(decade, [...(groups.get(decade) ?? []), year]) })
    return Array.from(groups, ([decade, years]) => ({ decade, tax: years.reduce((sum, y) => sum + y.tax + y.embedded + y.assetTax, 0), social: years.reduce((sum, y) => sum + y.social, 0) }))
  }, [model.years])
  const maxDecade = Math.max(...decades.map((item) => item.tax + item.social), 1)
  const nominalTax = model.nominal.tax + model.nominal.embedded + model.nominal.assetTax
  const realTax = model.real.tax + model.real.embedded + model.real.assetTax

  return (
    <div className="life-page">
      <PageIntro
        stage={{ index: '03', label: '推演对比' }}
        title="把一年拉长成一生。"
        lead="工资、消费、住房和汽车在时间里增长；同时用 2026 年实际购买力重算，避免几十年后的名义金额制造错觉。"
        aside={<div className="life-main-number"><span>一生可识别税费</span><strong><Approx>{money(nominalTax)}</Approx></strong><small>2026 年购买力：{money(realTax)}</small><ConfidenceMark level="model" /></div>}
      ><div className="scenario-sync-row">{profile && <button className="text-button" onClick={syncFromProfile}>从我的年度重新同步</button>}{profile && onUseScenario && <button className="primary-button" onClick={useStartingYear}>用起始年度替换我的模型</button>}</div></PageIntro>

      <section className="life-workbench">
        <aside className="life-controls">
          <div className="life-control-group"><h2>时间</h2><RangeField label="开始工作" value={workAge} setValue={setWorkAge} min={18} max={45} suffix="岁" /><RangeField label="退休年龄" value={retireAge} setValue={setRetireAge} min={45} max={75} suffix="岁" /><RangeField label="模拟至" value={endAge} setValue={setEndAge} min={60} max={100} suffix="岁" /></div>
          <div className="life-control-group"><h2>收入与消费</h2><RangeField label="起始月薪" value={startingSalary} setValue={setStartingSalary} min={3000} max={50000} step={1000} suffix="元" /><RangeField label="工资年增长" value={salaryGrowth} setValue={setSalaryGrowth} min={0} max={10} step={.5} suffix="%" /><RangeField label="起始年消费" value={annualSpend} setValue={setAnnualSpend} min={12000} max={300000} step={6000} suffix="元" /><RangeField label="消费年增长" value={spendGrowth} setValue={setSpendGrowth} min={0} max={8} step={.5} suffix="%" /><RangeField label="通货膨胀" value={inflation} setValue={setInflation} min={0} max={8} step={.5} suffix="%" /></div>
          <details className="life-control-group"><summary>资产事件</summary><RangeField label="买房年龄" value={houseAge} setValue={setHouseAge} min={20} max={70} suffix="岁" /><RangeField label="住房价格" value={housePrice} setValue={setHousePrice} min={0} max={10000000} step={100000} suffix="元" /><RangeField label="换车周期" value={carInterval} setValue={setCarInterval} min={0} max={25} suffix="年" /><RangeField label="单车价格" value={carPrice} setValue={setCarPrice} min={0} max={1000000} step={10000} suffix="元" /></details>
        </aside>

        <div className="life-results">
          <div className="life-totals">
            <LifeMetric label="一生劳动收入" nominal={model.nominal.income} real={model.real.income} />
            <LifeMetric label="个人所得税" nominal={model.nominal.tax} real={model.real.tax} tax />
            <LifeMetric label="个人社会缴费" nominal={model.nominal.social} real={model.real.social} social />
            <LifeMetric label="消费内含税" nominal={model.nominal.embedded} real={model.real.embedded} tax estimate />
            <LifeMetric label="房车交易税费" nominal={model.nominal.assetTax} real={model.real.assetTax} tax estimate />
          </div>
          <div className="life-chart-head"><div><span className="kicker">十年一格</span><h2>税费如何穿过人生</h2></div><div><i className="tax-key" />可识别税费 <i className="social-key" />社会缴费</div></div>
          <div className="life-chart">
            {decades.map((item) => <div className="life-decade" key={item.decade}><div className="life-bar-stack"><i className="life-bar-tax" style={{ height: `${item.tax / maxDecade * 100}%` }} /><i className="life-bar-social" style={{ height: `${item.social / maxDecade * 100}%` }} /></div><span>{item.decade}s</span></div>)}
          </div>
          <div className="life-method"><b>模型说明</b><p>这是一条固定税制情景路径，不是对未来政策的预测。个税全程使用当前综合所得税率；社保按收入的 10.5% 简化，未应用缴费基数上下限；消费内含税率来自你当前年度消费篮子。资产价格作为发生当年的名义金额输入。</p></div>
        </div>
      </section>
    </div>
  )
}

function RangeField({ label, value, setValue, min, max, step = 1, suffix }: { label: string; value: number; setValue: (value: number) => void; min: number; max: number; step?: number; suffix: string }) {
  return <label className="range-field"><div><span>{label}</span><b>{new Intl.NumberFormat('zh-CN').format(value)} {suffix}</b></div><input type="range" value={value} onChange={(event) => setValue(Number(event.target.value))} min={min} max={max} step={step} /></label>
}

function LifeMetric({ label, nominal, real, tax, social, estimate }: { label: string; nominal: number; real: number; tax?: boolean; social?: boolean; estimate?: boolean }) {
  return <div className={`life-metric ${tax ? 'is-tax' : ''} ${social ? 'is-social' : ''}`}><span>{label}</span><strong>{estimate && <Approx />}{money(nominal)}</strong><small>2026 年购买力 {money(real)}</small></div>
}
