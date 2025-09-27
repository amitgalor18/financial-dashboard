import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar, 
} from 'recharts'
import { TrendingUp, DollarSign, BarChart3, Target, Wallet, Calculator, PieChart as PieIcon, PlusCircle, Trash2, Edit } from 'lucide-react'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import Papa from "papaparse"
import { PortfolioEditModal } from './PortfolioEditModal'
import { NetWorthEditModal } from './NetWorthEditModal'
import { ExpensesEditModal } from './ExpensesEditModal'

/** ---------- Utilities (Excel parsing & helpers) ---------- */
type Row = Record<string, any>

interface SeriesRow {
  Month: Date
  Amount: number
  ['קטגוריה ראשית']?: string
  ['תת-קטגוריה']?: string
  ['הוצאות']?: string
}

interface IncomeExpensesRow {
  Month: Date
  ['Total Income']: number
  ['Total Expenses']: number
  Savings: number
  ['Savings Rate']: number
}

type DetailedNetWorthRow = {
  Month: Date;
  Cash: number; MMF: number; Bonds: number; Stocks: number; Hishtalmut: number;
  ProvFund: number; RealEstateInv: number; Crypto: number;
  Pension: number; Car: number; Residence: number; OtherNonLiquid: number;
  Mortgage: number; Loans: number; CreditCardDebt: number;
  'Total Liquid Assets': number; 'Total Non-Liquid Assets': number;
  'Total Debt': number; 'Net Worth': number;
  Type?: 'Actual' | 'Projected'; // Added for projections
};

const toNumber = (v: any) => (v == null || v === '' ? 0 : Number(v)) // Default to 0 instead of NaN
const toDate = (v: any): Date => {
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? new Date(d.y, d.m - 1, d.d) : new Date(NaN)
  }
  return new Date(v)
}

async function fetchPortfolioCSV(csvUrl: string) {
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

/** ---------- React Component ---------- */
const FinancialDashboard: React.FC = () => {
  // State for Expenses/Income
  const [expensesTime, setExpensesTime] = React.useState<SeriesRow[]>([])
  const [incomeTime, setIncomeTime] = React.useState<SeriesRow[]>([])
  const [incomeExpensesDF, setIncomeExpensesDF] = React.useState<IncomeExpensesRow[]>([])
  const [isExpenseModalOpen, setIsExpenseModalOpen] = React.useState<boolean>(false);
  const [editingMonth, setEditingMonth] = React.useState<string>('');
  const [monthlyItems, setMonthlyItems] = React.useState<{expenses: SeriesRow[], income: SeriesRow[]}>({expenses:[], income:[]});
  const [expenseSchema, setExpenseSchema] = React.useState<{expenses: any[], income: any[]}>({expenses: [], income: []});

  // State for Net Worth
  const [netWorthDF, setNetWorthDF] = React.useState<DetailedNetWorthRow[]>([]);
  const [isNetWorthModalOpen, setIsNetWorthModalOpen] = React.useState<boolean>(false);
  const [editingNetWorthRow, setEditingNetWorthRow] = React.useState<DetailedNetWorthRow | null>(null);
  const [combinedNetWorthDF, setCombinedNetWorthDF] = React.useState<DetailedNetWorthRow[]>([]);
  
  // State for Portfolio
  const [portfolio, setPortfolio] = React.useState<Array<{ticker:string; name:string; qty:number; price:number; value:number, category:string}>>([])
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = React.useState<boolean>(false);
  const [editingPortfolioItem, setEditingPortfolioItem] = React.useState<any | null>(null); 
  
  // General & API State
  const [fiProgressDF, setFiProgressDF] = React.useState<Row[]>([])
  const [activeTab, setActiveTab] = React.useState<'overview' | 'expenses' | 'savings' | 'networth' | 'portfolio' | 'fire'>('overview')
  const [selectedMonth, setSelectedMonth] = React.useState<string>('')
  const [financeFileName, setFinanceFileName] = React.useState<string>('')
  const [fireFileName, setFireFileName] = React.useState<string>('')
  const [csvUrl, setCsvUrl] = React.useState<string>("")
  const [loadingPortfolio, setLoadingPortfolio] = React.useState<boolean>(false)
  const [portfolioError, setPortfolioError] = React.useState<string | null>(null)
  const [apiKey, setApiKey] = React.useState<string>('');
  const [loadingPrices, setLoadingPrices] = React.useState<boolean>(false);
  const [tickerChanges, setTickerChanges] = React.useState<Array<{original: string, normalized: string}>>([]);
  const [unmappedTickers, setUnmappedTickers] = React.useState<string[]>([]);
  const [financeStats, setFinanceStats] = React.useState<{months: number; expRows: number; incRows: number}>({ months: 0, expRows: 0, incRows: 0 })
  const [includeLowRisk, setIncludeLowRisk] = React.useState<boolean>(true)
  const [lowRiskItems, setLowRiskItems] = React.useState<Array<{ticker:string; name:string; qty:number; price:number; value:number; category:string}>>([])
  const fmtILS = (n: number) => `₪${Math.round(n).toLocaleString()}`
  // Helper function to convert any ticker variation into a single, consistent key.
  // e.g., "IS-FF301.TA", "is.ff301" all become "ISFF301"
  const normalizeTicker = (ticker: string) => {
    return ticker
      .toUpperCase()
      .replace('.TA', '')
      .replace('.', '')
      .replace('-', '');
  };
  // Maps your spreadsheet tickers (keys) to the correct API tickers (values). Find the correct ticker in eod using: https://eodhd.com/exchange/TA
  const tickerApiMap: Record<string, string> = {
    'ISFF301': 'iSFF301.TA',
    'ISFF702': 'ISFF702.TA',
    'ISFF101': 'iSFF101.TA',
    'ISFF701': 'IS-FF701.TA',
    'ISFF505': 'IS-FF505.TA',
    'ISFF102': 'IS-FF102.TA',
    'INFF1': 'IN-FF1.TA',
    'INFF7': 'IN-FF7.TA',
    'TEVA': 'TEVA.TA',
    'BTC': 'BTC-USD',
    'NVDA': 'NVDA',
    'AAPL': 'AAPL',
    'MSFT': 'MSFT',
    'GOOGL': 'GOOGL',
    'AMZN': 'AMZN',
    'TSLA': 'TSLA',
    'META': 'META',
    'VADFX': 'VADFX',
    'VBISX': 'VBISX',
    'ILS=X': 'ILS=X',
  };
  
  // Optional: per-ticker category map (used only when CSV has no Category column)
  const [categoryMap] = React.useState<Record<string,string>>({ // CLEANUP: Removed setCategoryMap as it wasn't used
    // examples—you can extend/edit:
    "IS-FF301.TA": "Stocks",
    "IS.FF301": "Stocks",      // your Google Sheets symbol for the same ETF
    "BTC": "Crypto",
  })

  /** ---------- DATA RECALCULATION LOGIC ---------- */
  
  // NEW: This useEffect hook recalculates income/expenses whenever the source data changes
  React.useEffect(() => {
    if (expensesTime.length === 0 && incomeTime.length === 0) return;

    const sumBy = (arr: SeriesRow[]) => {
      const map = new Map<number, number>();
      for (const r of arr) {
        const t = new Date(r.Month).setHours(0, 0, 0, 0);
        map.set(t, (map.get(t) ?? 0) + (r.Amount ?? 0));
      }
      return [...map.entries()].map(([t, Amount]) => ({ Month: new Date(t), Amount }));
    };

    const total_expenses = sumBy(expensesTime).map((r) => ({ Month: r.Month, 'Total Expenses': r.Amount }));
    const total_income = sumBy(incomeTime).map((r) => ({ Month: r.Month, 'Total Income': r.Amount }));
    const keyBy = (d: Date) => new Date(d).toISOString().slice(0, 10);
    const merged = new Map<string, Partial<IncomeExpensesRow>>();
    for (const r of total_income) merged.set(keyBy(r.Month), { Month: r.Month, 'Total Income': r['Total Income'] as any });
    for (const r of total_expenses) {
      const k = keyBy(r.Month);
      const prev = merged.get(k) ?? { Month: r.Month };
      merged.set(k, { ...prev, 'Total Expenses': r['Total Expenses'] as any });
    }
    const inc_exp: IncomeExpensesRow[] = [...merged.values()].filter(r => r['Total Income'] != null && r['Total Expenses'] != null && r.Month instanceof Date) as IncomeExpensesRow[];
    const finalIncExp = inc_exp.map(r => {
        const ti = Number(r['Total Income']);
        const te = Number(r['Total Expenses']);
        const Savings = ti - te;
        return { Month: r.Month!, 'Total Income': ti, 'Total Expenses': te, Savings, 'Savings Rate': (Savings / (ti || 1)) * 100 };
    }).sort((a, b) => +a.Month - +b.Month);

    setIncomeExpensesDF(finalIncExp);
  }, [expensesTime, incomeTime]);

  // Compute FI when both datasets are present
  React.useEffect(() => {
    if (!netWorthDF.length || !incomeExpensesDF.length) return

    const k = (d: any) => new Date(d).toISOString().slice(0, 10)
    const incMap = new Map(incomeExpensesDF.map((r) => [k(r.Month), r]))
    const rows: Row[] = []
    for (const nw of netWorthDF) {
      const inc = incMap.get(k(nw.Month))
      if (inc) rows.push({ ...nw, ...inc })
    }
    rows.sort((a, b) => +new Date(a.Month) - +new Date(b.Month))

    const acc: number[] = []
    const res = rows.map((r, i) => {
      const te = r['Total Expenses'] ?? 0
      acc.push(te)
      const start = Math.max(0, i - 11)
      const annual = acc.slice(start, i + 1).reduce((a, b) => a + b, 0)
      return { ...r, 'Annual Expenses': annual, 'FI Ratio': annual ? r['Net Worth'] / annual : null }
    })
    setFiProgressDF(res)
  }, [netWorthDF, incomeExpensesDF])

  /** ---------- Handlers for file inputs ---------- */
  React.useEffect(() => {
    const savedKey = localStorage.getItem('finnhubApiKey');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('finnhubApiKey', newKey);
  };
  
  async function onFinanceExcelChosen(file: File) {
      setFinanceFileName(file.name)

      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) {
        return
      }

      const A: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

      // Helper function to convert cell values
      const toCell = (row: any[], i: number) => (i >= 0 && i < row.length ? row[i] : null)

      // Find header row
      const STATIC = ['קטגוריה ראשית', 'תת-קטגוריה', 'הוצאות']
      let headerRowIdx = -1
      let colIdx: Record<string, number> = {}
      for (let r = 0; r < Math.min(A.length, 30); r++) { 
        const row = A[r] || []
        const hits: Record<string, number> = {}
        for (let c = 0; c < row.length; c++) {
          const cell = (row[c] ?? '').toString().trim()
          if (STATIC.includes(cell)) hits[cell] = c
        }
        if (Object.keys(hits).length === STATIC.length) {
          headerRowIdx = r
          colIdx = hits
          break
        }
      }
      if (headerRowIdx === -1) {
        setFinanceStats({ months: 0, expRows: 0, incRows: 0 })
        return
      }

      const headers = A[headerRowIdx].map((v) => (v === null ? '' : String(v)))
      const idxMain = colIdx['קטגוריה ראשית']
      const idxSub = colIdx['תת-קטגוריה']
      const idxHotsaot = colIdx['הוצאות']

      // Find month columns
      const monthColIdxs: number[] = []
      for (let c = 0; c < headers.length; c++) {
        if (c !== idxMain && c !== idxSub && c !== idxHotsaot) monthColIdxs.push(c)
      }

      const monthKeys = monthColIdxs
        .map((c) => {
          const k = headers[c]
          const asNum = Number(k)
          if (Number.isFinite(asNum) && asNum > 20000 && asNum < 60000) {
            const d = XLSX.SSF.parse_date_code(asNum)
            if (d) return { col: c, d: new Date(d.y, d.m - 1, d.d) }
          }
          const d2 = new Date(k)
          if (!isNaN(+d2)) return { col: c, d: d2 }
          return null
        })
        .filter(Boolean) as { col: number; d: Date }[]

      // Check next row for dates if not found in headers
      if (monthKeys.length === 0) {
        const next = A[headerRowIdx + 1] || []
        for (const c of monthColIdxs) {
          const v = next[c]
          if (v == null) continue
          if (typeof v === 'number') {
            const d = XLSX.SSF.parse_date_code(v)
            if (d) monthKeys.push({ col: c, d: new Date(d.y, d.m - 1, d.d) })
          } else {
            const d2 = new Date(v)
            if (!isNaN(+d2)) monthKeys.push({ col: c, d: d2 })
          }
        }
      }

      const dataRows = A.slice(headerRowIdx + 1)
      
      // Process rows with fill-down logic and build master schema
      const processRows = (rowsToProcess: any[][]) => {
        const timeSeries: SeriesRow[] = []
        const schema = new Map<string, { main: string, sub: string }>()
        
        let lastMainCategory = ''
        let lastSubCategory = ''

        for (const row of rowsToProcess) {
          const main = toCell(row, idxMain)
          const sub = toCell(row, idxSub)
          const expenseName = toCell(row, idxHotsaot)

          // Fill down logic
          if (main) lastMainCategory = main
          if (sub) lastSubCategory = sub
          
          // Skip rows that don't have an expense name (they are just category headers)
          if (!expenseName) continue

          // Add to master schema if it's a valid expense row
          if (lastMainCategory && lastSubCategory && expenseName) {
            if (!schema.has(expenseName)) {
              schema.set(expenseName, { main: lastMainCategory, sub: lastSubCategory })
            }
          }
          
          // Create time series data for all months (including 0 values)
          for (const { col, d } of monthKeys) {
            const val = Number(toCell(row, col)) || 0 // Default to 0 for empty/null values
            timeSeries.push({
              Month: new Date(d.setHours(0, 0, 0, 0)),
              Amount: val,
              'קטגוריה ראשית': lastMainCategory,
              'תת-קטגוריה': lastSubCategory,
              'הוצאות': expenseName,
            })
          }
        }
        return { 
          timeSeries, 
          schema: Array.from(schema.entries()).map(([expense, cats]) => ({ expense, ...cats })) 
        }
      }

      const EXPENSES_CUTOFF = 57
      const INCOME_CUTOFF = 68

      // Process expenses and income
      const expenseResult = processRows(dataRows.slice(0, EXPENSES_CUTOFF))
      const incomeResult = processRows(dataRows.slice(EXPENSES_CUTOFF, INCOME_CUTOFF))

      // Set the processed data
      setExpensesTime(expenseResult.timeSeries)
      setIncomeTime(incomeResult.timeSeries)
      setExpenseSchema({ expenses: expenseResult.schema, income: incomeResult.schema })

      // Calculate totals by month for income/expenses summary
      const sumBy = (arr: SeriesRow[]) => {
        const map = new Map<number, number>()
        for (const r of arr) {
          const t = new Date(r.Month).setHours(0, 0, 0, 0)
          map.set(t, (map.get(t) ?? 0) + (r.Amount ?? 0))
        }
        return [...map.entries()].map(([t, Amount]) => ({ Month: new Date(t), Amount }))
      }

      const total_expenses = sumBy(expenseResult.timeSeries).map((r) => ({ 
        Month: r.Month, 
        'Total Expenses': r.Amount 
      }))
      const total_income = sumBy(incomeResult.timeSeries).map((r) => ({ 
        Month: r.Month, 
        'Total Income': r.Amount 
      }))

      // Merge income and expenses data
      const keyBy = (d: Date) => new Date(d).toISOString().slice(0, 10)
      const merged = new Map<string, Partial<IncomeExpensesRow>>()
      
      for (const r of total_income) {
        merged.set(keyBy(r.Month), { Month: r.Month, ['Total Income']: r['Total Income'] as any })
      }
      for (const r of total_expenses) {
        const k = keyBy(r.Month)
        const prev = merged.get(k) ?? { Month: r.Month }
        merged.set(k, { ...prev, ['Total Expenses']: r['Total Expenses'] as any })
      }

      const inc_exp: IncomeExpensesRow[] = [...merged.values()]
        .filter((r) => r['Total Income'] != null && r['Total Expenses'] != null && r.Month instanceof Date) as IncomeExpensesRow[]

      const finalIncExp = inc_exp
        .map((r) => {
          const ti = Number(r['Total Income'])
          const te = Number(r['Total Expenses'])
          const Savings = ti - te
          return { 
            Month: r.Month!, 
            ['Total Income']: ti, 
            ['Total Expenses']: te, 
            Savings, 
            ['Savings Rate']: (Savings / (ti || 1)) * 100 
          }
        })
        .sort((a, b) => +a.Month - +b.Month)

      setIncomeExpensesDF(finalIncExp)
      setFinanceStats({ 
        months: monthKeys.length, 
        expRows: expenseResult.timeSeries.length, 
        incRows: incomeResult.timeSeries.length 
      })

      // Set the selected month to the latest month
      if (finalIncExp.length) {
        const last = finalIncExp.at(-1)!.Month
        const ym = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`
        setSelectedMonth(ym)
      }
  }

  // CLEANUP: This function was for a hardcoded URL. The new `loadFromSheetClick` is the primary one.
  // It can be removed or kept for testing. I'll comment it out.
  // async function loadFromSheet() {
  //   const rows = await fetchPortfolioCSV("https://docs.google.com/spreadsheets/d/e/2PACX-1vSltL3NxXUBQLwhaHW8Gist2I6qVRt8p3fPILBbEEXzcplzFMu8j0-K2JCJgj7hrTcoxCq-JUJN2v6j/pub?output=csv")
  //   setPortfolio(rows)
  //   // setTotalValue(rows.reduce((a,b) => a + (b.value || b.qty*b.price || 0), 0))
  // }

  async function loadFromSheetClick() {
    try {
      setPortfolioError(null)
      setLoadingPortfolio(true)
      const rows = await fetchPortfolioCSV(csvUrl)
      const norm = rows.map((r: any) => {
        const ticker = r.Ticker ?? r.ticker ?? ""
        const qty    = Number(r.Qty   ?? r.qty   ?? 0)
        const price  = Number(r.Price ?? r.price ?? 0)
        const value  = Number(r.Value ?? r.value ?? 0) || (qty * price)
        const name   = r.Name ?? r.name ?? ticker
        const category = (r.Category ?? r.category) || categoryMap[ticker] || "Uncategorized"
        return { ticker, name, qty, price, value, category }
      })
      setPortfolio(norm)
      // setTotalValue(norm.reduce((a,b)=> a + (b.value || 0), 0)) // CLEANUP: No longer needed
    } catch (e: any) {
      setPortfolioError(e?.message || String(e))
    } finally {
      setLoadingPortfolio(false)
    }
  }
  
  const calculateProjections = (historicalData: DetailedNetWorthRow[]) => {
    if (historicalData.length === 0) {
      setCombinedNetWorthDF([]);
      return;
    }

    const ord = (d: Date) => Math.floor(+d / (24 * 3600 * 1000));
    const recent = historicalData.slice(-24).filter((r) => r['Net Worth'] > 0);
    const X = recent.map((r) => ord(r.Month));
    const Y = recent.map((r) => Math.log(r['Net Worth']));
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

    const last = historicalData.at(-1)!;
    const totalAssets = (last['Total Liquid Assets'] + last['Total Non-Liquid Assets']) || 1;
    const pL = last['Total Liquid Assets'] / totalAssets;
    const pN = 1 - pL;

    const future: DetailedNetWorthRow[] = [];
    for (let i = 1; i <= 12; i++) {
      const m = dayjs(last.Month).add(i, 'month').startOf('month').toDate();
      const x = ord(m);
      const netWorth = Math.exp(intercept + slope * x);
      const projectedLiquid = netWorth * pL;
      const projectedNonLiquid = netWorth * pN;

      future.push({
        Month: m, 'Net Worth': netWorth, 'Total Liquid Assets': projectedLiquid,
        'Total Non-Liquid Assets': projectedNonLiquid, Type: 'Projected',
        Cash: 0, MMF: 0, Bonds: 0, Stocks: 0, Hishtalmut: 0, ProvFund: 0,
        RealEstateInv: 0, Crypto: 0, Pension: 0, Car: 0, Residence: 0,
        OtherNonLiquid: 0, Mortgage: 0, Loans: 0, CreditCardDebt: 0, 'Total Debt': 0,
      });
    }

    setCombinedNetWorthDF([
      ...historicalData.map(r => ({ ...r, Type: 'Actual' as const })),
      ...future
    ]);
  };

  const combinedPortfolio = React.useMemo(() => {
    const base = portfolio ?? []
    return includeLowRisk ? [...base, ...lowRiskItems] : base
  }, [portfolio, lowRiskItems, includeLowRisk])

  const combinedTotal = React.useMemo(
    () => combinedPortfolio.reduce((a,b)=> a + (b.value || b.qty*b.price || 0), 0),
    [combinedPortfolio]
  )
  
  const categoryAgg = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const p of combinedPortfolio) {
      const v = p.value || (p.qty * p.price) || 0
      const cat = p.category || "Uncategorized"
      m.set(cat, (m.get(cat) ?? 0) + v)
    }
    return [...m.entries()]
      .map(([category, value]) => ({ category, value, weight: combinedTotal ? (value/combinedTotal)*100 : 0 }))
      .sort((a,b)=> b.value - a.value)
  }, [combinedPortfolio, combinedTotal])

  const pieData = React.useMemo(() => {
    return combinedPortfolio
      .filter(p => (p.value || (p.qty*p.price)) > 0)
      .map(p => ({ name: p.name || p.ticker, value: p.value || (p.qty * p.price) }))
  }, [combinedPortfolio])

  const handleSaveExpenseChanges = (updatedItems: {expenses: SeriesRow[], income: SeriesRow[]}) => {
    // Update the main state arrays
    setExpensesTime(prev => [
      ...prev.filter(r => dayjs(r.Month).format('YYYY-MM') !== editingMonth),
      ...updatedItems.expenses,
    ]);
    setIncomeTime(prev => [
      ...prev.filter(r => dayjs(r.Month).format('YYYY-MM') !== editingMonth),
      ...updatedItems.income,
    ]);

    // We need to re-run the aggregation logic.
    // We can create a new useEffect hook that listens to changes in expensesTime/incomeTime.
    // This is cleaner than duplicating the logic.

    setIsExpenseModalOpen(false);
  };

  const handleSavePortfolioItem = (itemToSave: any) => {
    const isEditing = portfolio.some(p => p.ticker === itemToSave.ticker);
    
    setPortfolio(prev => {
      if (isEditing) {
        // When editing, preserve the price from the API
        const existingPrice = prev.find(p => p.ticker === itemToSave.ticker)?.price ?? 0;
        const finalItem = { ...itemToSave, price: existingPrice, value: itemToSave.qty * existingPrice };
        return prev.map(p => p.ticker === finalItem.ticker ? finalItem : p);
      } else {
        // When adding, price and value start at 0 until the next refresh
        const newItem = { ...itemToSave, price: 0, value: 0 };
        return [...prev, newItem];
      }
    });
    setIsPortfolioModalOpen(false);
    setEditingPortfolioItem(null);
  };

  const handleRemovePortfolioItem = (tickerToRemove: string) => {
    if (window.confirm(`Are you sure you want to remove ${tickerToRemove}?`)) {
      setPortfolio(prev => prev.filter(p => p.ticker !== tickerToRemove));
    }
  };

  const handleSaveNetWorthChanges = (updatedRow: DetailedNetWorthRow) => {
    // Recalculate totals based on edited components
    const totalLiquid = updatedRow.Cash + updatedRow.MMF + updatedRow.Bonds + updatedRow.Stocks + updatedRow.Hishtalmut + updatedRow.ProvFund + updatedRow.RealEstateInv + updatedRow.Crypto;
    const totalNonLiquid = updatedRow.Pension + updatedRow.Car + updatedRow.Residence;
    const totalDebt = updatedRow.Mortgage + updatedRow.Loans + updatedRow.CreditCardDebt;
    const netWorth = totalLiquid + totalNonLiquid - totalDebt;

    // Create the final, recalculated row
    const finalRow = {
      ...updatedRow,
      'Total Liquid Assets': totalLiquid,
      'Total Non--Liquid Assets': totalNonLiquid,
      'Total Debt': totalDebt,
      'Net Worth': netWorth,
    };

    // Update the main state
    setNetWorthDF(prev => 
      prev.map(row => 
        dayjs(row.Month).isSame(dayjs(finalRow.Month), 'month') 
          ? finalRow 
          : row
      )
    );

    // Close the modal
    setIsNetWorthModalOpen(false);
    setEditingNetWorthRow(null);
  };

  const extractLowRiskItems = (fullNetWorthData: Row[]) => {
    try {
      if (!fullNetWorthData || fullNetWorthData.length === 0) {
        setLowRiskItems([]);
        return;
      }
      const headers = Object.keys(fullNetWorthData[0] ?? {});
      const idxMonth = 0;
      const idxCash = 1;
      const idxMMF = 2;
      // CLEANUP: These idx variables were declared but not used in this specific function.
      // They are used for context/understanding the sheet layout. Can be removed for cleaner code.
      // const idxBonds = 3;
      // const idxStocks = 4;
      // const idxHishtalmut = 5;
      // const idxProvFund = 6;
      // const idxRealEstate = 7;
      // const idxCrypto = 10;
      const key = (i: number) => headers[i];

      const lastRow = [...fullNetWorthData].reverse().find((r: any) => {
        const d = toDate(r[key(idxMonth)]);
        return d instanceof Date && !isNaN(+d);
      });

      if (lastRow) {
        const cash = toNumber(lastRow[key(idxCash)] ?? 0);
        const deposits = toNumber(lastRow[key(idxMMF)] ?? 0);
        const items = [];
        if (cash > 0) items.push({ ticker: "CASH", name: "Cash", qty: 1, price: cash, value: cash, category: "Cash" });
        if (deposits > 0) items.push({ ticker: "MMF+Deposits", name: "MMF & Deposits", qty: 1, price: deposits, value: deposits, category: "MMF & Deposits" });
        setLowRiskItems(items);
      } else {
        setLowRiskItems([]);
      }
    } catch (e) {
      console.warn("Low-risk item extraction failed:", e);
      setLowRiskItems([]);
    }
  };

  async function onFireExcelChosen(file: File) {
    setFireFileName(file.name)
    
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets['מעקב שווי נקי'] ?? wb.Sheets[wb.SheetNames[0]]
    const df: Row[] = XLSX.utils.sheet_to_json(ws, { defval: null, header: 6 })
    // setRawNetWorthDF(df);

    const detailedNet = df.map((r: Row) => {
      const cols = Object.keys(r);

      // --- TODO: Update these column indices to match your Excel file ---
      // You can find these by counting columns (starting from 0) in your sheet
      const cash = toNumber(r[cols[1]]);
      const mmf = toNumber(r[cols[2]]);
      const bonds = toNumber(r[cols[3]]);
      const stocks = toNumber(r[cols[4]]);
      const hishtalmut = toNumber(r[cols[5]]);
      const provFund = toNumber(r[cols[6]]);
      const realEstateInv = toNumber(r[cols[7]]);
      const crypto = toNumber(r[cols[10]]);

      const pension = toNumber(r[cols[12]]);
      const residence = toNumber(r[cols[13]]);
      const car = toNumber(r[cols[14]]);
      const otherNonLiquid = toNumber(r[cols[16]]); // If you have other non-liquid assets

      const mortgage = Math.abs(toNumber(r[cols[25]])); // Ensure debt is positive
      const loans = Math.abs(toNumber(r[cols[19]]));     // Ensure debt is positive
      const creditCardDebt = Math.abs(toNumber(r[cols[18]])); // Ensure debt is positive
      // --- END OF TODO ---

      // Automatically calculate totals from the components
      const totalLiquid = cash + mmf + bonds + stocks + hishtalmut + provFund + realEstateInv + crypto;
      const totalNonLiquid = pension + car + residence + otherNonLiquid;
      const totalDebt = mortgage + loans + creditCardDebt;
      const netWorth = totalLiquid + totalNonLiquid - totalDebt;

      return {
        Month: toDate(r[cols[0]]),
        Cash: cash, MMF: mmf, Bonds: bonds, Stocks: stocks, Hishtalmut: hishtalmut,
        ProvFund: provFund, RealEstateInv: realEstateInv, Crypto: crypto,
        Pension: pension, Car: car, Residence: residence, OtherNonLiquid: otherNonLiquid,
        Mortgage: mortgage, Loans: loans, CreditCardDebt: creditCardDebt,
        'Total Liquid Assets': totalLiquid,
        'Total Non-Liquid Assets': totalNonLiquid,
        'Total Debt': totalDebt, // Stored as positive
        'Net Worth': netWorth,
      };
    })
    .filter((r) => r.Month && !isNaN(+r.Month))
    .sort((a, b) => +new Date(a.Month) - +new Date(b.Month));

    // simple exponential projection
    const ord = (d: Date) => Math.floor(+d / (24 * 3600 * 1000))
    const recent = detailedNet.slice(-24).filter((r) => r['Net Worth'] > 0)
    const X = recent.map((r) => ord(r.Month))
    const Y = recent.map((r) => Math.log(r['Net Worth']))
    const n = X.length
    let slope = 0,
      intercept = 0
    if (n >= 2) {
      const mx = X.reduce((a, b) => a + b, 0) / n
      const my = Y.reduce((a, b) => a + b, 0) / n
      const num = X.map((x, i) => (x - mx) * (Y[i] - my)).reduce((a, b) => a + b, 0)
      const den = X.map((x) => (x - mx) ** 2).reduce((a, b) => a + b, 0)
      slope = den ? num / den : 0
      intercept = my - slope * mx
    }

    const last = detailedNet.at(-1)?.Month ?? new Date()
    const lastRow = detailedNet.at(-1)
    const total = ((lastRow?.['Total Liquid Assets'] ?? 0) + (lastRow?.['Total Non-Liquid Assets'] ?? 0)) || 1
    const pL = (lastRow?.['Total Liquid Assets'] ?? 0) / total
    const pN = 1 - pL

    const future: DetailedNetWorthRow[] = [] 
    for (let i = 1; i <= 12; i++) {
      const m = dayjs(last).add(i, 'month').startOf('month').toDate()
      const x = ord(m)
      const netWorth = Math.exp(intercept + slope * x)
      
      // Project liquid and non-liquid assets based on the last known ratio
      const projectedLiquid = netWorth * pL;
      const projectedNonLiquid = netWorth * pN;

      future.push({
        Month: m,
        'Net Worth': netWorth,
        'Total Liquid Assets': projectedLiquid,
        'Total Non-Liquid Assets': projectedNonLiquid,
        Type: 'Projected',
        Cash: 0, MMF: 0, Bonds: 0, Stocks: 0, Hishtalmut: 0,
        ProvFund: 0, RealEstateInv: 0, Crypto: 0, Pension: 0, 
        Car: 0, Residence: 0, OtherNonLiquid: 0, Mortgage: 0, 
        Loans: 0, CreditCardDebt: 0, 'Total Debt': 0,
      })
    }

    setNetWorthDF(detailedNet);
    calculateProjections(detailedNet);
    // setCombinedNetWorthDF([
    //     ...detailedNet.map(r => ({ ...r, Type: 'Actual' as const })),
    //     ...future
    // ]);
    
    extractLowRiskItems(df); 
  }

  

  /** ---------- Derived datasets for charts ---------- */
  const monthlyData = React.useMemo(() => {
    return incomeExpensesDF.map((r) => ({
      month: dayjs(r.Month).format('YYYY-MM'),
      income: Math.round(r['Total Income'] ?? 0),
      expenses: Math.round(r['Total Expenses'] ?? 0),
      savings: Math.round((r['Total Income'] ?? 0) - (r['Total Expenses'] ?? 0)),
      savingsRate: Number(r['Savings Rate'] ?? 0),
    }))
  }, [incomeExpensesDF])

  const expensesData = React.useMemo(() => {
    if (!selectedMonth) {
      // Return a default empty structure to maintain type consistency
      return { pieChartData: [], listViewData: [] };
    }
    const monthRows = expensesTime.filter((r) => dayjs(r.Month).format('YYYY-MM') === selectedMonth && r.Amount > 0);

    const grouped = new Map<string, { total: number; items: { expense: string; amount: number }[] }>();
    for (const r of monthRows) {
      const subCat = r['תת-קטגוריה'] ?? 'Uncategorized';
      if (!grouped.has(subCat)) {
        grouped.set(subCat, { total: 0, items: [] });
      }
      const group = grouped.get(subCat)!;
      group.total += r.Amount;
      group.items.push({ expense: r['הוצאות']!, amount: r.Amount });
    }

    const palette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#F59E0B', '#34D399'];
    
    const pieChartData = [...grouped.entries()].map(([category, data], i) => ({
      category,
      amount: data.total,
      color: palette[i % palette.length]
    }));
    
    const listViewData = [...grouped.entries()].map(([subCategory, data]) => ({
      subCategory, ...data
    })).sort((a, b) => b.total - a.total);

    return { pieChartData, listViewData };
  }, [expensesTime, selectedMonth]);

  const savingsSeries = React.useMemo(() => {
    if (!incomeExpensesDF.length) return []
    const rows = incomeExpensesDF
      .slice()
      .sort((a, b) => +a.Month - +b.Month)
      .map(r => ({
        month: dayjs(r.Month).format('YYYY-MM'),
        savings: Math.round((r['Total Income'] ?? 0) - (r['Total Expenses'] ?? 0)),
        savingsRate: r['Savings Rate']
      }))
    let cum = 0
    return rows.map(r => ({ ...r, cumulative: (cum += r.savings) }))
  }, [incomeExpensesDF])
  const totalCumulative = savingsSeries.at(-1)?.cumulative ?? 0
  const avgMonthly = savingsSeries.length
    ? Math.round(savingsSeries.reduce((a, b) => a + b.savings, 0) / savingsSeries.length)
    : 0
  const avgSavingsRate = savingsSeries.length
    ? savingsSeries.reduce((a, b) => a + b.savingsRate, 0) / savingsSeries.length
    : 0
  
  const netWorthData = React.useMemo(() => {
    return combinedNetWorthDF.map((r) => ({
      month: dayjs(r.Month).format('YYYY-MM'),
      'Total Liquid Assets': r.Type === 'Actual' ? r['Total Liquid Assets'] : null,
      'Total Non-Liquid Assets': r.Type === 'Actual' ? r['Total Non-Liquid Assets'] : null,
      'Total Debt': r.Type === 'Actual' ? r['Total Debt'] : null,
      'Net Worth': r.Type === 'Actual' ? r['Net Worth'] : null,
      'Projected Net Worth': r.Type === 'Projected' ? r['Net Worth'] : null,
    }));
  }, [combinedNetWorthDF]);

  const fiData = React.useMemo(() => {
    return fiProgressDF.map((r) => ({
      month: dayjs(r.Month).format('YYYY-MM'),
      fiRatio: r['FI Ratio'] ?? 0,
      fiProgress: r['Annual Expenses'] ? Math.min(((r['Net Worth'] ?? 0) / (r['Annual Expenses'] * 25)) * 100, 100) : 0,
    }))
  }, [fiProgressDF])

  const fetchLivePrices = async () => {
      if (!apiKey) {
        alert("Please enter your EODHD API key.");
        return;
      }
      if (portfolio.length === 0) return;

      setLoadingPrices(true);
      setPortfolioError(null);
      setTickerChanges([]);
      setUnmappedTickers([]);

      try {
          const allOriginalTickers = [...new Set([...portfolio.map(p => p.ticker), 'ILS=X'])];
          
          const tickersToFetch: string[] = [];
          const localUnmapped: string[] = [];
          const reverseApiMap: Record<string, string> = {};

          allOriginalTickers.forEach(originalTicker => {
              const normalized = normalizeTicker(originalTicker);
              const apiTicker = tickerApiMap[normalized];
              
              if (apiTicker) {
                  tickersToFetch.push(apiTicker);
                  reverseApiMap[apiTicker] = originalTicker;
              } else {
                  localUnmapped.push(originalTicker);
              }
          });

          setUnmappedTickers(localUnmapped);

          if (tickersToFetch.length === 0) {
            throw new Error("No mappable tickers found in portfolio.");
          }

          const promises = tickersToFetch.map(apiTicker => {
              let symbolForApi = apiTicker;
              if (apiTicker === 'ILS=X') {
                  symbolForApi = `USDILS.FOREX`;
              } else if (apiTicker.endsWith('-USD')) {
                  symbolForApi = `${apiTicker}.CC`;
              }
              
              const endpoint = `https://financial-dashboard-19e9ldq4f-amitgalor18-2075s-projects.vercel.app/api/get-prices?ticker=${symbolForApi}&apiKey=${apiKey}`;
              return fetch(endpoint).then(res => res.json());
          });

          const results = await Promise.all(promises);

          const priceMap: Record<string, number> = {};
          const errors: string[] = [];

          results.forEach((result, index) => {
              const apiTicker = tickersToFetch[index];
              const originalTicker = reverseApiMap[apiTicker];

              if (result.price && originalTicker) {
                  priceMap[originalTicker] = result.price;
              } else {
                  errors.push(`Failed: ${originalTicker || apiTicker} (${result.error || 'Unknown'})`);
              }
          });

          if (errors.length > 0) console.error("Tickers that failed:", errors);
          const usdToIlsRate = priceMap['ILS=X'];
          if (!usdToIlsRate) throw new Error("Crucial data missing: Could not get USD/ILS exchange rate.");

          const updatedPortfolio = portfolio.map(asset => {
              const livePrice = priceMap[asset.ticker];
              if (livePrice === undefined) return asset;

              let finalPriceInILS: number;
              const apiTicker = tickerApiMap[normalizeTicker(asset.ticker)] || asset.ticker;
              
              if (apiTicker.toUpperCase().endsWith('.TA')) {
                  finalPriceInILS = livePrice / 100;
              } else if (apiTicker.toUpperCase().endsWith('-USD')) {
                  finalPriceInILS = livePrice * usdToIlsRate;
              } else { 
                  finalPriceInILS = livePrice * usdToIlsRate;
              }
              
              return { ...asset, price: finalPriceInILS, value: asset.qty * finalPriceInILS };
          });

          setPortfolio(updatedPortfolio);
          alert(errors.length > 0 ? "Portfolio prices refreshed, but some tickers failed. Check console." : "Portfolio prices refreshed successfully!");

      } catch (err: any) {
          setPortfolioError(err.message || "An unknown error occurred.");
      } finally {
          setLoadingPrices(false);
      }
  };

  /** ---------- UI bits ---------- */
  const StatCard = ({ title, value, icon: Icon }: any) => (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className="bg-blue-500 bg-opacity-20 p-3 rounded-lg">
          <Icon className="text-blue-400" size={24} />
        </div>
      </div>
    </div>
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-medium">{`Month: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-gray-300" style={{ color: entry.color }}>
              {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0]?.payload ?? {}
      const category = p.category ?? ''
      const amount = typeof p.amount === 'number' ? p.amount : Number(p.amount || 0)
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-medium">{`Month: ${selectedMonth || '—'}`}</p>
          <p className="text-gray-300">
            {`${category}: ₪${Math.round(amount).toLocaleString()}`}
          </p>
        </div>
      )
    }
    return null
  }

  const CurrencyTooltip = ({ active, payload, label, title }: any) => {
    if (active && payload && payload.length) {
      const v = typeof payload[0].value === 'number' ? payload[0].value : Number(payload[0].value || 0)
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          {title && <p className="text-white font-medium">{title}</p>}
          {label && <p className="text-gray-300">{label}</p>}
          <p className="text-gray-300">₪{Math.round(v).toLocaleString()}</p>
        </div>
      )
    }
    return null
  }

  const TabButton = ({ id, label, icon: Icon, isActive, onClick }: any) => (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
        isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <Icon size={18} className="mr-2" />
      {label}
    </button>
  )
  
  const haveFinance = incomeExpensesDF.length > 0 && expensesTime.length > 0
  const haveNetWorth = netWorthDF.length > 0

  const handleExport = () => {
    if (!haveFinance || !haveNetWorth) {
      alert("Please load all data sources before exporting.");
      return;
    }

    const dashboardState = {
      version: 2.1,
      exportedAt: new Date().toISOString(),
      data: {
        expensesTime,
        incomeTime,
        portfolio,
        netWorthDF,
        expenseSchema,
        financeFileName,
        fireFileName,
      }
    };
    const jsonString = JSON.stringify(dashboardState, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial_dashboard_state_${dayjs().format('YYYY-MM-DD')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedState = JSON.parse(text);

      if (!importedState.data || !importedState.data.expensesTime || !importedState.data.netWorthDF) {
        throw new Error("Invalid or outdated dashboard state file.");
      }

      const parseDates = (rows: any[], key: string) => 
        rows.map(r => ({ ...r, [key]: new Date(r[key]) }));

      // Set the main states directly from the file.
      const importedNetWorth = parseDates(importedState.data.netWorthDF, 'Month');
      setExpensesTime(parseDates(importedState.data.expensesTime, 'Month'));
      setIncomeTime(parseDates(importedState.data.incomeTime, 'Month'));
      setPortfolio(importedState.data.portfolio || []);
      setNetWorthDF(importedNetWorth);
      setExpenseSchema(importedState.data.expenseSchema || {expenses: [], income: []});
      calculateProjections(importedNetWorth);

      setFinanceFileName(importedState.data.financeFileName || 'Loaded from JSON');
      setFireFileName(importedState.data.fireFileName || 'Loaded from JSON');

      e.target.value = '';
      alert("Dashboard state imported successfully!");

    } catch (err: any) {
      alert(`Error importing file: ${err.message}`);
    }
  };
  
  return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Financial Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Track your financial journey to independence</p>
          </div>
        </div>
  
        {/* Toolbar */}
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-800/60 p-3 ring-1 ring-slate-700">
            <div className="text-sm opacity-80">Load Excel files:</div>
  
            <label className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 cursor-pointer">
              <PieIcon size={16} />
              <span>Expenses/Income workbook</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onFinanceExcelChosen(f)
                }}
              />
            </label>
            {financeFileName && <span className="text-xs text-slate-300">Loaded: {financeFileName} ({financeStats.months} months, {financeStats.expRows} exp, {financeStats.incRows} inc)</span>}
  
            <label className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 cursor-pointer">
              <Wallet size={16} />
              <span>Net Worth workbook</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onFireExcelChosen(f)
                }}
              />
            </label>
            {fireFileName && <span className="text-xs text-slate-300">Loaded: {fireFileName}</span>}
                      <div className="ml-auto text-xs text-slate-300">
              Files are processed locally in your browser; nothing is uploaded.
            </div>
            <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 cursor-pointer">
              Export Dashboard State
            </button>
            <label className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 cursor-pointer">
              Import Dashboard State
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
                      
          </div>
        </div>
  
        {/* Navigation */}
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex space-x-2 overflow-x-auto">
              <TabButton id="overview" label="Overview" icon={DollarSign} isActive={activeTab === 'overview'} onClick={setActiveTab} />
              <TabButton id="expenses" label="Expenses" icon={PieIcon} isActive={activeTab === 'expenses'} onClick={setActiveTab} />
              <TabButton id="savings" label="Savings" icon={TrendingUp} isActive={activeTab === 'savings'} onClick={setActiveTab} />
              <TabButton id="networth" label="Net Worth" icon={Wallet} isActive={activeTab === 'networth'} onClick={setActiveTab} />
              <TabButton id="portfolio" label="Portfolio" icon={BarChart3} isActive={activeTab === 'portfolio'} onClick={setActiveTab} />
              <TabButton id="fire" label="FIRE Progress" icon={Target} isActive={activeTab === 'fire'} onClick={setActiveTab} />
            </div>
          </div>
        </div>
  
        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* All Tab Content... */}
          {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {!haveFinance || !haveNetWorth ? (
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-gray-300">
                    Load both Excel files above to populate charts.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <StatCard title="Latest Income" value={`₪${(monthlyData.at(-1)?.income ?? 0).toLocaleString()}`} icon={DollarSign} />
                      <StatCard title="Latest Expenses" value={`₪${(monthlyData.at(-1)?.expenses ?? 0).toLocaleString()}`} icon={Calculator} />
                      <StatCard title="Savings Rate" value={`${(monthlyData.at(-1)?.savingsRate ?? 0).toFixed(1)}%`} icon={TrendingUp} />
                      <StatCard title="Net Worth" value={`₪${(netWorthData.slice().reverse().find(d => d['Net Worth'] != null)?.['Net Worth'] ?? 0).toLocaleString()}`} icon={Wallet} />
                    </div>
    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-xl font-bold mb-4">Income vs Expenses</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="month" stroke="#9CA3AF" />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} name="Income" />
                            <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={3} name="Expenses" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
    
                      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-xl font-bold mb-4">Savings Rate Trend</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="month" stroke="#9CA3AF" />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="savingsRate" stroke="#3B82F6" strokeWidth={3} name="Savings Rate (%)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Expenses Tab */}
            {!haveFinance && (
              <div className="mb-4 text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 px-3 py-2">
                Pick your <b>Expenses/Income workbook</b> first. After selecting, you should see a “Loaded: …” note in the toolbar.
              </div>
            )}
            {activeTab === 'expenses' && (
              <div className="space-y-8">
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Monthly Expenses Breakdown</h3>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                    >
                      {[...new Set(expensesTime.map((r) => dayjs(r.Month).format('YYYY-MM')))]
                        .sort()
                        .map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                    </select>
                    <button 
                      onClick={() => {
                        if (!selectedMonth) return;
                        setEditingMonth(selectedMonth);
                        setMonthlyItems({
                          expenses: expensesTime.filter(r => dayjs(r.Month).format('YYYY-MM') === selectedMonth),
                          income: incomeTime.filter(r => dayjs(r.Month).format('YYYY-MM') === selectedMonth),
                        });
                        setIsExpenseModalOpen(true);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500"
                    >
                      Edit This Month
                    </button>
                  </div>
    
                  {expensesData.pieChartData.length === 0 ? (
                    <div className="text-gray-400">No expenses recorded for this month.</div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <ResponsiveContainer width="100%" height={650}>
                        <PieChart>
                          <Pie
                            data={expensesData.pieChartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={160}
                            dataKey="amount"
                            nameKey="category"
                            labelLine={false}
                            label={({ category, percent }: any) => `${category} ${(percent * 100).toFixed(0)}%`}
                          >
                            {expensesData.pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="space-y-4 h-[650px] overflow-y-auto pr-2">
                        {expensesData.listViewData.map((group: any) => (
                          <div key={group.subCategory} className="p-3 bg-gray-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <div 
                                  className="w-4 h-4 rounded-full mr-3" 
                                  style={{ backgroundColor: expensesData.pieChartData.find(p => p.category === group.subCategory)?.color }} 
                                />
                                <span className="font-semibold text-white">{group.subCategory}</span>
                              </div>
                              <span className="text-white font-bold">₪{Math.round(group.total).toLocaleString()}</span>
                            </div>
                            <div className="pl-7 space-y-1 border-l-2 border-gray-600 ml-2">
                              {group.items.map((item: any) => (
                                <div key={item.expense} className="flex justify-between text-sm text-gray-300 pt-1">
                                  <span>{item.expense}</span>
                                  <span>₪{Math.round(item.amount).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Savings Tab */}
            {activeTab === 'savings' && (
              <div className="space-y-8">
                {!savingsSeries.length ? (
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-gray-300">
                    Load the Expenses/Income workbook to see monthly and cumulative savings.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Card 1: Cumulative Savings  */}
                      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-xl font-bold mb-2">Cumulative Savings to Date</h3>
                        <div className="text-3xl font-extrabold">₪{totalCumulative.toLocaleString()}</div>
                        <p className="text-gray-400 mt-1 text-sm">
                          Sum of (Income − Expenses) across all months loaded
                        </p>
                      </div>
                      
                      {/* Card 2: Average Monthly Savings  */}
                      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-xl font-bold mb-2">Average Monthly Savings</h3>
                        <div className="text-3xl font-extrabold">₪{avgMonthly.toLocaleString()}</div>
                        <p className="text-gray-400 mt-1 text-sm">
                          Mean of monthly savings, ignoring investment returns
                        </p>
                      </div>

                      {/* Card 3: Average Savings Rate Card */}
                      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-xl font-bold mb-2">Average Savings Rate</h3>
                        <div className="text-3xl font-extrabold">{avgSavingsRate.toFixed(1)}%</div>
                        <p className="text-gray-400 mt-1 text-sm">
                          Average of (Savings / Income) across all months
                        </p>
                      </div>
                    </div>
    
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                      <h3 className="text-xl font-bold mb-4">Cumulative Savings (₪)</h3>
                      <ResponsiveContainer width="100%" height={340}>
                        <LineChart data={savingsSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="month" stroke="#9CA3AF" />
                          <YAxis stroke="#9CA3AF" tickFormatter={(v) => `₪${v.toLocaleString()}`} />
                          <Tooltip content={<CurrencyTooltip title="Cumulative Savings" />} />
                          <Line type="monotone" dataKey="cumulative" stroke="#10B981" strokeWidth={3} name="Cumulative" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
    
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                      <h3 className="text-xl font-bold mb-4">Monthly Savings (₪)</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={savingsSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="month" stroke="#9CA3AF" />
                          <YAxis stroke="#9CA3AF" tickFormatter={(v) => `₪${v.toLocaleString()}`} />
                          <Tooltip content={<CurrencyTooltip title="Monthly Savings" />} />
                          <Bar dataKey="savings" name="Savings" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Net Worth Tab */}
            {activeTab === 'networth' && (
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold mb-6">Net Worth Growth</h3>
                <button 
                  onClick={() => {
                    const monthToEdit = prompt("Enter month to edit (YYYY-MM):", dayjs().format('YYYY-MM'));
                    if (monthToEdit) {
                      const row = netWorthDF.find(r => dayjs(r.Month).format('YYYY-MM') === monthToEdit);
                      if (row) {
                        setEditingNetWorthRow(row);
                        setIsNetWorthModalOpen(true);
                      } else {
                        alert("Month not found in data.");
                      }
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500"
                >
                  Edit Month's Data
                </button>
                {!haveNetWorth ? (
                  <div className="text-gray-400">Load the net worth workbook.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={500}>
                    <LineChart data={netWorthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" tickFormatter={(value) => `₪${value.toLocaleString()}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend 
                        wrapperStyle={{ opacity: 0.8 }}
                        formatter={(value) => 
                          value === 'Net Worth' ? 'Net Worth (includes debt)' : value
                        }
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Total Liquid Assets" 
                        stroke="#10B981" 
                        strokeWidth={2} 
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Total Non-Liquid Assets" 
                        stroke="#f5d60bff" 
                        strokeWidth={2} 
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Total Debt" 
                        stroke="#EF4444" 
                        strokeWidth={2}
                        dot={false} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Net Worth" 
                        stroke="#3B82F6" 
                        strokeWidth={3} 
                        connectNulls
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Projected Net Worth" 
                        stroke="#3B82F6" 
                        strokeWidth={3} 
                        strokeDasharray="5 5"
                        connectNulls 
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
            {/* FIRE Progress Tab */}
            {activeTab === 'fire' && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold mb-6">Financial Independence Progress</h3>
                {fiData.length === 0 ? (
                  <div className="text-gray-400">Load both workbooks to compute FI ratio.</div>
                ) : (
                  <>
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Progress to FI (25× annual expenses)</span>
                        <span className="text-white">{fiData.at(-1)!.fiProgress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(fiData.at(-1)!.fiProgress, 100)}%` }}
                        />
                      </div>
                    </div>
    
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={fiData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="month" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="fiRatio" stroke="#10B981" strokeWidth={3} name="FI Ratio" />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            )}
            {activeTab === 'portfolio' && (
              <div className="space-y-6">
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h3 className="text-xl font-bold mb-4">Load Portfolio from Google Sheets</h3>
  
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="url"
                      className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                      placeholder="Paste your published CSV URL here…"
                      value={csvUrl}
                      onChange={(e) => setCsvUrl(e.target.value)}
                    />
                    <button
                      onClick={loadFromSheetClick}
                      disabled={!csvUrl || loadingPortfolio}
                      className={`px-5 py-2 rounded-lg font-medium ${loadingPortfolio ? 'bg-blue-900' : 'bg-blue-600 hover:bg-blue-500'}`}
                    >
                      {loadingPortfolio ? 'Loading…' : 'Load'}
                    </button>
                  </div>
                  
                  {portfolioError && (
                    <div className="mt-3 text-sm rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-3 py-2">
                      {portfolioError}
                    </div>
                  )}
  
                  {combinedTotal > 0 && (
                    <div className="mt-4 text-sm text-slate-300">
                      Total portfolio value: <span className="font-semibold">₪{Math.round(combinedTotal).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
                  <h3 className="text-xl font-bold mb-4">Live Price Refresh</h3>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="password"
                      className="..."
                      placeholder="Paste your EODHD API Key here..." 
                      value={apiKey}
                      onChange={handleApiKeyChange}
                    />
                    <button
                      onClick={fetchLivePrices} 
                      disabled={!apiKey || loadingPrices}
                      className={`px-5 py-2 rounded-lg font-medium ${loadingPrices || !apiKey ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500'}`}
                    >
                      {loadingPrices ? 'Refreshing...' : 'Refresh Prices'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">API key is saved in your browser's local storage.</p>
                  {tickerChanges.length > 0 && (
                    <div className="mt-3 text-xs rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-200 px-3 py-2">
                      <p className="font-semibold mb-1">Note: The following tickers were automatically normalized for the API call:</p>
                      <ul className="list-disc pl-5">
                        {tickerChanges.map((change, index) => (
                          <li key={index}>
                            `{change.original}` was converted to `{change.normalized}`
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {unmappedTickers.length > 0 && (
                  <div className="mt-4 text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 px-4 py-3">
                    <h4 className="font-bold mb-2">Warning: Unmapped Tickers Found</h4>
                    <p className="mb-2">The following tickers from your portfolio were not found in the `tickerApiMap` and were not updated:</p>
                    <ul className="list-disc pl-5 font-mono">
                      {unmappedTickers.map(t => <li key={t}>{t}</li>)}
                    </ul>
                    <p className="mt-2">To fix this, please add them to the `tickerApiMap` constant in `FinancialDashboard.tsx`.</p>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-blue-500"
                      checked={includeLowRisk}
                      onChange={(e)=> setIncludeLowRisk(e.target.checked)}
                    />
                    Include low-risk buckets from Net Worth file
                  </label>
                </div>
                
                {portfolio.length === 0 ? (
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-gray-300">
                    Paste your Google Sheets **published CSV** URL above and click **Load**.
                    Tip: Columns should be <b>Ticker, Qty, Price, Value, Name</b>.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                      <h4 className="text-lg font-bold mb-4">Holdings by Value</h4>
                      <ResponsiveContainer width="100%" height={420}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            label={(e: any) => `${e.name}: ${fmtILS(e.value)}`}
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={['#4F46E5','#10B981','#F59E0B','#EF4444','#6366F1','#14B8A6','#84CC16','#06B6D4','#A855F7'][i % 9]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const p = payload[0]
                                return (
                                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
                                    <p className="text-white font-medium">{p?.name}</p>
                                    <p className="text-gray-300">{fmtILS(Number(p?.value || 0))}</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                      <h4 className="text-lg font-bold mb-4">Allocation by Category</h4>
                      <ResponsiveContainer width="100%" height={360}>
                        <PieChart>
                          <Pie
                            data={categoryAgg}
                            dataKey="value"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            outerRadius={130}
                            label={(e: any) => `${e.category}: ₪${Math.round(e.value).toLocaleString()} (${e.weight.toFixed(1)}%)`}
                          >
                            {categoryAgg.map((_, i) => (
                              <Cell key={i} fill={['#4F46E5','#10B981','#F59E0B','#EF4444','#6366F1','#14B8A6','#84CC16','#06B6D4','#A855F7'][i % 9]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const p = payload[0].payload
                                return (
                                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
                                    <p className="text-white font-medium">{p.category}</p>
                                    <p className="text-gray-300">₪{Math.round(p.value).toLocaleString()} ({p.weight.toFixed(2)}%)</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 overflow-auto lg:col-span-2">
                      <div className="flex justify-end mb-4">
                        <button
                          onClick={() => {
                            setEditingPortfolioItem(null); // Set to null for "add mode"
                            setIsPortfolioModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 hover:bg-green-500"
                        >
                          <PlusCircle size={16} /> Add New Asset
                        </button>
                      </div>
                      
                      <h4 className="text-lg font-bold mb-4">Positions</h4>
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-300">
                            <th className="py-2 pr-4">Category</th>
                            <th className="py-2 pr-4">Name</th>
                            <th className="py-2 pr-4">Ticker</th>
                            <th className="py-2 pr-4 text-right">Qty</th>
                            <th className="py-2 pr-4 text-right">Price</th>
                            <th className="py-2 pr-4 text-right">Value</th>
                            <th className="py-2 pr-4 text-right">% Weight</th>
                            <th className="py-2 pr-0 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinedPortfolio.map((p, i) => {
                            const v = p.value || (p.qty * p.price)
                            const w = combinedTotal  ? (v / combinedTotal ) * 100 : 0
                            return (
                              <tr key={i} className="border-top border-gray-700">
                                <td className="py-2 pr-4">{p.category || "Uncategorized"}</td>
                                <td className="py-2 pr-4">{p.name || p.ticker}</td>
                                <td className="py-2 pr-4">{p.ticker}</td>
                                <td className="py-2 pr-4 text-right">{p.qty.toLocaleString()}</td>
                                <td className="py-2 pr-4 text-right">{fmtILS(p.price)}</td>
                                <td className="py-2 pr-4 text-right">{fmtILS(v)}</td>
                                <td className="py-2 pr-4 text-right">{w.toFixed(2)}%</td>
                                <td className="py-2 pr-0 text-right">
                                  <div className="flex gap-2 justify-end">
                                    <button 
                                      onClick={() => { 
                                        setEditingPortfolioItem(p); 
                                        setIsPortfolioModalOpen(true); 
                                      }} 
                                      className="text-blue-400 hover:text-blue-300"
                                    >
                                      <Edit size={14}/>
                                    </button>
                                    <button 
                                      onClick={() => handleRemovePortfolioItem(p.ticker)} 
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 size={14}/>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                          <tr className="border-t border-gray-700 font-semibold">
                            <td className="py-2 pr-4" colSpan={5}>Total</td>
                            <td className="py-2 pr-4 text-right">{fmtILS(combinedTotal)}</td>
                            <td className="py-2 pr-4 text-right">100.00%</td>
                            <td className="py-2 pr-0"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
            
        </div>
  
        {/* Render Modals */}
        <PortfolioEditModal 
          isOpen={isPortfolioModalOpen}
          onClose={() => setIsPortfolioModalOpen(false)}
          onSave={handleSavePortfolioItem}
          itemData={editingPortfolioItem}
        />
        <NetWorthEditModal
          isOpen={isNetWorthModalOpen}
          onClose={() => setIsNetWorthModalOpen(false)}
          onSave={handleSaveNetWorthChanges}
          rowData={editingNetWorthRow}
        />
        <ExpensesEditModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          onSave={handleSaveExpenseChanges}
          monthData={monthlyItems}
          month={editingMonth}
          schema={expenseSchema}
        />
      </div>
    );
  }

export default FinancialDashboard