import type { ExpenseMeta } from '../types'

export const expenseMeta: ExpenseMeta[] = [
  { key: 'housing', label: '房租／房贷', shortLabel: '居住', vatRate: 0, confidence: 'unknown', note: '房租与房贷性质不同；房贷本金不是消费，出租方税务也不能由租金直接统一反推。' },
  { key: 'dining', label: '餐饮', shortLabel: '餐饮', vatRate: 0.06, confidence: 'high', note: '按餐饮生活服务一般计税税率作价税拆分。' },
  { key: 'groceries', label: '食品与日用', shortLabel: '食品', vatRate: 0.09, confidence: 'model', note: '食品税率与免税范围并不统一，v0 暂按 9% 组合篮子估算。' },
  { key: 'clothing', label: '服装鞋帽', shortLabel: '服装', vatRate: 0.13, confidence: 'high', note: '按一般货物税率作价税拆分。' },
  { key: 'electronics', label: '电子产品', shortLabel: '数码', vatRate: 0.13, confidence: 'high', note: '按一般货物税率作价税拆分。' },
  { key: 'utilities', label: '水电燃气', shortLabel: '能源', vatRate: 0.09, confidence: 'model', note: '水、电、燃气存在不同征收及简易计税情形，暂按组合税率估算。' },
  { key: 'telecom', label: '通讯与宽带', shortLabel: '通讯', vatRate: 0.09, confidence: 'model', note: '基础电信与增值电信税率不同，套餐难以从总价精确拆分。' },
  { key: 'transport', label: '公共交通', shortLabel: '交通', vatRate: 0.09, confidence: 'model', note: '按交通运输服务一般计税税率估算，公共交通可能适用其他计税方式。' },
  { key: 'fuel', label: '汽油', shortLabel: '汽油', vatRate: 0.13, confidence: 'model', note: '含税零售价拆分增值税；消费税按升数估算且法定纳税人在生产／进口环节。' },
  { key: 'travel', label: '酒店与旅游', shortLabel: '旅行', vatRate: 0.06, confidence: 'model', note: '组合消费项目可能包含多种税率，暂按生活服务估算。' },
  { key: 'entertainment', label: '娱乐服务', shortLabel: '娱乐', vatRate: 0.06, confidence: 'high', note: '按生活服务一般计税税率作价税拆分。' },
  { key: 'medical', label: '医疗', shortLabel: '医疗', vatRate: 0, confidence: 'model', note: '医疗机构提供的医疗服务通常涉及免税规则，药品等商品需另行判断。' },
  { key: 'education', label: '教育', shortLabel: '教育', vatRate: 0, confidence: 'model', note: '学历教育等可能免税，培训及商品支出需另行判断。' },
  { key: 'tobacco', label: '香烟', shortLabel: '香烟', vatRate: 0.13, confidence: 'model', note: '只拆分零售价格增值税；生产与批发环节消费税缺少相应计税销售额，不在年度篮子中反推。' },
  { key: 'alcohol', label: '酒类', shortLabel: '酒类', vatRate: 0.13, confidence: 'model', note: '只拆分零售价格增值税；不同酒类消费税计税方法不同，需按品类、数量与生产环节税基判断。' },
  { key: 'car', label: '购车支出', shortLabel: '汽车', vatRate: 0, confidence: 'unknown', note: '请在“房与车”模块按车辆类型计算，避免把一次性购车支出按月重复估算。' },
  { key: 'other', label: '其他支出', shortLabel: '其他', vatRate: 0, confidence: 'unknown', note: '未分类支出不默认指定税率。' }
]

export const initialExpenses = {
  housing: 3500,
  dining: 1800,
  groceries: 1200,
  clothing: 400,
  electronics: 500,
  utilities: 350,
  telecom: 180,
  transport: 300,
  fuel: 0,
  travel: 500,
  entertainment: 300,
  medical: 200,
  education: 300,
  tobacco: 0,
  alcohol: 0,
  car: 0,
  other: 500
}
