import { useMemo, useState } from 'react'
import { money } from '../lib/calculations'
import { ConfidenceMark } from './Marks'

type HoldPeriod = 'short' | 'middle' | 'long'

export function InvestmentPage() {
  const [dividend, setDividend] = useState(10_000)
  const [holdPeriod, setHoldPeriod] = useState<HoldPeriod>('middle')
  const [gain, setGain] = useState(50_000)
  const [restricted, setRestricted] = useState(false)
  const dividendRate = holdPeriod === 'short' ? .2 : holdPeriod === 'middle' ? .1 : 0
  const result = useMemo(() => ({ dividendTax: dividend * dividendRate, gainTax: restricted ? gain * .2 : 0 }), [dividend, dividendRate, gain, restricted])

  return (
    <div className="investment-page">
      <header className="page-intro"><span className="kicker">投资税费</span><h1>投资收益，不只有一个“20%”。</h1><p>股息红利的实际税负取决于持股期限；股票转让还要区分普通流通股与限售股等情形。</p></header>
      <section className="investment-grid">
        <article className="investment-module">
          <div className="investment-title"><div><span>01</span><h2>上市公司股息红利</h2></div><ConfidenceMark level="high" /></div>
          <label className="invest-amount"><span>取得股息红利</span><div><b>¥</b><input type="number" min="0" value={dividend} onChange={(event) => setDividend(Math.max(0, Number(event.target.value) || 0))} /></div></label>
          <div className="hold-options"><button className={holdPeriod === 'short' ? 'is-active' : ''} onClick={() => setHoldPeriod('short')}><b>≤ 1 个月</b><span>实际税负 20%</span></button><button className={holdPeriod === 'middle' ? 'is-active' : ''} onClick={() => setHoldPeriod('middle')}><b>1 个月—1 年</b><span>实际税负 10%</span></button><button className={holdPeriod === 'long' ? 'is-active' : ''} onClick={() => setHoldPeriod('long')}><b>&gt; 1 年</b><span>暂免征收</span></button></div>
          <div className="investment-answer"><span>股息红利个人所得税</span><strong>{money(result.dividendTax)}</strong><code>{money(dividend)} × {(dividendRate * 100).toFixed(0)}%</code></div>
          <p className="investment-note">持股 1 年以内时，上市公司派息时暂不扣缴；待转让股票后按持股期限计算并扣收。</p>
        </article>
        <article className="investment-module">
          <div className="investment-title"><div><span>02</span><h2>股票转让所得</h2></div><ConfidenceMark level={restricted ? 'model' : 'high'} /></div>
          <label className="invest-amount"><span>股票转让收益</span><div><b>¥</b><input type="number" min="0" value={gain} onChange={(event) => setGain(Math.max(0, Number(event.target.value) || 0))} /></div></label>
          <label className="restricted-check"><input type="checkbox" checked={restricted} onChange={(event) => setRestricted(event.target.checked)} /><span><b>属于上市公司限售股</b><small>限售股原值、合理税费和具体扣缴规则需按资料确认</small></span></label>
          <div className="investment-answer"><span>财产转让个人所得税</span><strong>{restricted ? `≈ ${money(result.gainTax)}` : money(0)}</strong><code>{restricted ? '收益简化估算 × 20%' : '普通上市公司流通股转让所得暂免'}</code></div>
          <p className="investment-note">此处仅处理境内上市公司股票的常见情形。基金、债券、境外证券、非上市股权及员工股权激励不应套用本结果。</p>
        </article>
      </section>
      <section className="investment-boundary"><span>投资回报</span><h2>税率不是收益率的一部分装饰。</h2><p>投资税务取决于资产类型、账户、持有时间和交易身份。无法从“赚了多少钱”单独判断的项目，必须继续询问条件。</p></section>
    </div>
  )
}
