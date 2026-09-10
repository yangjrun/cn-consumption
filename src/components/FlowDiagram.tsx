import type { TaxResult } from '../types'
import { incomeJourneyPerHundred, money } from '../lib/calculations'

export function FlowDiagram({ result }: { result: TaxResult }) {
  const journey = incomeJourneyPerHundred(result)

  if (!journey.hasIncome) {
    return (
      <div className="flow-diagram flow-diagram--empty" role="status">
        <strong>暂无可折算收入</strong>
        <p>填写税前工资后，这里会按每 100 元收入展示个人所得税、个人缴费和税后到手。</p>
      </div>
    )
  }

  const hasTakeHome = Number.isFinite(result.takeHome) && result.takeHome > 0
  const embeddedDisplay = journey.embeddedPerTakeHome.toFixed(1)
  const spendingShare = journey.spendingShareOfTakeHome.toFixed(0)

  return (
    <div className="flow-diagram" aria-label="每 100 元税前收入的分配账本">
      <div className="journey-income">
        <div className="journey-basis">
          <div><span>税前收入基准</span><small>所得税、个人缴费与到手收入合计</small></div>
          <strong>{money(100, 1)}</strong>
        </div>

        <div className="journey-track" aria-hidden="true">
          <i className="journey-track__tax" style={{ width: `${journey.tax}%` }} />
          <i className="journey-track__contribution" style={{ width: `${journey.contribution}%` }} />
          <i className="journey-track__take-home" style={{ width: `${journey.takeHome}%` }} />
        </div>

        <dl className="journey-ledger">
          <div className="journey-ledger__tax">
            <dt><i />个人所得税<small>直接税</small></dt>
            <dd>−{money(journey.tax, 1)}</dd>
          </div>
          <div className="journey-ledger__contribution">
            <dt><i />个人缴费<small>社保 + 公积金 · 非税</small></dt>
            <dd>−{money(journey.contribution, 1)}</dd>
          </div>
          <div className="journey-ledger__take-home">
            <dt><i />税后到手<small>可用于消费或储蓄</small></dt>
            <dd>{money(journey.takeHome, 1)}</dd>
          </div>
        </dl>
      </div>

      <aside className="journey-consumption">
        <div className="journey-consumption__heading">
          <span>进入消费后</span>
          <small>基于你录入且可建模的全年支出</small>
        </div>
        <div className="journey-consumption__amount">
          <strong>{hasTakeHome ? `≈${money(Number(embeddedDisplay), 1)}` : '无法折算'}</strong>
          <span>{hasTakeHome ? `每 ${money(100, 0)} 到手收入中的价格内含税` : '当前没有可用的税后到手收入'}</span>
        </div>
        <div className="journey-consumption__track" aria-hidden="true">
          <i style={{ width: `${Math.min(100, journey.embeddedPerTakeHome)}%` }} />
        </div>
        {!hasTakeHome ? (
          <p>税后到手为零，消费阶段不使用百分比表达。</p>
        ) : result.annualSpending <= 0 ? (
          <p>尚未录入消费支出，当前没有可折算的价格内含税。</p>
        ) : journey.spendingExceedsTakeHome ? (
          <p className="journey-consumption__warning">录入消费相当于到手收入的 {spendingShare}%，可能包含储蓄或其他资金来源；当前税务建模覆盖约 {(result.consumptionSpendCoverage * 100).toFixed(0)}%。</p>
        ) : (
          <p>录入消费约占到手收入的 {spendingShare}%。其中税务建模覆盖约 {(result.consumptionSpendCoverage * 100).toFixed(0)}%，这不是工资阶段的再次扣款。</p>
        )}
      </aside>
    </div>
  )
}
