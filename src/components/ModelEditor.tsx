import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { expenseMeta } from '../data/expenseMeta'
import { money } from '../lib/calculations'
import type { AppModelV1, CalculatorProfile, ExpenseKey } from '../types'

interface ModelEditorProps {
  model: AppModelV1
  open: boolean
  onboarding?: boolean
  onSave: (model: AppModelV1) => void
  onClose: () => void
  onSkip?: () => void
}

const steps = [
  { label: '收入', hint: '逐月工资与全年奖金' },
  { label: '缴费', hint: '地区、扣除与缴费基数' },
  { label: '消费', hint: '固定月度消费篮子' }
]

const stepAdvice = [
  '工资有波动时再展开逐月录入；收入稳定时填写月均工资即可。',
  '缴费基数可能与工资不同，请优先参照工资单或社保缴费记录。',
  '只填写每月重复发生的支出，购房、购车等一次性项目可稍后添加。'
]

const cloneModel = (model: AppModelV1): AppModelV1 => JSON.parse(JSON.stringify(model)) as AppModelV1
const numeric = (value: string) => Math.max(0, Number(value) || 0)

function AmountInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const inputId = useId()

  return (
    <label className="model-field" htmlFor={inputId}>
      <span className="model-field__label"><span>{label}</span><output htmlFor={inputId}>{value > 0 ? money(value) : '未填写'}</output></span>
      <span className="model-money-input"><b aria-hidden="true">¥</b><input id={inputId} type="number" min="0" step="100" inputMode="decimal" value={value} aria-label={label} onChange={(event) => onChange(numeric(event.target.value))} /></span>
    </label>
  )
}

export function ModelEditor({ model, open, onboarding = false, onSave, onClose, onSkip }: ModelEditorProps) {
  const [draft, setDraft] = useState(() => cloneModel(model))
  const [step, setStep] = useState(0)
  const [showMonths, setShowMonths] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setDraft(cloneModel(model))
    setStep(0)
    setShowMonths(new Set(model.monthlyIncome.map((item) => item.salary)).size > 1)
  }, [model, open])

  useEffect(() => {
    if (!open || onboarding) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose, onboarding, open])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [step])

  const averageSalary = useMemo(
    () => draft.monthlyIncome.reduce((sum, item) => sum + item.salary, 0) / 12,
    [draft.monthlyIncome]
  )
  const monthlySpending = useMemo(
    () => Object.values(draft.profile.expenses).reduce((sum, item) => sum + item, 0),
    [draft.profile.expenses]
  )
  const currentStep = steps[step]

  if (!open) return null

  const patchProfile = <K extends keyof CalculatorProfile>(key: K, value: CalculatorProfile[K]) => {
    setDraft((current) => ({ ...current, profile: { ...current.profile, [key]: value } }))
  }
  const fillSalary = (salary: number) => {
    setDraft((current) => {
      const syncSocial = current.profile.socialInsuranceBase === current.profile.monthlySalary
      const syncFund = current.profile.housingFundBase === current.profile.monthlySalary
      return {
        ...current,
        profile: {
          ...current.profile,
          monthlySalary: salary,
          socialInsuranceBase: syncSocial ? salary : current.profile.socialInsuranceBase,
          housingFundBase: syncFund ? salary : current.profile.housingFundBase
        },
        monthlyIncome: current.monthlyIncome.map((item) => ({ ...item, salary }))
      }
    })
  }
  const patchMonth = (month: number, salary: number) => {
    setDraft((current) => {
      const monthlyIncome = current.monthlyIncome.map((item) => item.month === month ? { ...item, salary } : item)
      const monthlySalary = monthlyIncome.reduce((sum, item) => sum + item.salary, 0) / 12
      const syncSocial = current.profile.socialInsuranceBase === current.profile.monthlySalary
      const syncFund = current.profile.housingFundBase === current.profile.monthlySalary
      return {
        ...current,
        profile: {
          ...current.profile,
          monthlySalary,
          socialInsuranceBase: syncSocial ? monthlySalary : current.profile.socialInsuranceBase,
          housingFundBase: syncFund ? monthlySalary : current.profile.housingFundBase
        },
        monthlyIncome
      }
    })
  }
  const patchExpense = (key: ExpenseKey, value: number) => {
    setDraft((current) => ({
      ...current,
      profile: { ...current.profile, expenses: { ...current.profile.expenses, [key]: value } }
    }))
  }
  const finish = () => {
    onSave({ ...draft, status: 'personalized', updatedAt: new Date().toISOString() })
    onClose()
  }

  return (
    <div className={`model-editor-layer${onboarding ? ' is-onboarding' : ''}`}>
      <button className="model-editor-scrim" aria-label="关闭年度模型编辑" onClick={onboarding ? undefined : onClose} />
      <section className="model-editor" role="dialog" aria-modal="true" aria-labelledby="model-editor-title">
        <header className="model-editor__head">
          <div>
            <div className="model-editor__eyebrow">
              <span className="kicker">{onboarding ? '三步快速建模' : '我的年度模型'}</span>
              <span className="model-local-note"><i aria-hidden="true" />数据仅保存在当前浏览器</span>
            </div>
            <h1 id="model-editor-title">{onboarding ? '先把这一年，变成你的数据。' : '调整年度计算依据'}</h1>
            <p>{onboarding ? '用收入、缴费和日常消费建立你的年度账本；房车、投资等一次性事件可在完成后继续添加。' : '修改会先留在草稿中，保存后才更新所有页面和年度报告。'}</p>
          </div>
          {!onboarding && <button className="icon-button" onClick={onClose}>关闭</button>}
          <div className="model-editor__progress" aria-label={`当前第 ${step + 1} 步，共 ${steps.length} 步`}>
            <span>建模进度</span><b>{String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</b>
            <span className="model-progress-track" aria-hidden="true"><i style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></span>
          </div>
        </header>

        <div className="model-editor__workspace">
          <nav className="model-editor__rail" aria-label="建模步骤">
            <ol className="model-steps">
              {steps.map((item, index) => (
                <li key={item.label} className={index === step ? 'is-active' : index < step ? 'is-done' : ''}>
                  <button onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined} aria-label={`第 ${index + 1} 步：${item.label}，${item.hint}`}>
                    <b>0{index + 1}</b>
                    <span>{item.label}<small>{item.hint}</small></span>
                    <em>{index === step ? '当前' : index < step ? '完成' : '待填写'}</em>
                  </button>
                </li>
              ))}
            </ol>
            <aside className="model-step-advice">
              <span>填写建议</span>
              <p>{stepAdvice[step]}</p>
            </aside>
          </nav>

          <div ref={bodyRef} className="model-editor__body">
          {step === 0 && (
            <section className="model-step-panel">
              <div className="model-step-heading"><div><span>01 / 收入</span><h2>先录入工资的真实节奏</h2></div><p>默认一键填充全年，也可以逐月调整。税额会按累计预扣法重新计算。</p></div>
              <div className="model-form-grid model-form-grid--three">
                <AmountInput label="全年月均工资" value={Math.round(averageSalary)} onChange={fillSalary} />
                <AmountInput label="全年一次性奖金" value={draft.profile.annualBonus} onChange={(value) => patchProfile('annualBonus', value)} />
                <label className="model-field"><span>奖金发生月份</span><select value={draft.annualBonusMonth} onChange={(event) => setDraft({ ...draft, annualBonusMonth: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} 月</option>)}</select></label>
              </div>
              <div className="model-inline-row">
                <label className="model-field"><span>奖金计税方式</span><select value={draft.profile.annualBonusTaxMethod} onChange={(event) => patchProfile('annualBonusTaxMethod', event.target.value as CalculatorProfile['annualBonusTaxMethod'])}><option value="optimal">自动选择较低税额</option><option value="separate">单独计税</option><option value="comprehensive">并入综合所得</option></select></label>
                <button className="text-button" onClick={() => setShowMonths((value) => !value)}>{showMonths ? '收起逐月工资' : '编辑 12 个月工资'}</button>
              </div>
              {showMonths && <div className="monthly-income-section"><div><h3>逐月工资</h3><p>月均工资会随下列金额自动更新。</p></div><div className="monthly-income-grid">{draft.monthlyIncome.map((item) => <label key={item.month}><span>{item.month} 月</span><input type="number" min="0" step="100" inputMode="decimal" value={item.salary} aria-label={`${item.month} 月工资`} onChange={(event) => patchMonth(item.month, numeric(event.target.value))} /></label>)}</div></div>}
              <div className="model-step-summary"><span>全年工资与奖金</span><strong>{money(draft.monthlyIncome.reduce((sum, item) => sum + item.salary, 0) + draft.profile.annualBonus)}</strong></div>
            </section>
          )}

          {step === 1 && (
            <section className="model-step-panel">
              <div className="model-step-heading"><div><span>02 / 缴费</span><h2>让地区和扣除有明确依据</h2></div><p>上海可应用 2026 年上下半年社保基数范围；其他城市按你填写的基数计算。</p></div>
              <div className="model-form-grid model-form-grid--three">
                <label className="model-field"><span>城市</span><select value={draft.profile.city} onChange={(event) => patchProfile('city', event.target.value)}><option>上海</option><option>北京</option><option>深圳</option><option>广州</option><option>杭州</option><option>成都</option><option>其他城市</option></select></label>
                <label className="model-field"><span>计算年份</span><select value={draft.profile.year} onChange={(event) => patchProfile('year', Number(event.target.value))}><option value="2026">2026</option></select></label>
                <label className="model-field"><span>所在地档次</span><select value={draft.profile.cityTier} onChange={(event) => patchProfile('cityTier', event.target.value as CalculatorProfile['cityTier'])}><option value="urban">市区</option><option value="county">县城和镇</option><option value="other">其他地区</option></select></label>
                <AmountInput label="社保月缴费基数" value={draft.profile.socialInsuranceBase} onChange={(value) => patchProfile('socialInsuranceBase', value)} />
                <AmountInput label="公积金月缴存基数" value={draft.profile.housingFundBase} onChange={(value) => patchProfile('housingFundBase', value)} />
                <AmountInput label="每月专项附加扣除" value={draft.profile.specialDeductionMonthly} onChange={(value) => patchProfile('specialDeductionMonthly', value)} />
              </div>
              {draft.profile.city === '上海' && <label className="model-check"><input type="checkbox" checked={draft.profile.applyCitySocialBaseLimits} onChange={(event) => patchProfile('applyCitySocialBaseLimits', event.target.checked)} /><span><b>应用上海 2026 社保基数上下限</b><small>1—6 月与 7—12 月分别计算，并在月度图标出切换点。</small></span></label>}
              <div className="model-subsection-head"><div><span>个人缴费比例</span><small>如无特殊情况，可保留当前值</small></div></div>
              <div className="model-rate-grid">
                {([
                  ['pensionRate', '个人养老'], ['medicalRate', '个人医疗'], ['unemploymentRate', '个人失业'], ['housingFundRate', '个人公积金']
                ] as Array<[keyof CalculatorProfile, string]>).map(([key, label]) => <label key={key}><span>{label}</span><span><input type="number" min="0" max="50" step="0.1" value={Number(draft.profile[key]) * 100} onChange={(event) => patchProfile(key, numeric(event.target.value) / 100 as never)} /><b>%</b></span></label>)}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="model-step-panel">
              <div className="model-step-heading"><div><span>03 / 消费</span><h2>建立固定月度消费篮子</h2></div><p>只对能够建立税率映射的类别估算；一次性房车、投资和单笔消费将在场景页另行加入。</p></div>
              <div className="model-expense-note"><span>按月填写</span><p>没有的项目保留为 0；购车支出请在场景页按一次性事件录入。</p></div>
              <div className="model-expense-grid">{expenseMeta.map((item) => <AmountInput key={item.key} label={item.label} value={draft.profile.expenses[item.key]} onChange={(value) => patchExpense(item.key, value)} />)}</div>
              {draft.profile.expenses.fuel > 0 && <label className="model-field model-fuel-field"><span>汽油单价（元／升）</span><input type="number" min="1" step="0.01" value={draft.profile.fuelPrice} onChange={(event) => patchProfile('fuelPrice', numeric(event.target.value))} /></label>}
              <div className="model-step-summary"><span>固定月度消费</span><strong>{money(monthlySpending)}</strong><small>全年 {money(monthlySpending * 12)}</small></div>
              <div className="model-event-editor"><div><h3>已加入的年度事件</h3><span>{draft.events.length} 项 · 删除后对应税费会从总览和报告移除</span></div>{draft.events.length ? <div>{draft.events.map((event) => <article key={event.id}><span>{event.month} 月</span><div><b>{event.title}</b><small>{event.type === 'consumption' ? '一次性消费' : event.type === 'housing' ? '住房交易' : event.type === 'vehicle' ? '车辆购买' : '投资收入'}</small></div><button className="text-button" onClick={() => setDraft((current) => ({ ...current, events: current.events.filter((item) => item.id !== event.id), appliedFingerprints: current.appliedFingerprints.filter((item) => item !== (event.applicationFingerprint ?? event.fingerprint)) }))}>移除</button></article>)}</div> : <p>尚未加入一次性事件。保存模型后，可从“场景试算”添加。</p>}</div>
            </section>
          )}
          </div>
        </div>

        <footer className="model-editor__footer">
          <div className="model-editor__footer-context">
            <span>第 {step + 1} 步，共 {steps.length} 步</span>
            <strong>{currentStep.label}</strong>
          </div>
          <div className="model-editor__footer-actions">
            {onboarding && onSkip && <button className="text-button model-skip-button" onClick={onSkip}>先使用示例数据</button>}
            {step > 0 && <button className="text-button" onClick={() => setStep((value) => value - 1)}>上一步</button>}
            {step < 2 ? <button className="primary-button" onClick={() => setStep((value) => value + 1)}>下一步</button> : <button className="primary-button" onClick={finish}>{onboarding ? '生成我的年度结果' : '保存并重新计算'}</button>}
          </div>
        </footer>
      </section>
    </div>
  )
}
