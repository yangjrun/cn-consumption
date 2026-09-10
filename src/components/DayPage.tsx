import { useMemo, useState } from 'react'
import { money, vatFromGross } from '../lib/calculations'
import { Approx, ConfidenceMark } from './Marks'
import type { Confidence } from '../types'

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

export function DayPage() {
  const [items, setItems] = useState(initialDay)
  const [fuelPrice, setFuelPrice] = useState(8.1)
  const [active, setActive] = useState('fuel')
  const enriched = useMemo(() => items.map((item) => {
    const vat = vatFromGross(item.amount, item.vatRate)
    const excise = item.fuel && fuelPrice > 0 ? item.amount / fuelPrice * 1.52 : 0
    return { ...item, vat, excise, tax: vat + excise }
  }), [fuelPrice, items])
  const spend = enriched.reduce((sum, item) => sum + item.amount, 0)
  const tax = enriched.reduce((sum, item) => sum + item.tax, 0)
  const selected = enriched.find((item) => item.id === active) ?? enriched[0]

  const updateAmount = (id: string, amount: number) => setItems(items.map((item) => item.id === id ? { ...item, amount } : item))

  return (
    <div className="day-page">
      <header className="day-hero">
        <div><span className="kicker">07:30 — 22:00</span><h1>普通中国人的一天，<br />什么时候在交税？</h1></div>
        <div className="day-total"><span>今天消费</span><strong>{money(spend)}</strong><span>可识别价格内含税</span><b><Approx>{money(tax)}</Approx></b></div>
      </header>

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

      <section className="day-ending">
        <span>一天结束</span><h2>你没有收到六张税票。<br />但价格留下了可以识别的线索。</h2><p>今天的 <b>{money(spend)}</b> 消费中，约 <strong>{money(tax)}</strong> 是模型能够识别的税收因素。其余部分不强行归因。</p>
      </section>
    </div>
  )
}
