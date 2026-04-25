import * as XLSX from 'xlsx';
import Papa from "papaparse";
import dayjs from "dayjs";
import type { DetailedNetWorthRow } from './types';

/** ---------- Utilities (Parsing & helpers) ---------- */
export const toNumber = (v: any) => (v == null || v === '' ? 0 : Number(v)) // Default to 0 instead of NaN

export const toDate = (v: any): Date => {
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? new Date(d.y, d.m - 1, d.d) : new Date(NaN)
  }
  return new Date(v)
}

export async function fetchPortfolioCSV(csvUrl: string) {
  const res = await fetch(csvUrl)
  const text = await res.text()
  const parsed = Papa.parse(text, { header: true })
  // Expect columns: Ticker, Qty, Price, Value, Name (or your exact header names)
  const rows = (parsed.data as any[]).filter(r => r.Ticker && r.Qty)
  return rows.map(r => ({
    ticker: r.Ticker,
    name: r.Name || r.Ticker,
    qty: Number(r.Qty || 0),
    price: Number(r.Price || 0),
    value: Number(r.Value || 0),
    category: r.Category || "Uncategorized"
  }))
}

export const logDataDifference = (label: string, oldData: DetailedNetWorthRow[], newData: DetailedNetWorthRow[]) => {
  console.log(`--- ${label} ---`);
  if (oldData.length !== newData.length) {
    console.log(`%cDifference found: Length changed from ${oldData.length} to ${newData.length}`, 'color: yellow');
  }
  
  const oldProjectionCount = oldData.filter(r => r.Type === 'Projected').length;
  const newProjectionCount = newData.filter(r => r.Type === 'Projected').length;

  if (oldProjectionCount !== newProjectionCount) {
      console.log(`%cProjection count changed from ${oldProjectionCount} to ${newProjectionCount}`, 'color: yellow');
      if (newProjectionCount === 0 && oldProjectionCount > 0) {
          console.error("❌ BUG CONFIRMED: Projections were lost during this step.");
      }
  } else {
      console.log("✅ Projection count is stable.");
  }
  console.log(`--------------------`);
};

export const normalizeTicker = (ticker: string) => {
    return ticker
      .toUpperCase()
      .replace('.TA', '')
      .replace('.', '')
      .replace('-', '');
};

export const fmtILS = (n: number) => `₪${Math.round(n).toLocaleString()}`


export const calculateProjections = (historicalData: DetailedNetWorthRow[]): DetailedNetWorthRow[] => {
    if (historicalData.length === 0) {
      return [];
    }
    const actualData = historicalData.filter(r => r.Type !== 'Projected');
    // #region agent log
    const firstMonth = actualData[0]?.Month;
    const firstMonthType = typeof firstMonth;
    const ord = (d: Date) => Math.floor(+d / (24 * 3600 * 1000));
    const recent = actualData.slice(-24).filter((r) => r['Net Worth'] && r['Net Worth'] > 0);
    const X = recent.map((r) => ord(r.Month));
    const Y = recent.map((r) => Math.log(r['Net Worth'] as number));
    const xHasNaN = X.some((x) => Number.isNaN(x));
    const yHasNaN = Y.some((y) => Number.isNaN(y));
    fetch('http://127.0.0.1:7243/ingest/dd25555d-10f7-4c18-9556-f18f33aa0e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utils.ts:calculateProjections',message:'Regression inputs',data:{actualLen:actualData.length,recentLen:recent.length,firstMonthType,xHasNaN,yHasNaN,Xsample:X.slice(0,3)},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const n = X.length;
    let slope = 0, intercept = 0;

    if (n >= 2) {
      const mx = X.reduce((a, b) => a + b, 0) / n;
      const my = Y.reduce((a, b) => a + b, 0) / n;
      const num = X.map((x, i) => (x - mx) * (Y[i] - my)).reduce((a, b) => a + b, 0);
      const den = X.map((x) => (x - mx) ** 2).reduce((a, b) => a + b, 0);
      slope = den ? num / den : 0;
      intercept = my - slope * mx;
    }

    const last = actualData.at(-1)!;
    const lastDebt = last['Total Debt'] ?? 0;
    const totalAssets = ((last['Total Liquid Assets'] || 0) + (last['Total Non-Liquid Assets'] || 0)) || 1;
    const pL = (last['Total Liquid Assets'] || 0) / totalAssets;
    const pN = 1 - pL;

    const future: DetailedNetWorthRow[] = [];
    for (let i = 1; i <= 12; i++) {
      const m = dayjs(last.Month).add(i, 'month').startOf('month').toDate();
      const x = ord(m);
      const netWorth = Math.exp(intercept + slope * x);
      // #region agent log
      if (i === 1) fetch('http://127.0.0.1:7243/ingest/dd25555d-10f7-4c18-9556-f18f33aa0e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utils.ts:calculateProjections',message:'First projected value',data:{slope,intercept,firstProjNetWorth:netWorth,valueIsNaN:Number.isNaN(netWorth)},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const totalProjectedAssets = netWorth + lastDebt;
      const projectedLiquid = totalProjectedAssets * pL;
      const projectedNonLiquid = totalProjectedAssets * pN;
      
      future.push({
        Month: m,
        'Net Worth': null,
        'Total Liquid Assets': null,
        'Total Non-Liquid Assets': null,
        'Total Debt': null,
        'Projected Net Worth': netWorth,
        'Projected Total Liquid Assets': projectedLiquid,
        'Projected Total Non-Liquid Assets': projectedNonLiquid,
        'Projected Total Debt': lastDebt,
        Type: 'Projected',
        Cash: 0, MMF: 0, Bonds: 0, Stocks: 0, Hishtalmut: 0, ProvFund: 0,
        RealEstateInv: 0, Crypto: 0, Pension: 0, Car: 0, Residence: 0,
        OtherNonLiquid: 0, Mortgage: 0, Loans: 0, CreditCardDebt: 0,
      });
    }

    const processedHistorical = actualData.map((r, index) => {
      const isLastRow = index === actualData.length - 1;
      
      if (isLastRow) {
        return {
          ...r,
          Type: 'Actual' as const,
          'Projected Net Worth': r['Net Worth'],
          'Projected Total Liquid Assets': r['Total Liquid Assets'],
          'Projected Total Non-Liquid Assets': r['Total Non-Liquid Assets'],
          'Projected Total Debt': r['Total Debt'],
        };
      } else {
        return {
          ...r,
          Type: 'Actual' as const,
          'Projected Net Worth': null,
          'Projected Total Liquid Assets': null,
          'Projected Total Non-Liquid Assets': null,
          'Projected Total Debt': null,
        };
      }
    });

    return [...processedHistorical, ...future];
  };

