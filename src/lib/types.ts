export type Row = Record<string, any>

export interface SeriesRow {
  Month: Date
  Amount: number
  ['קטגוריה ראשית']?: string
  ['תת-קטגוריה']?: string
  ['הוצאות']?: string
}

export interface IncomeExpensesRow {
  Month: Date
  ['Total Income']: number
  ['Total Expenses']: number
  Savings: number
  ['Savings Rate']: number
}

export type DetailedNetWorthRow = {
  Month: Date;
  Cash: number; 
  MMF: number; 
  Bonds: number; 
  Stocks: number; 
  Hishtalmut: number;
  ProvFund: number; 
  RealEstateInv: number; 
  Crypto: number;
  Pension: number; 
  Car: number; 
  Residence: number; 
  OtherNonLiquid: number;
  Mortgage: number; 
  Loans: number; 
  CreditCardDebt: number;
  'Total Liquid Assets': number | null; 
  'Total Non-Liquid Assets': number | null;
  'Total Debt': number | null; 
  'Net Worth': number | null;
  // Projected fields for chart display
  'Projected Total Liquid Assets'?: number | null;
  'Projected Total Non-Liquid Assets'?: number | null;
  'Projected Total Debt'?: number | null;
  'Projected Net Worth'?: number | null;
  Type?: 'Actual' | 'Projected';
};

export interface PortfolioItem {
    ticker: string;
    name: string;
    qty: number;
    price: number;
    value: number;
    category: string;
}

export interface FinanceStats {
    months: number;
    expRows: number;
    incRows: number;
}
