import { money } from '../lib/calculations'
import { modeCopy, modeFallbackNote } from '../lib/viewMode'
import type { Page, TaxResult, ViewMode } from '../types'
import { Approx } from './Marks'

export interface ContextBarProps {
  result: TaxResult
  mode: ViewMode
  modeApplies: boolean
  onEdit: () => void
  onNavigate: (page: Page) => void
}

/**
 * 常驻上下文条：把「你的模型」一直摆在页面上方。
 *
 * 修复的流程断点：此前只有年度账单页能打开参数面板，用户走到场景页想改一个数字
 * 就必须先退回首页，链路被硬切断。现在任何页面都能一键回到参数编辑。
 * 同时它承担口径适用范围说明，让口径切换不再是一个「看起来没反应」的控件。
 */
export function ContextBar({ result, mode, modeApplies, onEdit, onNavigate }: ContextBarProps) {
  return (
    <div className="context-bar">
      <div className="context-bar__group context-bar__model">
        <span className="context-bar__label">你的模型</span>
        <dl>
          <div>
            <dt>年税前收入</dt>
            <dd>{money(result.annualGross)}</dd>
          </div>
          <div>
            <dt>可识别税费</dt>
            <dd><Approx>{money(result.identifiableTax)}</Approx></dd>
          </div>
          <div className="is-key">
            <dt>可识别税负</dt>
            <dd><Approx>{(result.burdenRatio * 100).toFixed(1)}%</Approx></dd>
          </div>
        </dl>
        <button className="context-bar__edit" onClick={onEdit}>调整数据</button>
      </div>

      <div className={`context-bar__group context-bar__scope${modeApplies ? '' : ' is-inactive'}`}>
        <span className="context-bar__label">口径</span>
        {modeApplies ? (
          <p><b>{modeCopy[mode].label}</b> · {modeCopy[mode].explain}</p>
        ) : (
          <p><b>本页不受口径影响</b> · {modeFallbackNote}</p>
        )}
        <button onClick={() => onNavigate('rules')}>查看边界</button>
      </div>
    </div>
  )
}
