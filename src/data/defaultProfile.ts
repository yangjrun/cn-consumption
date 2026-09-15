import { initialExpenses } from './expenseMeta'
import type { CalculatorProfile } from '../types'

export const defaultProfile: CalculatorProfile = {
  year: 2026,
  city: '上海',
  monthlySalary: 18_000,
  annualBonus: 0,
  annualBonusTaxMethod: 'optimal',
  specialDeductionMonthly: 2_000,
  socialInsuranceBase: 18_000,
  housingFundBase: 18_000,
  applyCitySocialBaseLimits: true,
  socialRateMode: 'official',
  socialInsuranceOptions: {},
  pensionRate: 0.08,
  medicalRate: 0.02,
  unemploymentRate: 0.005,
  housingFundRate: 0.07,
  employerPensionRate: 0.16,
  employerMedicalRate: 0.09,
  employerUnemploymentRate: 0.005,
  employerInjuryRate: 0.002,
  employerHousingFundRate: 0.07,
  fuelPrice: 8.1,
  cityTier: 'urban',
  expenses: initialExpenses
}

