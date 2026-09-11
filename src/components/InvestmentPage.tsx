import { useMemo, useState } from 'react'
import { money } from '../lib/calculations'
import { eventId, fingerprintFor } from '../lib/annualModel'
import type { ModelApplication } from '../types'
import { ConfidenceMark } from './Marks'
import { PageIntro } from './PageShell'

type HoldPeriod = 'short' | 'middle' | 'long'

export function InvestmentPage({ onApply }: { onApply?: (application: ModelApplication) => void }) {
  const [dividend, setDividend] = useState(10_000)
  const [holdPeriod, setHoldPeriod] = useState<HoldPeriod>('middle')
  const [gain, setGain] = useState(50_000)
  const [restricted, setRestricted] = useState(false)
  const [applyMonth, setApplyMonth] = useState(1)
  const dividendRate = holdPeriod === 'short' ? .2 : holdPeriod === 'middle' ? .1 : 0
  const result = useMemo(() => ({ dividendTax: dividend * dividendRate, gainTax: restricted ? gain * .2 : 0 }), [dividend, dividendRate, gain, restricted])
  const applyInvestment = (kind: 'dividend' | 'transfer') => {
    if (!onApply) return
    const input = kind === 'dividend' ? { kind, dividend, holdPeriod, applyMonth } : { kind, gain, restricted, applyMonth }
    const fingerprint = fingerprintFor(input)
    const eventKind = kind === 'dividend' ? 'dividend' as const : restricted ? 'restricted-transfer' as const : 'listed-transfer' as const
    const title = kind === 'dividend' ? '上市公司股息红利' : restricted ? '限售股转让收益' : '流通股转让收益'
    onApply({
      fingerprint,
      title: `加入${title}`,
      description: `${applyMonth} 月确认该项投资收益；只按当前选择的资产类型与持有期计税。`,
      events: [{
        id: eventId('investment', fingerprint), fingerprint, applicationFingerprint: fingerprint, type: 'investment', month: applyMonth,
        title, confidence: restricted ? 'model' : 'high', kind: eventKind,
        amount: kind === 'dividend' ? dividend : gain,
        ...(kind === 'dividend' ? { holdPeriod } : {})
      }]
    })
  }

  return (
    <div className="investment-page">
      <PageIntro
        stage={{ index: '02', label: '场景拆解' }}
        title="投资收益，不只有一个“20%”。"
        lead="股息红利的实际税负取决于持股期限；股票转让还要区分普通流通股与限售股等情形。"
      />
      {onApply && <div className="investment-event-month"><span>写入年度账本的发生月份</span><select value={applyMonth} onChange={(event) => setApplyMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} 月</option>)}</select></div>}
      <section className="investment-grid">
        <article className="investment-module">
          <div className="investment-title"><div><span>01</span><h2>上市公司股息红利</h2></div><ConfidenceMark level="high" /></div>
          <label className="invest-amount"><span>取得股息红利</span><div><b>¥</b><input type="number" min="0" value={dividend} onChange={(event) => setDividend(Math.max(0, Number(event.target.value) || 0))} /></div></label>
          <div className="hold-options"><button className={holdPeriod === 'short' ? 'is-active' : ''} onClick={() => setHoldPeriod('short')}><b>≤ 1 个月</b><span>实际税负 20%</span></button><button className={holdPeriod === 'middle' ? 'is-active' : ''} onClick={() => setHoldPeriod('middle')}><b>1 个月—1 年</b><span>实际税负 10%</span></button><button className={holdPeriod === 'long' ? 'is-active' : ''} onClick={() => setHoldPeriod('long')}><b>&gt; 1 年</b><span>暂免征收</span></button></div>
          <div className="investment-answer"><span>股息红利个人所得税</span><strong>{money(result.dividendTax)}</strong><code>{money(dividend)} × {(dividendRate * 100).toFixed(0)}%</code>{onApply && <button className="primary-button" onClick={() => applyInvestment('dividend')}>应用到我的年度</button>}</div>
          <p className="investment-note">持股 1 年以内时，上市公司派息时暂不扣缴；待转让股票后按持股期限计算并扣收。</p>
        </article>
        <article className="investment-module">
          <div className="investment-title"><div><span>02</span><h2>股票转让所得</h2></div><ConfidenceMark level={restricted ? 'model' : 'high'} /></div>
          <label className="invest-amount"><span>股票转让收益</span><div><b>¥</b><input type="number" min="0" value={gain} onChange={(event) => setGain(Math.max(0, Number(event.target.value) || 0))} /></div></label>
          <label className="restricted-check"><input type="checkbox" checked={restricted} onChange={(event) => setRestricted(event.target.checked)} /><span><b>属于上市公司限售股</b><small>限售股原值、合理税费和具体扣缴规则需按资料确认</small></span></label>
          <div className="investment-answer"><span>财产转让个人所得税</span><strong>{restricted ? `≈ ${money(result.gainTax)}` : money(0)}</strong><code>{restricted ? '收益简化估算 × 20%' : '普通上市公司流通股转让所得暂免'}</code>{onApply && <button className="primary-button" onClick={() => applyInvestment('transfer')}>应用到我的年度</button>}</div>
          <p className="investment-note">此处仅处理境内上市公司股票的常见情形。基金、债券、境外证券、非上市股权及员工股权激励不应套用本结果。</p>
        </article>
      </section>
      <section className="investment-boundary"><span>投资回报</span><h2>税率不是收益率的一部分装饰。</h2><p>投资税务取决于资产类型、账户、持有时间和交易身份。无法从“赚了多少钱”单独判断的项目，必须继续询问条件。</p></section>
    </div>
  )
}
