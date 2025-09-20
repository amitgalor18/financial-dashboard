
import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Target, Wallet, Calculator, PieChart as PieIcon } from 'lucide-react'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import Papa from "papaparse"

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

const toNumber = (v: any) => (v == null || v === '' ? NaN : Number(v))
const isFiniteNum = (x: any) => typeof x === 'number' && Number.isFinite(x)
const toDate = (v: any): Date => {
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? new Date(d.y, d.m - 1, d.d) : new Date(NaN)
  }
  return new Date(v)
}

async function readSheetWithHeaderRow(file: File, sheetNameOrIndex: string | number, headerRow1Based: number): Promise<Row[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)
  const ws =
    typeof sheetNameOrIndex === 'number'
      ? wb.Sheets[wb.SheetNames[sheetNameOrIndex]]
      : wb.Sheets[sheetNameOrIndex] ?? wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Sheet not found')
  return XLSX.utils.sheet_to_json(ws, { defval: null, header: headerRow1Based })
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

// Helpers to pick columns by header text
const normalize = (s: any) => String(s ?? "").replace(/[\s\u00A0]/g, "").toLowerCase()
const findHeader = (headers: string[], patterns: string[]) => {
  const H = headers.map(normalize)
  for (const p of patterns.map(normalize)) {
    const i = H.findIndex(h => h.includes(p))
    if (i !== -1) return headers[i]
  }
  return null
}
const num = (v: any) => Number(String(v ?? "").replace(/[^\d.\-]/g, "")) || 0

/** ---------- React Component ---------- */
const FinancialDashboard: React.FC = () => {
  // ⬇️ ALL hooks must be inside this function ⬇️
  const [expensesTime, setExpensesTime] = React.useState<SeriesRow[]>([])
  const [incomeTime, setIncomeTime] = React.useState<SeriesRow[]>([])
  const [incomeExpensesDF, setIncomeExpensesDF] = React.useState<IncomeExpensesRow[]>([])
  const [netWorthDF, setNetWorthDF] = React.useState<Row[]>([])
  const [combinedNetWorthDF, setCombinedNetWorthDF] = React.useState<Row[]>([])
  const [fiProgressDF, setFiProgressDF] = React.useState<Row[]>([])

  const [activeTab, setActiveTab] = React.useState<'overview' | 'expenses' | 'savings' | 'networth' | 'portfolio' | 'fire'>('overview')
  const [selectedMonth, setSelectedMonth] = React.useState<string>('')

  const [financeFileName, setFinanceFileName] = React.useState<string>('')
  const [fireFileName, setFireFileName] = React.useState<string>('')

  const [csvUrl, setCsvUrl] = React.useState<string>("")
  const [portfolio, setPortfolio] = React.useState<Array<{ticker:string; name:string; qty:number; price:number; value:number, category:string}>>([])
  const [totalValue, setTotalValue] = React.useState<number>(0)
  const [loadingPortfolio, setLoadingPortfolio] = React.useState<boolean>(false)
  const [portfolioError, setPortfolioError] = React.useState<string | null>(null)
  const fmtILS = (n: number) => `₪${Math.round(n).toLocaleString()}`
  const [financeStats, setFinanceStats] = React.useState<{months: number; expRows: number; incRows: number}>({
    months: 0, expRows: 0, incRows: 0
  })
  // Optional: per-ticker category map (used only when CSV has no Category column)
  const [categoryMap, setCategoryMap] = React.useState<Record<string,string>>({
    // examples—you can extend/edit:
    "IS-FF301.TA": "Stocks",
    "IS.FF301": "Stocks",      // your Google Sheets symbol for the same ETF
    "BTC": "Crypto",
  })

  /** ---------- Handlers for file inputs ---------- */
  // "טבלת-הוצאות-והכנסות-חתול-פיננסי-הגרסה-המלאה.xlsx"
  async function onFinanceExcelChosen(file: File) {
    setFinanceFileName(file.name)

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      setFinanceStats({ months: 0, expRows: 0, incRows: 0 })
      return
    }

    // Read raw rows (2D array)
    const A: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    // Find header row by looking for the three static Hebrew columns
    const STATIC = ['קטגוריה ראשית', 'תת-קטגוריה', 'הוצאות']
    let headerRowIdx = -1
    let colIdx: Record<string, number> = {}
    for (let r = 0; r < Math.min(A.length, 30); r++) { // search first ~30 rows
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
      // couldn't find header row → show 0/0/0
      setFinanceStats({ months: 0, expRows: 0, incRows: 0 })
      return
    }

    // Build header names array
    const headers = A[headerRowIdx].map((v) => (v === null ? '' : String(v)))
    const idxMain = colIdx['קטגוריה ראשית']
    const idxSub = colIdx['תת-קטגוריה']
    const idxHotsaot = colIdx['הוצאות']

    // Month columns are everything except the 3 static ones, from the next row onward
    const monthColIdxs: number[] = []
    for (let c = 0; c < headers.length; c++) {
      if (c !== idxMain && c !== idxSub && c !== idxHotsaot) monthColIdxs.push(c)
    }

    // Normalize month headers → Date (Excel serial / Date / string)
    const monthKeys = monthColIdxs
      .map((c) => {
        const k = headers[c]
        // numeric? (Excel serial often appears as number in header row, but since headers[] are strings, parse)
        const asNum = Number(k)
        if (Number.isFinite(asNum) && asNum > 20000 && asNum < 60000) {
          const d = XLSX.SSF.parse_date_code(asNum)
          if (d) return { col: c, d: new Date(d.y, d.m - 1, d.d) }
        }
        // try parse as date string
        const d2 = new Date(k)
        if (!isNaN(+d2)) return { col: c, d: d2 }
        return null
      })
      .filter(Boolean) as { col: number; d: Date }[]

    if (monthKeys.length === 0) {
      // fallback: sometimes the header row holds empty month cells, and the next row has dates—try the next row
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

    // Rows start after headerRowIdx
    const dataRows = A.slice(headerRowIdx + 1)

    // Split rows similar to your Python iloc windows:
    // If your sheet always has expenses first and then income immediately after, keep 0..56, 57..67.
    // If not, we can detect income block by looking at the 'הוצאות' column value; for now stick to original split:
    const EXPENSES_CUTOFF = 57
    const INCOME_CUTOFF = 68

    const expenses_df = dataRows.slice(0, EXPENSES_CUTOFF)
    const income_df = dataRows.slice(EXPENSES_CUTOFF, INCOME_CUTOFF)

    const toCell = (row: any[], i: number) => (i >= 0 && i < row.length ? row[i] : null)

    // Melt expenses
    const eTime: SeriesRow[] = []
    for (const row of expenses_df) {
      const main = toCell(row, idxMain)
      const sub = toCell(row, idxSub)
      const hot = toCell(row, idxHotsaot)
      for (const { col, d } of monthKeys) {
        const val = Number(toCell(row, col))
        if (Number.isFinite(val) && val !== 0) {
          eTime.push({
            Month: new Date(d.setHours(0, 0, 0, 0)),
            Amount: val,
            'קטגוריה ראשית': main,
            'תת-קטגוריה': sub,
            'הוצאות': hot,
          })
        }
      }
    }

    // Melt income
    const iTime: SeriesRow[] = []
    for (const row of income_df) {
      const main = toCell(row, idxMain)
      const sub = toCell(row, idxSub)
      const hot = toCell(row, idxHotsaot)
      for (const { col, d } of monthKeys) {
        const val = Number(toCell(row, col))
        if (Number.isFinite(val) && val !== 0) {
          iTime.push({
            Month: new Date(d.setHours(0, 0, 0, 0)),
            Amount: val,
            'קטגוריה ראשית': main,
            'תת-קטגוריה': sub,
            'הוצאות': hot,
          })
        }
      }
    }

    // Group sums by Month
    const sumBy = (arr: SeriesRow[]) => {
      const map = new Map<number, number>()
      for (const r of arr) {
        const t = new Date(r.Month).setHours(0, 0, 0, 0)
        map.set(t, (map.get(t) ?? 0) + (r.Amount ?? 0))
      }
      return [...map.entries()].map(([t, Amount]) => ({ Month: new Date(t), Amount }))
    }

    const total_expenses = sumBy(eTime).map((r) => ({ Month: r.Month, 'Total Expenses': r.Amount }))
    const total_income = sumBy(iTime).map((r) => ({ Month: r.Month, 'Total Income': r.Amount }))

    // Merge on Month
    const keyBy = (d: Date) => new Date(d).toISOString().slice(0, 10)
    const merged = new Map<string, Partial<IncomeExpensesRow>>()
    for (const r of total_income) merged.set(keyBy(r.Month), { Month: r.Month, ['Total Income']: r['Total Income'] as any })
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

    setExpensesTime(eTime)
    setIncomeTime(iTime)
    setIncomeExpensesDF(finalIncExp)
    setFinanceStats({ months: monthKeys.length, expRows: eTime.length, incRows: iTime.length })

    // Default month → last month with data
    if (finalIncExp.length) {
      const last = finalIncExp.at(-1)!.Month
      const ym = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`
      setSelectedMonth(ym)
    }
  }

  async function loadFromSheet() {
    const rows = await fetchPortfolioCSV("https://docs.google.com/spreadsheets/d/e/2PACX-1vSltL3NxXUBQLwhaHW8Gist2I6qVRt8p3fPILBbEEXzcplzFMu8j0-K2JCJgj7hrTcoxCq-JUJN2v6j/pub?output=csv")
    setPortfolio(rows)
    setTotalValue(rows.reduce((a,b) => a + (b.value || b.qty*b.price || 0), 0))
  }

  async function loadFromSheetClick() {
    try {
      setPortfolioError(null)
      setLoadingPortfolio(true)
      const rows = await fetchPortfolioCSV(csvUrl)
      // normalize rows; accept alternative header capitalizations
      const norm = rows.map((r: any) => {
        const ticker = r.Ticker ?? r.ticker ?? ""
        const qty    = Number(r.Qty   ?? r.qty   ?? 0)
        const price  = Number(r.Price ?? r.price ?? 0)
        const value  = Number(r.Value ?? r.value ?? 0) || (qty * price)
        const name   = r.Name ?? r.name ?? ticker
        // prefer CSV's Category; else fallback to mapping by ticker (or name)
        const category = (r.Category ?? r.category) || categoryMap[ticker] || "Uncategorized"
        return { ticker, name, qty, price, value, category }
      })
      setPortfolio(norm)
      setTotalValue(norm.reduce((a,b)=> a + (b.value || 0), 0))
    } catch (e: any) {
      setPortfolioError(e?.message || String(e))
    } finally {
      setLoadingPortfolio(false)
    }
  }
  // Portfolio data
  const [includeLowRisk, setIncludeLowRisk] = React.useState<boolean>(true)
  // This will later combine CSV holdings + (optional) low-risk items from the Excel file
  const [lowRiskItems, setLowRiskItems] = React.useState<Array<{ticker:string; name:string; qty:number; price:number; value:number; category:string}>>([])
  const combinedPortfolio = React.useMemo(() => {
    // lowRiskItems will come from #2; define it above (starts empty):
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
  // Pie data
  const pieData = React.useMemo(() => {
    return combinedPortfolio
      .filter(p => (p.value || (p.qty*p.price)) > 0)
      .map(p => ({ name: p.name || p.ticker, value: p.value || (p.qty * p.price) }))
  }, [combinedPortfolio])

  // "האקסולידיית - גיליון מעקב ההוצאות של הסולידיית.xlsx"
  async function onFireExcelChosen(file: File) {
    setFireFileName(file.name)
    
    // header row was 5 (0-based) in pandas => 6 (1-based)
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets['מעקב שווי נקי'] ?? wb.Sheets[wb.SheetNames[0]]
    const df: Row[] = XLSX.utils.sheet_to_json(ws, { defval: null, header: 6 })

    // columns at positions [0, 11, 17]
    const rows = df.map((r: Row) => {
      const cols = Object.keys(r)
      return {
        Month: r[cols[0]],
        'Total Liquid Assets': r[cols[11]],
        'Total Non-Liquid Assets': r[cols[17]],
      }
    })

    const net = rows
      .map((r) => ({
        Month: toDate(r.Month),
        'Total Liquid Assets': toNumber(r['Total Liquid Assets']),
        'Total Non-Liquid Assets': toNumber(r['Total Non-Liquid Assets']),
      }))
      .filter((r) => r.Month && !isNaN(+r.Month))
      .map((r) => ({
        ...r,
        'Net Worth': (r['Total Liquid Assets'] ?? 0) + (r['Total Non-Liquid Assets'] ?? 0),
      }))
      .sort((a, b) => +new Date(a.Month) - +new Date(b.Month))

    // simple exponential projection like Python version
    const ord = (d: Date) => Math.floor(+d / (24 * 3600 * 1000))
    const recent = net.slice(-24).filter((r) => r['Net Worth'] > 0)
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

    const last = net.at(-1)?.Month ?? new Date()
    const lastRow = net.at(-1)
    const total = ((lastRow?.['Total Liquid Assets'] ?? 0) + (lastRow?.['Total Non-Liquid Assets'] ?? 0)) || 1
    const pL = (lastRow?.['Total Liquid Assets'] ?? 0) / total
    const pN = 1 - pL

    const future: Row[] = []
    for (let i = 1; i <= 12; i++) {
      const m = dayjs(last).add(i, 'month').startOf('month').toDate()
      const x = ord(m)
      const netWorth = Math.exp(intercept + slope * x)
      future.push({
        Month: m,
        'Total Liquid Assets': netWorth * pL,
        'Total Non-Liquid Assets': netWorth * pN,
        'Net Worth': netWorth,
        Type: 'Projected',
      })
    }

    const actual = net.map((r) => ({ ...r, Type: 'Actual' }))
    setNetWorthDF(actual)
    setCombinedNetWorthDF([...actual, ...future])
    // ---- Low-risk buckets from latest row (position-based, aligned with your totals) ----
    try {
      // df is from: XLSX.utils.sheet_to_json(ws, { defval: null, header: 6 })
      // Positions (0-based) according to your sheet:
      // 0 = Month
      // 1 = Cash (מזומן)
      // 2 = פקדונות, תכניות חיסכון, מק"מ וקרנות כספיות (MMF & Deposits)
      // 4 = מניות (Stocks)   -- we will NOT add this (to avoid double counting with CSV)
      // 10 = קריפטו (Crypto) -- we will NOT add this (to avoid double counting with CSV)
      // 11 = Total Liquid Assets
      // 17 = Total Non-Liquid Assets

      const headers = Object.keys(df[0] ?? {})
      // Optional sanity check:
      // console.log('Net Worth headers (by index):', headers.map((h, i) => `${i}:${h}`))

      const idxMonth   = 0
      const idxCash    = 1
      const idxMMF     = 2
      // const idxStocks  = 4   // not used here to avoid double count
      // const idxCrypto  = 10  // not used here to avoid double count
      // const idxLiquid  = 11  // (you already use these in your totals)
      // const idxNonLiq  = 17

      const key = (i: number) => headers[i]

      // pick the last row with a valid Month
      const lastRow = [...df].reverse().find((r: any) => {
        const d = toDate(r[key(idxMonth)])
        return d instanceof Date && !isNaN(+d)
      })

      if (lastRow) {
        const cash     = toNumber(lastRow[key(idxCash)] ?? 0)
        const deposits = toNumber(lastRow[key(idxMMF)]  ?? 0)

        const items: Array<{ticker:string; name:string; qty:number; price:number; value:number; category:string}> = []
        if (cash > 0)     items.push({ ticker: "CASH",         name: "Cash",                 qty: 1, price: cash,     value: cash,     category: "Cash" })
        if (deposits > 0) items.push({ ticker: "MMF+Deposits", name: "MMF & Deposits",       qty: 1, price: deposits, value: deposits, category: "Money Market & Deposits" })

        setLowRiskItems(items)
      } else {
        setLowRiskItems([])
      }
    } catch (e) {
      console.warn("Low-risk (position-based) extraction failed:", e)
      setLowRiskItems([])
    }
  }

  /** ---------- Compute FI when both datasets are present ---------- */
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

    // rolling 12-month Annual Expenses
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

  /** ---------- Derived datasets for charts ---------- */
  const monthlyData = React.useMemo(() => {
    // [{Month, Total Income, Total Expenses, Savings, Savings Rate}]
    return incomeExpensesDF.map((r) => ({
      month: dayjs(r.Month).format('YYYY-MM'),
      income: Math.round(r['Total Income'] ?? 0),
      expenses: Math.round(r['Total Expenses'] ?? 0),
      savings: Math.round((r['Total Income'] ?? 0) - (r['Total Expenses'] ?? 0)),
      savingsRate: Number(r['Savings Rate'] ?? 0),
    }))
  }, [incomeExpensesDF])

  // Expenses breakdown for selected month by 'הוצאות'
  const expensesData = React.useMemo(() => {
    if (!selectedMonth) return []
    const m = selectedMonth
    const monthRows = expensesTime.filter((r) => dayjs(r.Month).format('YYYY-MM') === m)
    const byCat = new Map<string, number>()
    for (const r of monthRows) {
      const k = r['הוצאות'] ?? 'אחר'
      byCat.set(k, (byCat.get(k) ?? 0) + (r.Amount ?? 0))
    }
    const palette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#F59E0B', '#34D399']
    return [...byCat.entries()].map(([category, amount], i) => ({ category, amount, color: palette[i % palette.length] }))
  }, [expensesTime, selectedMonth])

  // Savings over time
  const savingsSeries = React.useMemo(() => {
    if (!incomeExpensesDF.length) return []
    const rows = incomeExpensesDF
      .slice()
      .sort((a, b) => +a.Month - +b.Month)
      .map(r => ({
        month: dayjs(r.Month).format('YYYY-MM'),
        savings: Math.round((r['Total Income'] ?? 0) - (r['Total Expenses'] ?? 0))
      }))
    let cum = 0
    return rows.map(r => ({ ...r, cumulative: (cum += r.savings) }))
  }, [incomeExpensesDF])
  const totalCumulative = savingsSeries.at(-1)?.cumulative ?? 0
  const avgMonthly = savingsSeries.length
    ? Math.round(savingsSeries.reduce((a, b) => a + b.savings, 0) / savingsSeries.length)
    : 0
  

  const netWorthData = React.useMemo(() => {
    return netWorthDF.map((r) => ({
      month: dayjs(r.Month).format('YYYY-MM'),
      liquidAssets: Math.round(r['Total Liquid Assets'] ?? 0),
      nonLiquidAssets: Math.round(r['Total Non-Liquid Assets'] ?? 0),
      netWorth: Math.round(r['Net Worth'] ?? 0),
    }))
  }, [netWorthDF])

  const fiData = React.useMemo(() => {
    return fiProgressDF.map((r) => ({
      month: dayjs(r.Month).format('YYYY-MM'),
      fiRatio: r['FI Ratio'] ?? 0,
      fiProgress: r['Annual Expenses'] ? Math.min(((r['Net Worth'] ?? 0) / (r['Annual Expenses'] * 25)) * 100, 100) : 0,
    }))
  }, [fiProgressDF])

  /** ---------- UI bits ---------- */
  const StatCard = ({ title, value, change, icon: Icon, trend }: any) => (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {change && (
            <div className={`flex items-center mt-2 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
              {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span className="ml-1 text-sm font-medium">{change}</span>
            </div>
          )}
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

      <div className="max-w-7xl mx-auto px-6 py-8">
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
                  <StatCard title="Net Worth" value={`₪${(netWorthData.at(-1)?.netWorth ?? 0).toLocaleString()}`} icon={Wallet} />
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
              </div>

              {expensesData.length === 0 ? (
                <div className="text-gray-400">Load the expenses workbook and pick a month.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={expensesData}
                        cx="50%"
                        cy="50%"
                        outerRadius={160}
                        dataKey="amount"
                        nameKey="category"
                        label={(entry: any) => `${entry.category}: ₪${Math.round(entry.amount).toLocaleString()}`}
                      >
                        {expensesData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-4">
                    {expensesData.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: item.color }} />
                          <span className="font-medium">{item.category}</span>
                        </div>
                        <span className="text-white font-bold">₪{Math.round(item.amount).toLocaleString()}</span>
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
                {/* Top stats (optional; remove if you prefer) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-2">Cumulative Savings to Date</h3>
                    <div className="text-3xl font-extrabold">₪{totalCumulative.toLocaleString()}</div>
                    <p className="text-gray-400 mt-1 text-sm">
                      Sum of (Income − Expenses) across all months loaded
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-2">Average Monthly Savings</h3>
                    <div className="text-3xl font-extrabold">₪{avgMonthly.toLocaleString()}</div>
                    <p className="text-gray-400 mt-1 text-sm">
                      Mean of monthly savings, ignoring investment returns
                    </p>
                  </div>
                </div>

                {/* Cumulative Savings (line) */}
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

                {/* Monthly Savings (bar) */}
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
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-6">Net Worth Growth</h3>
            {!haveNetWorth ? (
              <div className="text-gray-400">Load the net worth workbook.</div>
            ) : (
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={netWorthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="liquidAssets" stroke="#10B981" strokeWidth={2} name="Liquid Assets" />
                  <Line type="monotone" dataKey="nonLiquidAssets" stroke="#F59E0B" strokeWidth={2} name="Non-Liquid Assets" />
                  <Line type="monotone" dataKey="netWorth" stroke="#3B82F6" strokeWidth={3} name="Total Net Worth" />
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

        {/* Portfolio Tab (placeholder until you wire live data) */}
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
                Tip: Columns should be <b>Ticker, Qty, Price, Value, Name</b>. Values should be in ILS if you want ILS charts.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h4 className="text-lg font-bold mb-4">Holdings by Value</h4>
                  <ResponsiveContainer width="100%" height={360}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={130}
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
                {/* Category Pie */}
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
                {/* Table */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 overflow-auto lg:col-span-2">
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
                        <th className="py-2 pr-0 text-right">% Weight</th>
                        <th className="py-2 pr-0 text-right">% Category</th>
                        
                      </tr>
                    </thead>
                    <tbody>
                      {combinedPortfolio.map((p, i) => {
                        const v = p.value || (p.qty * p.price)
                        const w = combinedTotal  ? (v / combinedTotal ) * 100 : 0
                        const catW = (categoryAgg.find(c => c.category === p.category)?.weight) ?? 0
                        return (
                          <tr key={i} className="border-top border-gray-700">
                            <td className="py-2 pr-4">{p.category || "Uncategorized"}</td>
                            <td className="py-2 pr-4">{p.name || p.ticker}</td>
                            <td className="py-2 pr-4">{p.ticker}</td>
                            <td className="py-2 pr-4 text-right">{p.qty.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-right">{fmtILS(p.price)}</td>
                            <td className="py-2 pr-4 text-right">{fmtILS(v)}</td>
                            <td className="py-2 pr-0 text-right">{w.toFixed(2)}%</td>
                            <td className="py-2 pr-0 text-right">{catW.toFixed(2)}%</td>
                          </tr>
                        )
                      })}
                      <tr className="border-t border-gray-700 font-semibold">
                        <td className="py-2 pr-4" colSpan={5}>Total</td>
                        <td className="py-2 pr-4 text-right">{fmtILS(combinedTotal)}</td>
                        <td className="py-2 pr-0 text-right">100.00%</td>
                        <td className="py-2 pr-0 text-right">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FinancialDashboard
