import React from 'react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import type {
  Row,
  SeriesRow,
  IncomeExpensesRow,
  DetailedNetWorthRow,
  PortfolioItem,
  FinanceStats,
} from '../lib/types';
import {
  toNumber,
  toDate,
  fetchPortfolioCSV,
  normalizeTicker,
  calculateProjections,
  logDataDifference
} from '../lib/utils';

// Maps your spreadsheet tickers (keys) to the correct API tickers (values).
const tickerApiMap: Record<string, string> = {
    'ISFF301': 'iSFF301.TA', 'ISFF702': 'ISFF702.TA', 'ISFF101': 'iSFF101.TA',
    'ISFF701': 'IS-FF701.TA', 'ISFF505': 'ISFF505.TA', 'ISFF102': 'IS-FF102.TA',
    'INFF1': 'IN-FF1.TA', 'INFF7': 'IN-FF7.TA', 'TEVA': 'TEVA.TA',
    'BTC': 'BTC-USD', 'NVDA': 'NVDA', 'AAPL': 'AAPL', 'MSFT': 'MSFT',
    'GOOGL': 'GOOGL', 'AMZN': 'AMZN', 'TSLA': 'TSLA', 'META': 'META',
    'VADFX': 'VADFX', 'VBISX': 'VBISX', 'ILS=X': 'ILS=X',
};

// Optional: per-ticker category map (used only when CSV has no Category column)
const categoryMap: Record<string, string> = {
    "IS-FF301.TA": "Stocks", "IS.FF301": "Stocks", "BTC": "Crypto",
};


export const useFinancialData = () => {
  // State for Expenses/Income
  const [expensesTime, setExpensesTime] = React.useState<SeriesRow[]>([]);
  const [incomeTime, setIncomeTime] = React.useState<SeriesRow[]>([]);
  const [incomeExpensesDF, setIncomeExpensesDF] = React.useState<IncomeExpensesRow[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = React.useState<boolean>(false);
  const [editingMonth, setEditingMonth] = React.useState<string>('');
  const [monthlyItems, setMonthlyItems] = React.useState<{ expenses: SeriesRow[]; income: SeriesRow[] }>({ expenses: [], income: [] });
  const [expenseSchema, setExpenseSchema] = React.useState<{ expenses: any[]; income: any[] }>({ expenses: [], income: [] });

  // State for Net Worth
  const [netWorthDF, setNetWorthDF] = React.useState<DetailedNetWorthRow[]>([]);
  const [isNetWorthModalOpen, setIsNetWorthModalOpen] = React.useState<boolean>(false);
  const [editingNetWorthRow, setEditingNetWorthRow] = React.useState<DetailedNetWorthRow | null>(null);

  // State for Portfolio
  const [portfolio, setPortfolio] = React.useState<PortfolioItem[]>([]);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = React.useState<boolean>(false);
  const [editingPortfolioItem, setEditingPortfolioItem] = React.useState<PortfolioItem | null>(null);

  // General & API State
  const [fiProgressDF, setFiProgressDF] = React.useState<Row[]>([]);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'expenses' | 'savings' | 'networth' | 'portfolio' | 'fire'>('overview');
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [financeFileName, setFinanceFileName] = React.useState<string>('');
  const [fireFileName, setFireFileName] = React.useState<string>('');
  const [csvUrl, setCsvUrl] = React.useState<string>("");
  const [loadingPortfolio, setLoadingPortfolio] = React.useState<boolean>(false);
  const [portfolioError, setPortfolioError] = React.useState<string | null>(null);
  const [apiKey, setApiKey] = React.useState<string>('');
  const [loadingPrices, setLoadingPrices] = React.useState<boolean>(false);
  const [unmappedTickers, setUnmappedTickers] = React.useState<string[]>([]);
  const [financeStats, setFinanceStats] = React.useState<FinanceStats>({ months: 0, expRows: 0, incRows: 0 });
  const [includeLowRisk, setIncludeLowRisk] = React.useState<boolean>(true);
  const [lowRiskItems, setLowRiskItems] = React.useState<PortfolioItem[]>([]);

  /** ---------- DATA RECALCULATION LOGIC (EFFECTS) ---------- */
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

  React.useEffect(() => {
    if (expensesTime.length > 0) {
      const lastDate = expensesTime.reduce((latest, current) =>
        current.Month > latest ? current.Month : latest, expensesTime[0].Month);
      setSelectedMonth(dayjs(lastDate).format('YYYY-MM'));
    }
  }, [expensesTime]);

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

    React.useEffect(() => {
    const savedKey = localStorage.getItem('finnhubApiKey');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  /** ---------- HANDLERS ---------- */

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('finnhubApiKey', newKey);
  };
  
  const onFinanceExcelChosen = async (file: File) => {
    setFinanceFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return;

    const A: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const toCell = (row: any[], i: number) => (i >= 0 && i < row.length ? row[i] : null);

    const STATIC = ['קטגוריה ראשית', 'תת-קטגוריה', 'הוצאות'];
    let headerRowIdx = -1;
    let colIdx: Record<string, number> = {};
    for (let r = 0; r < Math.min(A.length, 30); r++) {
      const row = A[r] || [];
      const hits: Record<string, number> = {};
      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] ?? '').toString().trim();
        if (STATIC.includes(cell)) hits[cell] = c;
      }
      if (Object.keys(hits).length === STATIC.length) {
        headerRowIdx = r;
        colIdx = hits;
        break;
      }
    }
    if (headerRowIdx === -1) { return; }
    const headers = A[headerRowIdx].map((v) => (v === null ? '' : String(v)));
    const idxMain = colIdx['קטגוריה ראשית'];
    const idxSub = colIdx['תת-קטגוריה'];
    const idxHotsaot = colIdx['הוצאות'];
    const monthColIdxs: number[] = [];
    for (let c = 0; c < headers.length; c++) {
      if (c !== idxMain && c !== idxSub && c !== idxHotsaot) monthColIdxs.push(c);
    }

    const monthKeys = monthColIdxs
      .map((c) => {
        const k = headers[c];
        const asNum = Number(k);
        if (Number.isFinite(asNum) && asNum > 20000 && asNum < 60000) {
          const d = XLSX.SSF.parse_date_code(asNum);
          if (d) return { col: c, d: new Date(d.y, d.m - 1, d.d) };
        }
        const d2 = new Date(k);
        if (!isNaN(+d2)) return { col: c, d: d2 };
        return null;
      })
      .filter(Boolean) as { col: number; d: Date }[];

    if (monthKeys.length === 0) {
      const next = A[headerRowIdx + 1] || [];
      for (const c of monthColIdxs) {
        const v = next[c];
        if (v == null) continue;
        if (typeof v === 'number') {
          const d = XLSX.SSF.parse_date_code(v);
          if (d) monthKeys.push({ col: c, d: new Date(d.y, d.m - 1, d.d) });
        } else {
          const d2 = new Date(v);
          if (!isNaN(+d2)) monthKeys.push({ col: c, d: d2 });
        }
      }
    }

    const dataRows = A.slice(headerRowIdx + 1);

    const processRows = (rowsToProcess: any[][]) => {
      const timeSeries: SeriesRow[] = [];
      const schema = new Map<string, { main: string; sub: string }>();
      let lastMainCategory = '';
      let lastSubCategory = '';

      for (const row of rowsToProcess) {
        const main = toCell(row, idxMain);
        const sub = toCell(row, idxSub);
        const expenseName = toCell(row, idxHotsaot);

        if (main) lastMainCategory = main;
        if (sub) lastSubCategory = sub;
        if (!expenseName) continue;

        if (expenseName && !schema.has(expenseName)) {
          schema.set(expenseName, { main: lastMainCategory, sub: lastSubCategory });
        }

        for (const { col, d } of monthKeys) {
          const val = Number(toCell(row, col));
          if (Number.isFinite(val) && val !== 0) {
            timeSeries.push({
              Month: new Date(d.setHours(0, 0, 0, 0)),
              Amount: val,
              'קטגוריה ראשית': lastMainCategory,
              'תת-קטגוריה': lastSubCategory,
              'הוצאות': expenseName,
            });
          }
        }
      }
      return { timeSeries, schema: Array.from(schema.entries()).map(([expense, cats]) => ({ expense, ...cats })) };
    };

    const EXPENSES_CUTOFF = 57;
    const INCOME_CUTOFF = 68;

    const expenseResult = processRows(dataRows.slice(0, EXPENSES_CUTOFF));
    const incomeResult = processRows(dataRows.slice(EXPENSES_CUTOFF, INCOME_CUTOFF));

    setExpensesTime(expenseResult.timeSeries);
    setIncomeTime(incomeResult.timeSeries);
    setExpenseSchema({ expenses: expenseResult.schema, income: incomeResult.schema });
    setFinanceStats({
      months: monthKeys.length,
      expRows: expenseResult.timeSeries.length,
      incRows: incomeResult.timeSeries.length,
    });
  }

  const onFireExcelChosen = async (file: File) => {
    setFireFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets['מעקב שווי נקי'] ?? wb.Sheets[wb.SheetNames[0]];
    const df: Row[] = XLSX.utils.sheet_to_json(ws, { defval: null, header: 6 });

    const detailedNet = df.map((r: Row) => {
      const cols = Object.keys(r);
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
      const otherNonLiquid = toNumber(r[cols[16]]);
      const mortgage = Math.abs(toNumber(r[cols[25]]));
      const loans = Math.abs(toNumber(r[cols[19]]));
      const creditCardDebt = Math.abs(toNumber(r[cols[18]]));

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
        'Total Debt': totalDebt,
        'Net Worth': netWorth,
      };
    })
    .filter((r) => r.Month && !isNaN(+r.Month))
    .sort((a, b) => +new Date(a.Month) - +new Date(b.Month));

    const newCombinedData = calculateProjections(detailedNet);
    setNetWorthDF(newCombinedData);
    extractLowRiskItems(df);
  }

  const loadFromSheetClick = async () => {
    try {
      setPortfolioError(null);
      setLoadingPortfolio(true);
      const rows = await fetchPortfolioCSV(csvUrl);
      const norm = rows.map((r: any) => {
        const ticker = r.Ticker ?? r.ticker ?? "";
        const qty = Number(r.Qty ?? r.qty ?? 0);
        const price = Number(r.Price ?? r.price ?? 0);
        const value = Number(r.Value ?? r.value ?? 0) || (qty * price);
        const name = r.Name ?? r.name ?? ticker;
        const category = (r.Category ?? r.category) || categoryMap[ticker] || "Uncategorized";
        return { ticker, name, qty, price, value, category };
      });
      setPortfolio(norm);
    } catch (e: any) {
      setPortfolioError(e?.message || String(e));
    } finally {
      setLoadingPortfolio(false);
    }
  }

  const fetchLivePrices = async () => {
      if (!apiKey) {
        alert("Please enter your EODHD API key.");
        return;
      }
      if (portfolio.length === 0) return;

      setLoadingPrices(true);
      setPortfolioError(null);
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
              
              const endpoint = `https://financial-dashboard-dygbnb6sz-amitgalor18-2075s-projects.vercel.app/api/get-prices?ticker=${symbolForApi}&apiKey=${apiKey}`;
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

  const handleSaveExpenseChanges = (updatedItems: { expenses: SeriesRow[]; income: SeriesRow[] }) => {
    setExpensesTime(prev => [
      ...prev.filter(r => dayjs(r.Month).format('YYYY-MM') !== editingMonth),
      ...updatedItems.expenses,
    ]);
    setIncomeTime(prev => [
      ...prev.filter(r => dayjs(r.Month).format('YYYY-MM') !== editingMonth),
      ...updatedItems.income,
    ]);
    setIsExpenseModalOpen(false);
  };

  const handleSavePortfolioItem = (itemToSave: PortfolioItem) => {
    const isEditing = portfolio.some(p => p.ticker === itemToSave.ticker);
    setPortfolio(prev => {
      if (isEditing) {
        const existingPrice = prev.find(p => p.ticker === itemToSave.ticker)?.price ?? 0;
        const finalItem = { ...itemToSave, price: existingPrice, value: itemToSave.qty * existingPrice };
        return prev.map(p => p.ticker === finalItem.ticker ? finalItem : p);
      } else {
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
    logDataDifference("Comparing initial state with final state", netWorthDF, netWorthDF);
    
    const totalLiquid = updatedRow.Cash + updatedRow.MMF + updatedRow.Bonds + updatedRow.Stocks + updatedRow.Hishtalmut + updatedRow.ProvFund + updatedRow.RealEstateInv + updatedRow.Crypto;
    const totalNonLiquid = updatedRow.Pension + updatedRow.Car + updatedRow.Residence + updatedRow.OtherNonLiquid;
    const totalDebt = updatedRow.Mortgage + updatedRow.Loans + updatedRow.CreditCardDebt;
    const netWorth = totalLiquid + totalNonLiquid - totalDebt;

    const finalRow: DetailedNetWorthRow = {
      ...updatedRow,
      'Total Liquid Assets': totalLiquid, 'Total Non-Liquid Assets': totalNonLiquid,
      'Total Debt': totalDebt, 'Net Worth': netWorth, Type: 'Actual',
    };

    const currentActualData = netWorthDF.filter(row => row.Type !== 'Projected');
    const monthExists = currentActualData.some(row => dayjs(row.Month).isSame(dayjs(finalRow.Month), 'month'));

    let nextActualData;
    if (monthExists) {
      nextActualData = currentActualData.map(row => dayjs(row.Month).isSame(dayjs(finalRow.Month), 'month') ? finalRow : row);
    } else {
      nextActualData = [...currentActualData, finalRow];
    }
    nextActualData.sort((a, b) => +new Date(a.Month) - +new Date(b.Month));

    const newCombinedData = calculateProjections(nextActualData);
    setNetWorthDF(newCombinedData);

    setIsNetWorthModalOpen(false);
    setEditingNetWorthRow(null);
  };

  const handleOpenEditMonthModal = () => {
    if (!selectedMonth) {
      alert("Please select a month to edit.");
      return;
    }
    setEditingMonth(selectedMonth);
    setMonthlyItems({
      expenses: expensesTime.filter(r => dayjs(r.Month).format('YYYY-MM') === selectedMonth),
      income: incomeTime.filter(r => dayjs(r.Month).format('YYYY-MM') === selectedMonth),
    });
    setIsExpenseModalOpen(true);
  };

  const handleOpenAddMonthModal = () => {
    const newMonthStr = prompt("Enter new month to add (YYYY-MM):", dayjs().add(1, 'month').format('YYYY-MM'));
    if (!newMonthStr || !/^\d{4}-\d{2}$/.test(newMonthStr)) {
      if (newMonthStr) alert("Invalid format. Please use YYYY-MM.");
      return;
    }
    const monthExists = expensesTime.some(r => dayjs(r.Month).format('YYYY-MM') === newMonthStr);
    if (monthExists) {
      alert(`Data for ${newMonthStr} already exists. Please use the 'Edit This Month' button to make changes.`);
      return;
    }
    setEditingMonth(newMonthStr);
    const newMonthDate = dayjs(newMonthStr).toDate();

    const newExpenses = expenseSchema.expenses.map(schemaItem => ({
      Month: newMonthDate, Amount: 0,
      'קטגוריה ראשית': schemaItem.main, 'תת-קטגוריה': schemaItem.sub, 'הוצאות': schemaItem.expense,
    }));
    const newIncome = expenseSchema.income.map(schemaItem => ({
      Month: newMonthDate, Amount: 0,
      'קטגוריה ראשית': schemaItem.main, 'תת-קטגוריה': schemaItem.sub, 'הוצאות': schemaItem.expense,
    }));

    setMonthlyItems({ expenses: newExpenses, income: newIncome });
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditNetWorthModal = () => {
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
  };

  const handleOpenAddNetWorthModal = () => {
    const newMonthStr = prompt("Enter new month to add (YYYY-MM):", dayjs().add(1, 'month').format('YYYY-MM'));
    if (!newMonthStr || !/^\d{4}-\d{2}$/.test(newMonthStr)) {
      if (newMonthStr) alert("Invalid format. Please use YYYY-MM.");
      return;
    }
    const actualDataOnly = netWorthDF.filter(r => r.Type !== 'Projected');
    const monthExists = actualDataOnly.some(r => dayjs(r.Month).format('YYYY-MM') === newMonthStr);
    if (monthExists) {
      alert(`Data for ${newMonthStr} already exists. Please use the 'Edit Month' button.`);
      return;
    }
    const lastKnownRow = actualDataOnly.length > 0 ? actualDataOnly[actualDataOnly.length - 1] : null;
    const newRow: DetailedNetWorthRow = {
      ...(lastKnownRow || { Cash: 0, MMF: 0, Bonds: 0, Stocks: 0, Hishtalmut: 0, ProvFund: 0, RealEstateInv: 0, Crypto: 0, Pension: 0, Car: 0, Residence: 0, OtherNonLiquid: 0, Mortgage: 0, Loans: 0, CreditCardDebt: 0 }),
      Month: dayjs(newMonthStr).toDate(),
      'Total Liquid Assets': null, 'Total Non-Liquid Assets': null, 'Total Debt': null, 'Net Worth': null, Type: 'Actual',
      'Projected Total Liquid Assets': null, 'Projected Total Non-Liquid Assets': null, 'Projected Total Debt': null, 'Projected Net Worth': null,
    };
    setEditingNetWorthRow(newRow);
    setIsNetWorthModalOpen(true);
  };

  const extractLowRiskItems = (fullNetWorthData: Row[]) => {
    try {
      if (!fullNetWorthData || fullNetWorthData.length === 0) {
        setLowRiskItems([]);
        return;
      }
      const headers = Object.keys(fullNetWorthData[0] ?? {});
      const lastRow = [...fullNetWorthData].reverse().find((r: any) => {
        const d = toDate(r[headers[0]]);
        return d instanceof Date && !isNaN(+d);
      });
      if (lastRow) {
        const cash = toNumber(lastRow[headers[1]] ?? 0);
        const deposits = toNumber(lastRow[headers[2]] ?? 0);
        const items: PortfolioItem[] = [];
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

  const handleExport = () => {
    if (!incomeExpensesDF.length || !netWorthDF.length) {
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

      const importedNetWorth = parseDates(importedState.data.netWorthDF, 'Month').filter((r: DetailedNetWorthRow) => r.Type !== 'Projected');
      
      setExpensesTime(parseDates(importedState.data.expensesTime, 'Month'));
      setIncomeTime(parseDates(importedState.data.incomeTime, 'Month'));
      setPortfolio(importedState.data.portfolio || []);
      
      const nextCombinedData = calculateProjections(importedNetWorth);
      setNetWorthDF(nextCombinedData);
      
      setExpenseSchema(importedState.data.expenseSchema || { expenses: [], income: [] });
      setFinanceFileName(importedState.data.financeFileName || 'Loaded from JSON');
      setFireFileName(importedState.data.fireFileName || 'Loaded from JSON');

      e.target.value = '';
      alert("Dashboard state imported successfully!");

    } catch (err: any) {
      alert(`Error importing file: ${err.message}`);
    }
  };

  return {
    // State
    expensesTime, incomeTime, incomeExpensesDF, isExpenseModalOpen, editingMonth,
    monthlyItems, expenseSchema, netWorthDF, isNetWorthModalOpen, editingNetWorthRow,
    portfolio, isPortfolioModalOpen, editingPortfolioItem, fiProgressDF, activeTab,
    selectedMonth, financeFileName, fireFileName, csvUrl, loadingPortfolio,
    portfolioError, apiKey, loadingPrices, unmappedTickers, financeStats,
    includeLowRisk, lowRiskItems,

    // Setters & Handlers
    setIsExpenseModalOpen, setEditingMonth, setMonthlyItems, setIsNetWorthModalOpen,
    setEditingNetWorthRow, setIsPortfolioModalOpen, setEditingPortfolioItem, setActiveTab,
    setSelectedMonth, setCsvUrl, setIncludeLowRisk,
    onFinanceExcelChosen, onFireExcelChosen, handleApiKeyChange, loadFromSheetClick,
    fetchLivePrices, handleSaveExpenseChanges, handleSavePortfolioItem, handleRemovePortfolioItem,
    handleSaveNetWorthChanges, handleOpenEditMonthModal, handleOpenAddMonthModal,
    handleOpenEditNetWorthModal, handleOpenAddNetWorthModal, handleExport, handleImport,
  };
};

