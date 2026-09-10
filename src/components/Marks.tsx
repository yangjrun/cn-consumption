import type { Confidence } from '../types'

const confidenceCopy: Record<Confidence, { mark: string; label: string }> = {
  exact: { mark: '●', label: '精确' },
  high: { mark: '◐', label: '高可信估算' },
  model: { mark: '△', label: '模型估算' },
  unknown: { mark: '?', label: '无法确定' }
}

export function ConfidenceMark({ level, compact = false }: { level: Confidence; compact?: boolean }) {
  const item = confidenceCopy[level]
  return (
    <span className={`confidence confidence--${level}`} title={item.label}>
      <span aria-hidden="true">{item.mark}</span>
      {!compact && item.label}
    </span>
  )
}

export function Approx({ children }: { children?: React.ReactNode }) {
  return <><span className="approx">≈</span>{children}</>
}
