import { useMemo, useState } from 'react'
import { money, vatFromGross } from '../lib/calculations'
import { Approx, ConfidenceMark } from './Marks'

type AssetTab = 'housing' | 'vehicle'
type HomeCount = 'first' | 'second' | 'other'

const NumberField = ({ label, value, onChange, suffix = '元', step = 1 }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: number }) => (
  <label className="asset-field"><span>{label}</span><div><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} /><b>{suffix}</b></div></label>
)

export function AssetsLab() {
  const [tab, setTab] = useState<AssetTab>('housing')
  const [homePrice, setHomePrice] = useState(3_000_000)
  const [homeArea, setHomeArea] = useState(90)
  const [homeCount, setHomeCount] = useState<HomeCount>('first')
  const [holdingYears, setHoldingYears] = useState(3)
  const [resale, setResale] = useState(false)
  const [carPrice, setCarPrice] = useState(150_000)
  const [engine, setEngine] = useState(1.5)
  const [energy, setEnergy] = useState<'fuel' | 'nev'>('fuel')
  const [imported, setImported] = useState(false)

  const home = useMemo(() => {
    const rate = homeCount === 'other' ? 0.03 : homeArea <= 140 ? 0.01 : homeCount === 'first' ? 0.015 : 0.02
    const deed = homePrice * rate
    const sellerVat = resale && holdingYears < 2 ? homePrice * 0.03 : 0
    return { rate, deed, sellerVat }
  }, [holdingYears, homeArea, homeCount, homePrice, resale])

  const car = useMemo(() => {
    const vat = vatFromGross(carPrice, 0.13)
    const taxBase = carPrice - vat
    const statutoryPurchaseTax = taxBase * 0.1
    const purchaseTax = energy === 'nev'
      ? statutoryPurchaseTax - Math.min(statutoryPurchaseTax * 0.5, 15_000)
      : statutoryPurchaseTax
    const displacementRate = engine <= 1 ? 0.01 : engine <= 1.5 ? 0.03 : engine <= 2 ? 0.05 : engine <= 2.5 ? 0.09 : engine <= 3 ? 0.12 : engine <= 4 ? 0.25 : 0.4
    return { vat, taxBase, statutoryPurchaseTax, purchaseTax, displacementRate }
  }, [carPrice, energy, engine])

  return (
    <div className="assets-page">
      <header className="page-intro assets-intro">
        <span className="kicker">资产交易实验室</span>
        <h1>房和车，税基比税率更重要。</h1>
        <p>买方直接缴纳的税与卖方、生产企业承担的税分开显示。土地出让收入和企业端税费不并入个人税负。</p>
      </header>

      <div className="asset-tabs">
        <button className={tab === 'housing' ? 'is-active' : ''} onClick={() => setTab('housing')}><span>住房</span><small>契税与交易观察</small></button>
        <button className={tab === 'vehicle' ? 'is-active' : ''} onClick={() => setTab('vehicle')}><span>汽车</span><small>购置税与价税拆分</small></button>
      </div>

      {tab === 'housing' ? (
        <section className="asset-calculator">
          <div className="asset-inputs">
            <div className="asset-section-heading"><span>01</span><h2>购房条件</h2></div>
            <NumberField label="合同成交价格" value={homePrice} onChange={setHomePrice} step={10_000} />
            <NumberField label="建筑面积" value={homeArea} onChange={setHomeArea} suffix="㎡" />
            <label className="asset-field"><span>家庭住房套数口径</span><select value={homeCount} onChange={(event) => setHomeCount(event.target.value as HomeCount)}><option value="first">家庭唯一住房</option><option value="second">家庭第二套住房</option><option value="other">其他住房（示例按 3%）</option></select></label>
            <label className="check-line"><input type="checkbox" checked={resale} onChange={(event) => setResale(event.target.checked)} /><span>这是二手房，同时观察卖方增值税</span></label>
            {resale && <NumberField label="卖方购房后持有年数" value={holdingYears} onChange={setHoldingYears} suffix="年" step={0.5} />}
          </div>

          <div className="asset-result">
            <div className="asset-result__top"><span>买方可确定直接税</span><ConfidenceMark level={homeCount === 'other' ? 'model' : 'high'} /></div>
            <strong>{homeCount === 'other' && <Approx />}{money(home.deed)}</strong>
            <div className="asset-result__equation"><span>契税</span><code>{money(homePrice)} × {(home.rate * 100).toFixed(1)}%</code><b>{money(home.deed)}</b></div>
            <div className="asset-result__line"><span>合同成交价格</span><b>{money(homePrice)}</b></div>
            <div className="asset-result__line"><span>契税占购房支出</span><b>{(home.rate * 100).toFixed(1)}%</b></div>
            {resale && (
              <div className="seller-observation">
                <div><span>卖方税务观察</span><ConfidenceMark level="high" /></div>
                <p>{holdingYears < 2 ? <>持有不足 2 年，卖方按 3% 征收率计算的增值税约为 <b>{money(home.sellerVat)}</b>。</> : <>持有满 2 年，按 2026 年规则免征个人销售住房增值税。</>}</p>
                <small>这是卖方的法定义务，不自动算入买方直接税。价格如何反映该成本属于税收归宿问题。</small>
              </div>
            )}
            <div className="asset-caveat"><b>土地财政观察</b><p>土地出让收入可能影响住房供给与价格，但土地出让金不是税，本计算器不把它加入个人税费。</p></div>
          </div>
        </section>
      ) : (
        <section className="asset-calculator">
          <div className="asset-inputs">
            <div className="asset-section-heading"><span>02</span><h2>车辆条件</h2></div>
            <NumberField label="含增值税购车价" value={carPrice} onChange={setCarPrice} step={5_000} />
            <div className="segmented-control asset-segment"><button className={energy === 'fuel' ? 'is-active' : ''} onClick={() => setEnergy('fuel')}>燃油车</button><button className={energy === 'nev' ? 'is-active' : ''} onClick={() => setEnergy('nev')}>新能源车</button></div>
            {energy === 'fuel' && <NumberField label="排量" value={engine} onChange={setEngine} suffix="升" step={0.1} />}
            <label className="check-line"><input type="checkbox" checked={imported} onChange={(event) => setImported(event.target.checked)} /><span>进口车辆</span></label>
          </div>

          <div className="asset-result">
            <div className="asset-result__top"><span>购车环节可识别税费</span><ConfidenceMark level="high" /></div>
            <strong>{money(car.vat + car.purchaseTax)}</strong>
            <div className="asset-result__equation"><span>价格内含增值税</span><code>{money(carPrice)} × 13 ÷ 113</code><b><Approx>{money(car.vat)}</Approx></b></div>
            <div className="asset-result__equation"><span>车辆购置税</span><code>{money(car.taxBase)} × {energy === 'nev' ? '优惠后税额' : '10%'}</code><b>{money(car.purchaseTax)}</b></div>
            {energy === 'nev' ? <p className="result-policy">2026—2027 年，符合条件的新能源乘用车车辆购置税减半，单车减税额不超过 1.5 万元。本车模型法定税额为 {money(car.statutoryPurchaseTax)}。</p> : <p className="result-policy">该排量对应生产／进口环节小汽车消费税法定税率档位为 {(car.displacementRate * 100).toFixed(0)}%。由于厂家计税价格无法由零售价准确反推，本项不计入上方金额。</p>}
            {imported && <div className="asset-caveat"><b>进口环节：无法从零售价直接确定</b><p>关税完税价格、关税和进口消费税会影响税基；进口增值税通常还涉及进项抵扣，不能与零售增值税机械叠加。</p></div>}
          </div>
        </section>
      )}
    </div>
  )
}
