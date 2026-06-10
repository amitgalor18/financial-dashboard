import React from 'react';
import dayjs from 'dayjs';
import { useFinancialData } from './hooks/useFinancialData';

// Import Modals (already exist in your project)
import { PortfolioEditModal } from './PortfolioEditModal';
import { NetWorthEditModal } from './NetWorthEditModal';
import { ExpensesEditModal } from './ExpensesEditModal';

// Import New Components
import { Header } from './components/Header';
import { DashboardTabs } from './components/DashboardTabs';
import { OverviewTab } from './tabs/OverviewTab';
import { ExpensesTab } from './tabs/ExpensesTab';
import { ExpenseTrendsTab } from './tabs/ExpenseTrendsTab';
import { SavingsTab } from './tabs/SavingsTab';
import { NetWorthTab } from './tabs/NetWorthTab';
import { PortfolioTab } from './tabs/PortfolioTab';
import { FireTab } from './tabs/FireTab';

const FinancialDashboard: React.FC = () => {
    const {
        // State and derived data
        expensesTime, incomeExpensesDF, netWorthDF, portfolio, fiProgressDF,
        activeTab, selectedMonth, financeFileName, fireFileName, csvUrl,
        loadingPortfolio, portfolioError, apiKey, loadingPrices, unmappedTickers,
        financeStats, includeLowRisk, lowRiskItems, isExpenseModalOpen,
        isNetWorthModalOpen, isPortfolioModalOpen, editingNetWorthRow,
        editingPortfolioItem, monthlyItems, editingMonth, expenseSchema,

        // Setters and handlers
        setActiveTab, setSelectedMonth, setCsvUrl, setIncludeLowRisk,
        onFinanceExcelChosen, onFireExcelChosen, handleApiKeyChange,
        loadFromSheetClick, fetchLivePrices, handleSaveExpenseChanges,
        handleSavePortfolioItem, handleRemovePortfolioItem,
        handleSaveNetWorthChanges, handleOpenEditMonthModal,
        handleOpenAddMonthModal, handleOpenEditNetWorthModal,
        handleOpenAddNetWorthModal,         handleExport, handleImport, loadDemoData,
        setIsExpenseModalOpen, setIsNetWorthModalOpen, setIsPortfolioModalOpen,
        setEditingPortfolioItem,
    } = useFinancialData();

    // Derived datasets for charts
    const monthlyData = React.useMemo(() => incomeExpensesDF.map((r) => ({
        month: dayjs(r.Month).format('YYYY-MM'),
        income: Math.round(r['Total Income'] ?? 0),
        expenses: Math.round(r['Total Expenses'] ?? 0),
        savings: Math.round((r['Total Income'] ?? 0) - (r['Total Expenses'] ?? 0)),
        savingsRate: Number(r['Savings Rate'] ?? 0),
    })), [incomeExpensesDF]);

    const savingsSeries = React.useMemo(() => {
        if (!incomeExpensesDF.length) return [];
        let cum = 0;
        return incomeExpensesDF.slice().sort((a, b) => +a.Month - +b.Month).map(r => {
            const savings = Math.round((r['Total Income'] ?? 0) - (r['Total Expenses'] ?? 0));
            cum += savings;
            return {
                month: dayjs(r.Month).format('YYYY-MM'),
                savings,
                savingsRate: r['Savings Rate'],
                cumulative: cum,
            };
        });
    }, [incomeExpensesDF]);
    
    const netWorthData = React.useMemo(() => {
      const out = netWorthDF.map(row => ({
        month: dayjs(row.Month).format('MMM YYYY'),
        'Total Liquid Assets': row.Type === 'Actual' ? row['Total Liquid Assets'] : null,
        'Total Non-Liquid Assets': row.Type === 'Actual' ? row['Total Non-Liquid Assets'] : null,
        'Total Debt': row.Type === 'Actual' ? row['Total Debt'] : null,
        'Net Worth': row.Type === 'Actual' ? row['Net Worth'] : null,
        'Projected Total Liquid Assets': row['Projected Total Liquid Assets'],
        'Projected Total Non-Liquid Assets': row['Projected Total Non-Liquid Assets'],
        'Projected Total Debt': row['Projected Total Debt'],
        'Projected Net Worth': row['Projected Net Worth'],
      }));
      // #region agent log
      const projNonNull = out.filter(r => r['Projected Net Worth'] != null && !Number.isNaN(Number(r['Projected Net Worth']))).length;
      fetch('http://127.0.0.1:7243/ingest/dd25555d-10f7-4c18-9556-f18f33aa0e3c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FinancialDashboard.tsx:netWorthData',message:'Chart data',data:{netWorthDFLen:netWorthDF.length,outLen:out.length,projNonNull},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return out;
    }, [netWorthDF]);

    const fiData = React.useMemo(() => fiProgressDF.map((r) => ({
        month: dayjs(r.Month).format('YYYY-MM'),
        fiRatio: r['FI Ratio'] ?? 0,
        fiProgress: r['Annual Expenses'] ? Math.min(((r['Net Worth'] ?? 0) / (r['Annual Expenses'] * 25)) * 100, 100) : 0,
    })), [fiProgressDF]);
    
    const combinedPortfolio = React.useMemo(() => {
        return includeLowRisk ? [...portfolio, ...lowRiskItems] : portfolio;
    }, [portfolio, lowRiskItems, includeLowRisk]);

    const combinedTotal = React.useMemo(
        () => combinedPortfolio.reduce((a, b) => a + (b.value || b.qty * b.price || 0), 0),
        [combinedPortfolio]
    );

    const categoryAgg = React.useMemo(() => {
        const m = new Map<string, number>();
        for (const p of combinedPortfolio) {
            const v = p.value || (p.qty * p.price) || 0;
            const cat = p.category || "Uncategorized";
            m.set(cat, (m.get(cat) ?? 0) + v);
        }
        return [...m.entries()]
            .map(([category, value]) => ({ category, value, weight: combinedTotal ? (value / combinedTotal) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);
    }, [combinedPortfolio, combinedTotal]);

    const pieData = React.useMemo(() => combinedPortfolio
        .filter(p => (p.value || (p.qty * p.price)) > 0)
        .map(p => ({ name: p.name || p.ticker, value: p.value || (p.qty * p.price) })), 
    [combinedPortfolio]);

    const totalCumulative = savingsSeries.at(-1)?.cumulative ?? 0;
    const avgMonthly = savingsSeries.length ? Math.round(savingsSeries.reduce((a, b) => a + b.savings, 0) / savingsSeries.length) : 0;
    const avgSavingsRate = savingsSeries.length ? savingsSeries.reduce((a, b) => a + b.savingsRate, 0) / savingsSeries.length : 0;

    const haveFinance = incomeExpensesDF.length > 0;
    const haveNetWorth = netWorthDF.length > 0;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab monthlyData={monthlyData} netWorthData={netWorthData} haveFinance={haveFinance} haveNetWorth={haveNetWorth} loadDemoData={loadDemoData} />;
            case 'expenses':
                return <ExpensesTab expensesTime={expensesTime} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} handleOpenEditMonthModal={handleOpenEditMonthModal} handleOpenAddMonthModal={handleOpenAddMonthModal} />;
            case 'trends':
                return <ExpenseTrendsTab expensesTime={expensesTime} />;
            case 'savings':
                return <SavingsTab savingsSeries={savingsSeries} totalCumulative={totalCumulative} avgMonthly={avgMonthly} avgSavingsRate={avgSavingsRate} />;
            case 'networth':
                return <NetWorthTab netWorthData={netWorthData} haveNetWorth={haveNetWorth} handleOpenEditNetWorthModal={handleOpenEditNetWorthModal} handleOpenAddNetWorthModal={handleOpenAddNetWorthModal} />;
            case 'portfolio':
                return <PortfolioTab csvUrl={csvUrl} setCsvUrl={setCsvUrl} loadFromSheetClick={loadFromSheetClick} loadingPortfolio={loadingPortfolio} portfolioError={portfolioError} combinedTotal={combinedTotal} apiKey={apiKey} handleApiKeyChange={handleApiKeyChange} fetchLivePrices={fetchLivePrices} loadingPrices={loadingPrices} unmappedTickers={unmappedTickers} includeLowRisk={includeLowRisk} setIncludeLowRisk={setIncludeLowRisk} portfolio={portfolio} pieData={pieData} categoryAgg={categoryAgg} combinedPortfolio={combinedPortfolio} setEditingPortfolioItem={setEditingPortfolioItem} setIsPortfolioModalOpen={setIsPortfolioModalOpen} handleRemovePortfolioItem={handleRemovePortfolioItem} />;
            case 'fire':
                return <FireTab fiData={fiData} />;
            default:
                return null;
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Header
                onFinanceExcelChosen={onFinanceExcelChosen}
                financeFileName={financeFileName}
                financeStats={financeStats}
                onFireExcelChosen={onFireExcelChosen}
                fireFileName={fireFileName}
                handleExport={handleExport}
                handleImport={handleImport}
            />
            <DashboardTabs activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="max-w-7xl mx-auto px-6 py-8">
                {renderTabContent()}
            </main>

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
};

export default FinancialDashboard;

