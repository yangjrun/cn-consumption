import { useMemo, useState } from 'react'
import { money, surchargeRateForTier, vatFromGross, vatOnConsumptionTax } from '../lib/calculations'
import { eventId, fingerprintFor } from '../lib/annualModel'
import type { AnnualEvent, CityTier, ExpenseKey, ModelApplication } from '../types'
import { Approx, ConfidenceMark } from './Marks'
import { PageIntro } from './PageShell'

type Scene = 'coffee' | 'phone' | 'fuel' | 'car'

const scenes: Array<{ id: Scene; label: string; defaultAmount: number; description: string }> = [
  { id: 'coffee', label: '一杯咖啡', defaultAmount: 25, description: '餐饮服务' },
  { id: 'phone', label: '一台手机', defaultAmount: 5999, description: '一般货物' },
  { id: 'fuel', label: '一次加油', defaultAmount: 300, description: '成品油' },
  { id: 'car', label: '购买汽车', defaultAmount: 150000, description: '车辆购置' }
]

/** 城建税按纳税人所在地适用 7% / 5% / 1%，附加税费合计 12% / 10% / 6%。 */
const cityTierLabel = (tier: CityTier) =>
  tier === 'county' ? '县城和镇' : tier === 'other' ? '其他地区' : '市区'

export function BreakdownLab({ cityTier = 'urban', onApply }: { cityTier?: CityTier; onApply?: (application: ModelApplication) => void }) {
  const [scene, setScene] = useState<Scene>('coffee')
  const [amounts, setAmounts] = useState<Record<Scene, number>>({ coffee: 25, phone: 5999, fuel: 300, car: 150000 })
  const [fuelPrice, setFuelPrice] = useState(8.1)
  const [energyType, setEnergyType] = useState<'fuel' | 'nev'>('fuel')
  const [applyMode, setApplyMode] = useState<'once' | 'monthly'>('once')
  const [applyMonth, setApplyMonth] = useState(1)
  const selected = scenes.find((item) => item.id === scene)!
  const amount = amounts[scene]

  const result = useMemo(() => {
    const vatRate = scene === 'coffee' ? 0.06 : 0.13
    const vat = vatFromGross(amount, vatRate)
    let consumption = 0
    let purchaseTax = 0
    let confidence: 'high' | 'model' = 'high'
    let note = '按法定税率对消费者输入的含税价格作理论价税拆分。'

    if (scene === 'fuel') {
      const liters = fuelPrice > 0 ? amount / fuelPrice : 0
      consumption = liters * 1.52
      confidence = 'model'
      note = `按 ${fuelPrice.toFixed(2)} 元／升推算约 ${liters.toFixed(1)} 升，再按 1.52 元／升识别生产／进口环节消费税。`
    }

    if (scene === 'car') {
      const base = amount / 1.13
      const fullTax = base * 0.1
      if (energyType === 'nev') {
        const reduction = Math.min(fullTax * 0.5, 15_000)
        purchaseTax = fullTax - reduction
        note = '按 2026—2027 年符合条件的新能源乘用车政策：车辆购置税减半，单车减税额不超过 1.5 万元。'
      } else {
        purchaseTax = fullTax
        note = '按不含增值税计税价格与 10% 法定税率估算车辆购置税；未计入按排量在生产环节征收的小汽车消费税。'
      }
      confidence = 'model'
    }

    // 税上税两条通道：① 增值税中对消费税征收的部分；② 以（增值税+消费税）为基数的附加税费
    const surchargeRate = surchargeRateForTier(cityTier)
    const surcharge = (vat + consumption) * surchargeRate
    const taxOnTax = vatOnConsumptionTax(consumption, vatRate) + surcharge

    return {
      vat,
      consumption,
      purchaseTax,
      surcharge,
      taxOnTax,
      surchargeRate,
      total: vat + consumption + purchaseTax,
      value: Math.max(0, amount - vat - consumption),
      confidence,
      note,
      vatRate
    }
  }, [amount, cityTier, energyType, fuelPrice, scene])

  const applyToModel = () => {
    if (!onApply) return
    const category: Record<Scene, ExpenseKey> = { coffee: 'dining', phone: 'electronics', fuel: 'fuel', car: 'car' }
    const effectiveApplyMode = scene === 'car' ? 'once' : applyMode
    const payload = { source: 'transaction', scene, amount, fuelPrice, energyType, applyMode: effectiveApplyMode, ...(effectiveApplyMode === 'once' ? { applyMonth } : {}) }
    const fingerprint = fingerprintFor(payload)
    let events: AnnualEvent[] | undefined
    let recurringExpenseDelta: Partial<Record<ExpenseKey, number>> | undefined
    if (scene === 'car') {
      events = [{
        id: eventId('vehicle', fingerprint), fingerprint, applicationFingerprint: fingerprint, type: 'vehicle', month: applyMonth,
        title: `${energyType === 'nev' ? '新能源' : '燃油'}汽车购买`, confidence: 'high',
        price: amount, energy: energyType, engine: 1.5, imported: false
      }]
    } else if (applyMode === 'monthly') {
      recurringExpenseDelta = { [category[scene]]: amount }
    } else {
      events = [{
        id: eventId('consumption', fingerprint), fingerprint, applicationFingerprint: fingerprint, type: 'consumption', month: applyMonth,
        title: selected.label, confidence: result.confidence, category: category[scene], amount,
        ...(scene === 'fuel' ? { fuelPrice } : {})
      }]
    }
    onApply({
      fingerprint,
      title: `加入${selected.label}`,
      description: scene === 'car' ? `作为 ${applyMonth} 月的一次性购车事件。` : applyMode === 'monthly' ? '作为固定月度消费，每月重复计入。' : `仅计入 ${applyMonth} 月，不推断重复频率。`,
      events,
      recurringExpenseDelta,
      profilePatch: scene === 'fuel' ? { fuelPrice } : undefined
    })
  }

  return (
    <div className="lab-page">
      <PageIntro
        stage={{ index: '02', label: '场景拆解' }}
        title="一笔钱，沿着价格往回看。"
        lead="选择日常消费，查看能够从含税价格中理论识别的税收因素。不能从零售价严谨反推的部分，不强行相加。"
      />

      <div className="scene-tabs" role="tablist" aria-label="消费场景">
        {scenes.map((item) => (
          <button key={item.id} className={scene === item.id ? 'is-active' : ''} onClick={() => setScene(item.id)} role="tab" aria-selected={scene === item.id}>
            <span>{item.label}</span><small>{item.description}</small>
          </button>
        ))}
      </div>

      <section className="breakdown-workbench">
        <div className="transaction-editor">
          <div className="transaction-title"><span>{selected.label}</span><ConfidenceMark level={result.confidence} /></div>
          <label className="giant-input">
            <span>你实际支付</span>
            <div><b>¥</b><input aria-label="实际支付金额" type="number" min="0" step="1" value={amount} onChange={(event) => setAmounts({ ...amounts, [scene]: Math.max(0, Number(event.target.value) || 0) })} /></div>
          </label>

          {scene === 'fuel' && (
            <label className="workbench-field"><span>当前油价</span><div><input type="number" min="1" step="0.01" value={fuelPrice} onChange={(event) => setFuelPrice(Math.max(0, Number(event.target.value) || 0))} /><b>元／升</b></div></label>
          )}
          {scene === 'car' && (
            <div className="segmented-control segmented-control--wide">
              <button className={energyType === 'fuel' ? 'is-active' : ''} onClick={() => setEnergyType('fuel')}>燃油车</button>
              <button className={energyType === 'nev' ? 'is-active' : ''} onClick={() => setEnergyType('nev')}>新能源车</button>
            </div>
          )}

          <div className="formula-card">
            <span>当前使用公式</span>
            <code>VAT = P × {(result.vatRate * 100).toFixed(0)} ÷ {(100 + result.vatRate * 100).toFixed(0)}</code>
            <p>{result.note}</p>
          </div>
        </div>

        <div className="receipt">
          <div className="receipt__head"><span>理论拆解</span><b>{selected.description}</b></div>
          <div className="receipt__total"><span>你支付</span><strong>{money(amount, 2)}</strong></div>
          <div className="receipt__rows">
            <div><span><i className="swatch swatch--value" />不含流转税价值</span><strong><Approx>{money(result.value, 2)}</Approx></strong></div>
            <div><span><i className="swatch swatch--vat" />增值税价税部分</span><strong><Approx>{money(result.vat, 2)}</Approx></strong></div>
            {scene === 'fuel' && <div><span><i className="swatch swatch--consumption" />消费税法定税额</span><strong><Approx>{money(result.consumption, 2)}</Approx></strong></div>}
            {scene === 'car' && <div><span><i className="swatch swatch--purchase" />车辆购置税</span><strong><Approx>{money(result.purchaseTax, 2)}</Approx></strong></div>}
            {result.surcharge > 0 && <div><span><i className="swatch swatch--surcharge" />附加税费（税上税）</span><strong><Approx>{money(result.surcharge, 2)}</Approx></strong></div>}
          </div>
          <div className="receipt__identified"><span>可明确估计的税费</span><strong><Approx>{money(result.total, 2)}</Approx></strong><small>约占支付金额 {amount > 0 ? (result.total / amount * 100).toFixed(1) : '0.0'}%</small></div>
          {result.taxOnTax > 0 && (
            <div className="receipt__identified">
              <span>其中：税上税（重复征税）</span>
              <strong><Approx>{money(result.taxOnTax, 2)}</Approx></strong>
              <small>增值税中对消费税征收的部分，加按{cityTierLabel(cityTier)}口径（{(result.surchargeRate * 100).toFixed(0)}%）计算的附加税费</small>
            </div>
          )}
          <div className="receipt__disclaimer">附加税费以经营者实缴的增值税、消费税为计税依据，法定纳税人不是消费者，故单列展示、不计入上方可明确估计的税费。该金额也不是商家最终向政府缴纳的增值税，更不代表这些税在经济上全部由消费者承担。</div>
        </div>
      </section>

      {onApply && <section className="model-apply-bar"><div><span className="kicker">连接年度账本</span><h2>把这笔试算，明确放进一个时间位置。</h2><p>写入前会展示年度税费变化；相同条件不会重复计入。</p></div><div className="model-apply-controls">{scene !== 'car' && <label><span>计入方式</span><select value={applyMode} onChange={(event) => setApplyMode(event.target.value as 'once' | 'monthly')}><option value="once">仅一次</option><option value="monthly">每月重复一次</option></select></label>}{(scene === 'car' || applyMode === 'once') && <label><span>发生月份</span><select value={applyMonth} onChange={(event) => setApplyMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} 月</option>)}</select></label>}<button className="primary-button" onClick={applyToModel}>应用到我的年度</button></div></section>}

      <section className="logic-grid">
        <article><span>01</span><h2>先看法定纳税人</h2><p>增值税和消费税通常由经营主体申报缴纳；消费者支付含税价格，但不是每一项的法律纳税人。</p></article>
        <article><span>02</span><h2>再做价税拆分</h2><p>输入的是含税价，不能直接乘税率。¥100 的 13% 税率货物，对应价税部分约为 ¥11.50。</p></article>
        <article><span>03</span><h2>最后标明不确定性</h2><p>消费税是价内税、附加税费以流转税为基数，价格上叠加的不止一层税；而渠道利润、进项抵扣与税收转嫁无法由一张零售小票完全还原。</p></article>
      </section>
      <ExciseExplorer />
    </div>
  )
}

function ExciseExplorer() {
  const [kind, setKind] = useState<'liquor' | 'cigarette'>('liquor')
  const [price, setPrice] = useState(500)
  const [quantity, setQuantity] = useState(500)
  const fixed = kind === 'liquor' ? quantity / 500 * .5 : quantity * .005
  return (
    <section className="excise-explorer">
      <div className="excise-heading"><div><span className="kicker">消费税图鉴</span><h2>有税率，不等于能从零售价反推。</h2></div><p>从价部分需要生产、批发或进口环节的计税销售额。消费者只输入零售价时，模型保留“无法确定”。</p></div>
      <div className="excise-workbench">
        <div className="excise-controls">
          <div className="segmented-control"><button className={kind === 'liquor' ? 'is-active' : ''} onClick={() => { setKind('liquor'); setPrice(500); setQuantity(500) }}>白酒</button><button className={kind === 'cigarette' ? 'is-active' : ''} onClick={() => { setKind('cigarette'); setPrice(100); setQuantity(200) }}>卷烟</button></div>
          <label><span>消费者零售支付</span><div><b>¥</b><input type="number" min="0" value={price} onChange={(event) => setPrice(Math.max(0, Number(event.target.value) || 0))} /></div></label>
          <label><span>{kind === 'liquor' ? '容量' : '支数'}</span><div><input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))} /><b>{kind === 'liquor' ? '毫升' : '支'}</b></div></label>
        </div>
        <div className="excise-result">
          <div><span>法定计税方式</span><strong>{kind === 'liquor' ? '20% + ¥0.5／500ml' : '批发 11% + ¥0.005／支'}</strong><small>{kind === 'liquor' ? '生产／进口环节' : '商业批发环节；另有生产环节消费税'}</small></div>
          <div><span>可从数量识别的定额部分</span><strong><Approx>{money(fixed, 2)}</Approx></strong><small>{kind === 'liquor' ? `${quantity}ml ÷ 500ml × ¥0.5` : `${quantity} 支 × ¥0.005`}</small></div>
          <div className="is-unknown"><span>从价消费税</span><strong>? 无法确定</strong><small>零售价 {money(price)} 不是该环节法定计税销售额</small></div>
        </div>
      </div>
    </section>
  )
}
