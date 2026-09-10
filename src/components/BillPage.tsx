import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { compactMoney, getFreedomDate, money } from '../lib/calculations'
import type { CalculatorProfile, TaxResult, ViewMode } from '../types'
import { Approx, ConfidenceMark } from './Marks'

export function BillPage({ profile, result, mode, onEdit }: { profile: CalculatorProfile; result: TaxResult; mode: ViewMode; onEdit: () => void }) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [exportState, setExportState] = useState<'idle' | 'working' | 'error'>('idle')
  const topCategories = [...result.expenseTaxes].sort((a, b) => b.total - a.total).slice(0, 5)

  const exportPng = async () => {
    if (!reportRef.current) return
    setExportState('working')
    try {
      const dataUrl = await toPng(reportRef.current, { cacheBust: true, pixelRatio: 2, skipFonts: true, backgroundColor: '#f3f0e8' })
      const link = document.createElement('a')
      link.download = `我的-${profile.year}-税费账单.png`
      link.href = dataUrl
      link.click()
      setExportState('idle')
    } catch {
      setExportState('error')
    }
  }

  return (
    <div className="bill-page">
      <header className="bill-toolbar">
        <div><span className="kicker">可分享年度报告</span><h1>我的 {profile.year} 税费账单</h1></div>
        <div><button className="text-button" onClick={onEdit}>调整数据</button><button className="text-button" onClick={() => window.print()}>导出 PDF</button><button className="primary-button" disabled={exportState === 'working'} onClick={exportPng}>{exportState === 'working' ? '正在生成…' : '导出 PNG'}</button></div>
        {exportState === 'error' && <p className="export-error">PNG 生成失败。可先使用“导出 PDF”，或检查浏览器是否允许下载。</p>}
      </header>

      <div className="annual-report" ref={reportRef}>
        <div className="report-masthead"><div><span className="wordmark__seal">税</span><span><b>税镜</b><small>PERSONAL TAX LENS</small></span></div><div><span>{profile.year} ANNUAL STATEMENT</span><b>{profile.city}</b></div></div>
        <section className="report-hero"><div><span>这一年，你获得／创造</span><strong>{money(result.annualGross)}</strong><small>工资与奖金税前收入</small></div><p>收入不只经过工资条。它还流向社会保障、日常消费，以及价格中可以识别的税收因素。</p></section>
        <section className="report-ledger">
          <div><span>直接缴纳</span><strong>{money(result.incomeTax)}</strong><small>个人所得税{profile.annualBonus > 0 ? ` · 奖金${result.effectiveAnnualBonusTaxMethod === 'separate' ? '单独计税' : '并入综合所得'}` : ''}</small><ConfidenceMark level="exact" /></div>
          <div className="is-social"><span>个人社会保障缴费</span><strong>{money(result.personalSocial)}</strong><small>不属于税</small><ConfidenceMark level="high" /></div>
          <div className="is-social"><span>住房公积金</span><strong>{money(result.housingFund)}</strong><small>不属于税</small><ConfidenceMark level="high" /></div>
          <div><span>税后到手收入</span><strong>{money(result.takeHome)}</strong><small>收入减税与个人缴费</small><ConfidenceMark level="high" /></div>
        </section>
        <section className="report-consumption"><div className="report-section-title"><span>消费账本</span><b>{money(result.annualSpending)}</b></div><div className="report-consumption-grid"><div className="report-tax-number"><span>价格中理论可识别税费</span><strong><Approx>{money(result.vatEstimate + result.consumptionTaxEstimate)}</Approx></strong><small>{mode === 'conservative' ? '保守' : '中性'}口径 · 增值税价税部分 + 已识别消费税 · 建模覆盖约 {(result.consumptionSpendCoverage * 100).toFixed(0)}%</small></div><div className="report-category-list">{topCategories.map((item) => <div key={item.key}><span>{item.label}</span><i><b style={{ width: `${result.identifiableTax ? item.total / Math.max(...topCategories.map((x) => x.total), 1) * 100 : 0}%` }} /></i><strong><Approx>{money(item.total)}</Approx></strong></div>)}</div></div></section>
        <section className="report-final"><div><span>全年总可识别税费</span><strong><Approx>{money(result.identifiableTax)}</Approx></strong><small>不包含社保和住房公积金</small></div><div><span>可识别税费／税前收入</span><strong><Approx>{(result.burdenRatio * 100).toFixed(1)}%</Approx></strong><small>个人模拟指标</small></div><div><span>可识别税负日</span><strong>{getFreedomDate(profile.year, result.freedomDay)}</strong><small>不是官方统计指标</small></div></section>
        <section className="report-principle"><b>一张保持边界的账单</b><p>法定纳税人不必然等于经济承担者；含税价拆分不等于商家最终缴税；企业所得税、土地出让收入和无法归属的上游税费没有被重复叠加。</p></section>
        <footer className="report-footer"><span>计算口径：个人所得税 + 消费价格中可识别税收因素（{mode === 'conservative' ? '保守' : '中性'}）</span><span>规则核验：2026-09-10</span><span>taxlens.local / 匿名本地计算</span></footer>
      </div>
    </div>
  )
}
