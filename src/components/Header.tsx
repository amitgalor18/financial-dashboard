import React from 'react';
import { PieChart as PieIcon, Wallet } from 'lucide-react';
import type { FinanceStats } from '../lib/types';

interface HeaderProps {
    onFinanceExcelChosen: (file: File) => void;
    financeFileName: string;
    financeStats: FinanceStats;
    onFireExcelChosen: (file: File) => void;
    fireFileName: string;
    handleExport: () => void;
    handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Header: React.FC<HeaderProps> = ({
    onFinanceExcelChosen,
    financeFileName,
    financeStats,
    onFireExcelChosen,
    fireFileName,
    handleExport,
    handleImport,
}) => {
    return (
        <>
            <div className="bg-gray-800 border-b border-gray-700">
              <div className="max-w-7xl mx-auto px-6 py-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  Financial Dashboard
                </h1>
                <p className="text-gray-400 mt-1">Track your financial journey to independence</p>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 pt-6">
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-800/60 p-3 ring-1 ring-slate-700">
                <div className="text-sm opacity-80">Load Excel files:</div>
      
                <label className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 cursor-pointer">
                  <PieIcon size={16} />
                  <span>Expenses/Income</span>
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
                {financeFileName && <span className="text-xs text-slate-300">Loaded: {financeFileName} ({financeStats.months}m, {financeStats.expRows} exp, {financeStats.incRows} inc)</span>}
      
                <label className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 cursor-pointer">
                  <Wallet size={16} />
                  <span>Net Worth</span>
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
                
                <div className="flex-grow"></div>

                <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 cursor-pointer text-sm">
                  Export
                </button>
                <label className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 cursor-pointer text-sm">
                  Import
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
                <div className="w-full md:w-auto text-xs text-slate-400 text-center md:text-right mt-2 md:mt-0">
                  Files are processed locally; nothing is uploaded.
                </div>
              </div>
            </div>
        </>
    )
}

