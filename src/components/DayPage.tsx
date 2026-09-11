import { useMemo, useState } from 'react'
import { money, vatFromGross } from '../lib/calculations'
import { eventId, fingerprintFor } from '../lib/annualModel'
import { Approx, ConfidenceMark } from './Marks'
import { PageIntro } from './PageShell'
import type { AnnualEvent, Confidence, ExpenseKey, ModelApplication } from '../types'

interface DayItem {
  id: string
  time: string
  title: string
  detail: string
  amount: number
  vatRate: number
  confidence: Confidence
  fuel?: boolean
}

const initialDay: DayItem[] = [
  { id: 'breakfast', time: '07:30', title: '早餐', detail: '餐饮服务', amount: 10, vatRate: .06, confidence: 'high' },
  { id: 'metro', time: '08:00', title: '地铁', detail: '公共交通', amount: 3, vatRate: .09, confidence: 'model' },
  { id: 'lunch', time: '12:00', title: '午餐', detail: '餐饮服务', amount: 25, vatRate: .06, confidence: 'high' },
  { id: 'market', time: '18:30', title: '超市', detail: '食品与日用品组合', amount: 80, vatRate: .09, confidence: 'model' },
  { id: 'fuel', time: '20:00', title: '加油', detail: '92 号汽油', amount: 200, vatRate: .13, confidence: 'model', fuel: true },
  { id: 'phone', time: '22:00', title: '手机充值', detail: '电信服务组合', amount: 100, vatRate: .06, confidence: 'model' }
]

export function DayPage({ onApply }: { onApply?: (application: ModelApplication) => void }) {
  const [items, setItems] = useState(initialDay)
  const [fuelPrice, setFuelPrice] = useState(8.1)
  const [active, setActive] = useState('fuel')
  const [applyMode, setApplyMode] = useState<'once' | 'monthly'>('once')
  const [applyMonth, setApplyMonth] = useState(1)
  const enriched = useMemo(() => items.map((item) => {
    const vat = vatFromGross(item.amount, item.vatRate)
    const excise = item.fuel && fuelPrice > 0 ? item.amount / fuelPrice * 1.52 : 0
    return { ...item, vat, excise, tax: vat + excise }
  }), [fuelPrice, items])
  const spend = enriched.reduce((sum, item) => sum + item.amount, 0)
  const tax = enriched.reduce((sum, item) => sum + item.tax, 0)
  const selected = enriched.find((item) => item.id === active) ?? enriched[0]

  const updateAmount = (id: string, amount: number) => setItems(items.map((item) => item.id === id ? { ...item, amount } : item))
  const applyToModel = () => {
    if (!onApply) return
    const category: Record<string, ExpenseKey> = { breakfast: 'dining', metro: 'transport', lunch: 'dining', market: 'groceries', fuel: 'fuel', phone: 'telecom' }
    const fingerprint = fingerprintFor({ source: 'day', applyMode, ...(applyMode === 'once' ? { applyMonth } : {}), fuelPrice, items: enriched.map(({ id, amount }) => ({ id, amount })) })
    let events: AnnualEvent[] | undefined
    let recurringExpenseDelta: Partial<Record<ExpenseKey, number>> | undefined
    if (applyMode === 'monthly') {
      recurringExpenseDelta = enriched.reduce<Partial<Record<ExpenseKey, number>>>((total, item) => {
        const key = category[item.id]
        total[key] = (total[key] ?? 0) + item.amount
        return total
      }, {})
    } else {
      events = enriched.map((item) => {
        const itemFingerprint = fingerprintFor({ fingerprint, id: item.id })
        return {
          id: eventId('day', itemFingerprint), fingerprint: itemFingerprint, applicationFingerprint: fingerprint, type: 'consumption' as const,
          month: applyMonth, title: `一天 · ${item.title}`, confidence: item.confidence,
          category: category[item.id], amount: item.amount, ...(item.fuel ? { fuelPrice } : {})
        }
      })
    }
    onApply({
      fingerprint,
      title: '加入这一天的消费',
      description: applyMode === 'monthly' ? '将这组金额作为每月重复一次的固定消费；不推断更多出现频率。' : `将这组消费仅计入 ${applyMonth} 月一次。`,
      events,
      recurringExpenseDelta,
      profilePatch: { fuelPrice }
    })
  }

  return (
    <div className="day-page">
      <PageIntro
        stage={{ index: '02', label: '场景拆解' }}
        title={<>普通中国人的一天，<br />什么时候在交税？</>}
        lead="把一天的消费按时间排开，看每一笔支付里能够识别的税收因素。金额可以改，结论跟着变。"
        aside={<div className="day-total"><span>今天消费</span><strong>{money(spend)}</strong><span>可识别价格内含税</span><b><Approx>{money(tax)}</Approx></b></div>}
      />

      <section className="day-layout">
        <div className="day-timeline">
          {enriched.map((item) => (
            <button key={item.id} className={`day-event ${active === item.id ? 'is-active' : ''}`} onClick={() => setActive(item.id)}>
              <time>{item.time}</time><i /><div><span>{item.title}</span><small>{item.detail}</small></div><strong>{money(item.amount)}</strong><b><Approx>{money(item.tax, 2)}</Approx></b>
            </button>
          ))}
        </div>

        <aside className="day-inspector">
          <div className="day-inspector__head"><div><span>{selected.time}</span><h2>{selected.title}</h2></div><ConfidenceMark level={selected.confidence} /></div>
          <label className="day-amount"><span>实际支付</span><div><b>¥</b><input type="number" min="0" value={selected.amount} onChange={(event) => updateAmount(selected.id, Math.max(0, Number(event.target.value) || 0))} /></div></label>
          {selected.fuel && <label className="day-fuel-price"><span>油价</span><div><input type="number" min="1" step=".01" value={fuelPrice} onChange={(event) => setFuelPrice(Math.max(0, Number(event.target.value) || 0))} /><b>元／升</b></div></label>}
          <div className="day-breakdown">
            <div><span>不含已识别税费价值</span><b><Approx>{money(Math.max(0, selected.amount - selected.tax), 2)}</Approx></b></div>
            <div><span>增值税价税部分</span><b><Approx>{money(selected.vat, 2)}</Approx></b></div>
            {selected.fuel && <div><span>消费税法定税额</span><b><Approx>{money(selected.excise, 2)}</Approx></b></div>}
          </div>
          <p>{selected.fuel ? '消费税在生产／进口环节征收。此处用购买升数识别法定税额，但不表示消费者在法律上直接缴纳。' : `按 ${(selected.vatRate * 100).toFixed(0)}% 税率对含税价格作理论拆分；具体经营主体可能适用免税、简易计税或其他处理。`}</p>
        </aside>
      </section>

      {onApply && <section className="model-apply-bar"><div><span className="kicker">连接年度账本</span><h2>决定这一天是否重复。</h2><p>系统不会把“一天”擅自乘以 30；你需要明确选择一次性或每月重复一次。</p></div><div className="model-apply-controls"><label><span>计入方式</span><select value={applyMode} onChange={(event) => setApplyMode(event.target.value as 'once' | 'monthly')}><option value="once">仅一次</option><option value="monthly">每月重复一次</option></select></label>{applyMode === 'once' && <label><span>发生月份</span><select value={applyMonth} onChange={(event) => setApplyMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} 月</option>)}</select></label>}<button className="primary-button" onClick={applyToModel}>应用到我的年度</button></div></section>}

      <section className="day-ending">
        <span>一天结束</span><h2>你没有收到六张税票。<br />但价格留下了可以识别的线索。</h2><p>今天的 <b>{money(spend)}</b> 消费中，约 <strong>{money(tax)}</strong> 是模型能够识别的税收因素。其余部分不强行归因。</p>
      </section>
    </div>
  )
}
