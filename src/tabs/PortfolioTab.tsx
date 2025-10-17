import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import type { PortfolioItem } from '../lib/types';
import { fmtILS } from '../lib/utils';

interface PortfolioTabProps {
    csvUrl: string;
    setCsvUrl: (url: string) => void;
    loadFromSheetClick: () => void;
    loadingPortfolio: boolean;
    portfolioError: string | null;
    combinedTotal: number;
    apiKey: string;
    handleApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fetchLivePrices: () => void;
    loadingPrices: boolean;
    unmappedTickers: string[];
    includeLowRisk: boolean;
    setIncludeLowRisk: (include: boolean) => void;
    portfolio: PortfolioItem[];
    pieData: any[];
    categoryAgg: any[];
    combinedPortfolio: PortfolioItem[];
    setEditingPortfolioItem: (item: PortfolioItem | null) => void;
    setIsPortfolioModalOpen: (isOpen: boolean) => void;
    handleRemovePortfolioItem: (ticker: string) => void;
}

export const PortfolioTab: React.FC<PortfolioTabProps> = ({
    csvUrl, setCsvUrl, loadFromSheetClick, loadingPortfolio, portfolioError,
    combinedTotal, apiKey, handleApiKeyChange, fetchLivePrices, loadingPrices,
    unmappedTickers, includeLowRisk, setIncludeLowRisk, portfolio, pieData,
    categoryAgg, combinedPortfolio, setEditingPortfolioItem,
    setIsPortfolioModalOpen, handleRemovePortfolioItem
}) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    {portfolioError && <div className="mt-3 text-sm rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-3 py-2">{portfolioError}</div>}
                    {combinedTotal > 0 && <div className="mt-4 text-sm text-slate-300">Total portfolio value: <span className="font-semibold">₪{Math.round(combinedTotal).toLocaleString()}</span></div>}
                </div>

                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-4">Live Price Refresh (EODHD)</h3>
                    <div className="flex flex-col md:flex-row gap-3">
                        <input
                            type="password"
                            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
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
                </div>
            </div>

            {unmappedTickers.length > 0 && (
                <div className="mt-4 text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 px-4 py-3">
                    <h4 className="font-bold mb-2">Warning: Unmapped Tickers Found</h4>
                    <p className="mb-2">The following tickers could not be updated:</p>
                    <ul className="list-disc pl-5 font-mono">{unmappedTickers.map(t => <li key={t}>{t}</li>)}</ul>
                    <p className="mt-2">To fix this, add them to the `tickerApiMap` in `useFinancialData.ts`.</p>
                </div>
            )}

            <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={includeLowRisk}
                        onChange={(e) => setIncludeLowRisk(e.target.checked)}
                    />
                    Include low-risk buckets from Net Worth file
                </label>
            </div>

            {portfolio.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-gray-300">
                    Paste your Google Sheets **published CSV** URL above and click **Load**.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h4 className="text-lg font-bold mb-4">Holdings by Value</h4>
                        <ResponsiveContainer width="100%" height={420}>
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={(e: any) => `${e.name}: ${fmtILS(e.value)}`}>
                                    {pieData.map((_, i) => <Cell key={i} fill={['#4F46E5','#10B981','#F59E0B','#EF4444','#6366F1','#14B8A6','#84CC16','#06B6D4','#A855F7'][i % 9]} />)}
                                </Pie>
                                <Tooltip content={({ active, payload }) => {
                                    if (active && payload?.length) {
                                        return <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl"><p className="text-white font-medium">{payload[0].name}</p><p className="text-gray-300">{fmtILS(Number(payload[0].value || 0))}</p></div>
                                    } return null
                                }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h4 className="text-lg font-bold mb-4">Allocation by Category</h4>
                        <ResponsiveContainer width="100%" height={360}>
                            <PieChart>
                                <Pie data={categoryAgg} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={130} label={(e: any) => `${e.category}: ₪${Math.round(e.value).toLocaleString()} (${e.weight.toFixed(1)}%)`}>
                                    {categoryAgg.map((_, i) => <Cell key={i} fill={['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#84CC16', '#06B6D4', '#A855F7'][i % 9]} />)}
                                </Pie>
                                <Tooltip content={({ active, payload }) => {
                                    if (active && payload?.length) {
                                        const p = payload[0].payload;
                                        return <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl"><p className="text-white font-medium">{p.category}</p><p className="text-gray-300">₪{Math.round(p.value).toLocaleString()} ({p.weight.toFixed(2)}%)</p></div>
                                    } return null
                                }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 overflow-auto lg:col-span-2">
                        <div className="flex justify-end mb-4">
                            <button onClick={() => { setEditingPortfolioItem(null); setIsPortfolioModalOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 hover:bg-green-500">
                                <PlusCircle size={16} /> Add New Asset
                            </button>
                        </div>
                        <h4 className="text-lg font-bold mb-4">Positions</h4>
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-300">
                                    <th className="py-2 pr-4">Category</th><th className="py-2 pr-4">Name</th>
                                    <th className="py-2 pr-4">Ticker</th><th className="py-2 pr-4 text-right">Qty</th>
                                    <th className="py-2 pr-4 text-right">Price</th><th className="py-2 pr-4 text-right">Value</th>
                                    <th className="py-2 pr-4 text-right">% Weight</th><th className="py-2 pr-0 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {combinedPortfolio.map((p, i) => {
                                    const v = p.value || (p.qty * p.price);
                                    const w = combinedTotal ? (v / combinedTotal) * 100 : 0;
                                    return (
                                        <tr key={i} className="border-t border-gray-700">
                                            <td className="py-2 pr-4">{p.category || "Uncat."}</td><td>{p.name || p.ticker}</td>
                                            <td className="py-2 pr-4">{p.ticker}</td><td className="py-2 pr-4 text-right">{p.qty.toLocaleString()}</td>
                                            <td className="py-2 pr-4 text-right">{fmtILS(p.price)}</td><td className="py-2 pr-4 text-right">{fmtILS(v)}</td>
                                            <td className="py-2 pr-4 text-right">{w.toFixed(2)}%</td>
                                            <td className="py-2 pr-0 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => { setEditingPortfolioItem(p); setIsPortfolioModalOpen(true); }} className="text-blue-400 hover:text-blue-300"><Edit size={14}/></button>
                                                    <button onClick={() => handleRemovePortfolioItem(p.ticker)} className="text-red-400 hover:text-red-300"><Trash2 size={14}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                <tr className="border-t border-gray-700 font-semibold">
                                    <td className="py-2 pr-4" colSpan={5}>Total</td>
                                    <td className="py-2 pr-4 text-right">{fmtILS(combinedTotal)}</td>
                                    <td className="py-2 pr-4 text-right">100.00%</td><td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

