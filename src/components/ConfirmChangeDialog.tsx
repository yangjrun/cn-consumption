import { money } from '../lib/calculations'
import type { AnnualTaxResult } from '../types'

interface ConfirmChangeDialogProps {
  title: string
  description: string
  current: AnnualTaxResult
  next: AnnualTaxResult
  duplicate?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmChangeDialog({ title, description, current, next, duplicate = false, onConfirm, onClose }: ConfirmChangeDialogProps) {
  const delta = next.identifiableTax - current.identifiableTax
  return (
    <div className="confirm-layer" role="presentation">
      <button className="confirm-scrim" aria-label="取消本次应用" onClick={onClose} />
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <header><span className="kicker">写入年度模型</span><h2 id="confirm-title">{title}</h2><p>{description}</p></header>
        {duplicate ? (
          <div className="duplicate-notice"><b>这组数据已经加入过。</b><p>为避免重复计税，本次不会再次写入。修改场景条件后可以作为新事件加入。</p></div>
        ) : (
          <div className="impact-ledger" aria-live="polite">
            <div><span>当前可识别税费</span><strong>{money(current.identifiableTax)}</strong></div>
            <div><span>应用后</span><strong>{money(next.identifiableTax)}</strong></div>
            <div className={delta >= 0 ? 'is-up' : 'is-down'}><span>本次变化</span><strong>{delta >= 0 ? '+' : '−'}{money(Math.abs(delta))}</strong></div>
          </div>
        )}
        <footer><button className="text-button" onClick={onClose}>{duplicate ? '知道了' : '返回检查'}</button>{!duplicate && <button className="primary-button" onClick={onConfirm}>确认加入我的年度</button>}</footer>
      </section>
    </div>
  )
}
