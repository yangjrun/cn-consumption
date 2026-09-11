import type { Page, ViewMode } from '../types'

/** 三种统计口径的对外文案，头部切换器与上下文条共用，避免两处描述不一致。 */
export const modeCopy: Record<ViewMode, { short: string; label: string; explain: string }> = {
  conservative: {
    short: '保守',
    label: '保守模式',
    explain: '只计入直接税和可可靠拆分的价格内含税。'
  },
  neutral: {
    short: '中性',
    label: '中性模式',
    explain: '合理估算项以 ≈ 标记，暂不增加未经核验的上游税负。'
  },
  broad: {
    short: '广义',
    label: '广义观察',
    explain: '展示企业用工成本等经济视角，但不计入“你交了多少税”。'
  }
}

/**
 * 口径只作用于汇总结果，不作用于按法定税率直接拆解的场景页。
 * 在这些页面上明确降级说明，避免用户以为切换无效或页面出错。
 */
export const pagesUsingViewMode: Page[] = ['dashboard', 'bill', 'scenarios']

export const modeAppliesTo = (page: Page) => pagesUsingViewMode.includes(page)

/** 口径在当前页面不起作用时给出的解释文案。 */
export const modeFallbackNote = '本页按法定税率直接拆解单笔交易或输入参数，结果不随口径切换变化。'
