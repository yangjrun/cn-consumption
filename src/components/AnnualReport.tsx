import { SocialInsurancePreview } from './SocialInsuranceEditor'
import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { getFreedomDate, money } from '../lib/calculations'
import type { AnnualTaxResult, AppModelV1, Page } from '../types'
import { Approx, ConfidenceMark } from './Marks'

interface AnnualReportProps {
  model: AppModelV1
  result: AnnualTaxResult
  onEdit: () => void
  onNavigate: (page: Page) => void
}

export function AnnualReport({ model, result, onEdit, onNavigate }: AnnualReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [exportState, setExportState] = useState<'idle' | 'working' | 'error'>('idle')
  const contributions = result.personalSocial + result.housingFund

  const exportPng = async () => {
    if (!reportRef.current) return
    setExportState('working')
    try {
      const dataUrl = await toPng(reportRef.current, { cacheBust: true, pixelRatio: 2, skipFonts: true, backgroundColor: '#f3f0e8' })
      const link = document.createElement('a')
      link.download = `我的-${model.profile.year}-税费年度报告.png`
      link.href = dataUrl
      link.click()
      setExportState('idle')
    } catch { setExportState('error') }
  }

  return (
    <div className="annual-report-page">
      <header className="report-toolbar"><div><span className="kicker">04 / 年度报告</span><h1>一份能够继续核对的年度账。</h1><p>月度节奏、一次性事件与方法边界都保留在报告里，而不只输出一个总数。</p></div><div><button className="text-button" onClick={onEdit}>调整年度数据</button><button className="text-button" onClick={() => window.print()}>导出 PDF</button><button className="primary-button" disabled={exportState === 'working'} onClick={exportPng}>{exportState === 'working' ? '正在生成…' : '导出 PNG'}</button></div>{exportState === 'error' && <p className="export-error">PNG 生成失败，请使用浏览器打印导出 PDF。</p>}</header>

      <article className="statement" ref={reportRef}>
        <header className="statement__mast"><div><span className="wordmark__seal">税</span><span><b>税镜</b><small>PERSONAL TAX LENS</small></span></div><div><span>{model.profile.year} ANNUAL LEDGER</span><b>{model.profile.city} · {model.status === 'sample' ? '示例模型' : '个人模型'}</b></div></header>
        <section className="statement__hero"><div><span>全年现金收入</span><strong>{money(result.annualCashIncome)}</strong><small>工资与奖金 {money(result.annualGross)} · 投资收入 {money(result.otherIncome)}</small></div><div><span>全年可识别税费</span><strong><Approx>{money(result.identifiableTax)}</Approx></strong><small>{result.estimateMode === 'conservative' ? '保守估计' : '中性估计'} · 不含个人社会缴费</small></div></section>

        <section className="statement__ledger">
          <div><span>工资与奖金个税</span><strong>{money(result.incomeTax)}</strong><small>累计预扣法及所选奖金方式</small></div>
          <div><span>投资税</span><strong>{money(result.investmentTax)}</strong><small>{result.eventBreakdowns.filter((item) => item.type === 'investment').length} 项投资事件</small></div>
          <div><span>消费价格内含税</span><strong><Approx>{money(result.recurringEmbeddedTax + result.eventEmbeddedTax)}</Approx></strong><small>固定消费与一次性事件</small></div>
          <div><span>资产交易税</span><strong>{money(result.assetTransactionTax)}</strong><small>只按你的交易角色计入</small></div>
          <div className="is-social"><span>个人社会缴费</span><strong>{money(contributions)}</strong><small>社保与公积金，不属于税</small></div>
          <div><span>工资税后到手</span><strong>{money(result.employmentTakeHome)}</strong><small>不含投资现金流与资产购置支出</small></div>
        </section>

        <section className="statement__section"><div className="statement__section-head"><div><span>MONTH BY MONTH</span><h2>12 个月税费明细</h2></div><p>合计 {money(result.monthlySchedule.reduce((sum, item) => sum + item.total, 0))}</p></div><div className="statement-months">{result.monthlySchedule.map((point) => <div key={point.month} className={point.eventIds.length ? 'has-event' : ''}><span>{point.month} 月</span><strong>{money(point.total)}</strong><small>工资税 {money(point.salaryIncomeTax + point.bonusTax)}</small><small>个人社保 {money(point.personalSocial, 2)}</small><small>单位社保 {money(point.employerSocial, 2)}</small>{!point.socialInsurance.complete && <small>需手工校准</small>}{point.eventIds.length > 0 && <b>{point.eventIds.length} 个事件</b>}</div>)}</div></section>

        <section className="statement__section"><div className="statement__section-head"><div><span>EVENT LEDGER</span><h2>一次性事件</h2></div><p>{result.eventBreakdowns.length} 项</p></div>{result.eventBreakdowns.length ? <div className="statement-events">{result.eventBreakdowns.map((item) => <div key={item.eventId}><span>{item.month} 月</span><div><b>{item.title}</b><small>{item.note}</small></div><strong>{item.confidence === 'model' && <Approx />}{money(item.total)}</strong><ConfidenceMark level={item.confidence} compact /></div>)}</div> : <div className="statement-empty">本年度尚未加入房车、投资或一次性消费事件。</div>}</section>

        <section className="statement__section"><div className="statement__section-head"><div><span>SOCIAL INSURANCE</span><h2>社会缴费与计算依据</h2></div><p>{model.profile.socialRateMode === 'official' ? '官方费率' : '自定义费率'} · {model.profile.applyCitySocialBaseLimits ? '应用城市基数上下限' : '手填申报基数'}</p></div><p>全年同城连续参保；单位公积金 {money(result.employerHousingFund, 2)}，单位总成本 {money(result.employerCost, 2)}。公积金按手填参数计算。</p><SocialInsurancePreview value={result.socialInsurance} expanded /></section>
        <section className="statement__final"><div><span>可识别税费／现金收入</span><strong><Approx>{(result.burdenRatio * 100).toFixed(1)}%</Approx></strong></div><div><span>可识别税负日</span><strong>{getFreedomDate(model.profile.year, result.freedomDay)}</strong></div><div><span>扩展观察：附加税费</span><strong><Approx>{money(result.surchargeEstimate)}</Approx></strong></div></section>
        <section className="statement__method"><b>报告边界</b><p>社会缴费与税分开；价格内含税是价税拆分估算，不等于经营者最终实缴；房屋交易只计入用户选择的买方或卖方义务；无法从零售价可靠反推的税费保持未确定。</p><button className="text-button" onClick={() => onNavigate('rules')}>查看全部规则与来源</button></section>
        <footer className="statement__footer"><span>计算口径：{result.estimateMode === 'conservative' ? '保守估计' : '中性估计'}</span><span>本地模型更新：{new Date(model.updatedAt).toLocaleDateString('zh-CN')}</span><span>税镜 · 本地计算</span></footer>
      </article>
    </div>
  )
}
