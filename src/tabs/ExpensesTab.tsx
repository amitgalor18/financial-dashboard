import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import type { SeriesRow } from '../lib/types';
import { PieTooltip } from '../components/CustomTooltips';

interface ExpensesTabProps {
    expensesTime: SeriesRow[];
    selectedMonth: string;
    setSelectedMonth: (month: string) => void;
    handleOpenEditMonthModal: () => void;
    handleOpenAddMonthModal: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({ 
    expensesTime, 
    selectedMonth, 
    setSelectedMonth, 
    handleOpenAddMonthModal, 
    handleOpenEditMonthModal 
}) => {
    
    const expensesData = React.useMemo(() => {
        if (!selectedMonth) {
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

    return (
        <div className="space-y-8">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Monthly Expenses Breakdown</h3>
                    <div className="flex items-center gap-4">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                        >
                            {[...new Set(expensesTime.map((r) => dayjs(r.Month).format('YYYY-MM')))]
                                .sort()
                                .reverse()
                                .map((m) => <option key={m} value={m}>{m}</option>
                            )}
                        </select>
                        <button onClick={handleOpenEditMonthModal} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500">
                            Edit This Month
                        </button>
                        <button onClick={handleOpenAddMonthModal} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-500">
                            Add Month
                        </button>
                    </div>
                </div>

                {expensesData.pieChartData.length === 0 ? (
                    <div className="text-gray-400">No expenses recorded for this month.</div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <ResponsiveContainer width="100%" height={650}>
                            <PieChart>
                                <Pie
                                    data={expensesData.pieChartData}
                                    cx="50%" cy="50%" outerRadius={160}
                                    dataKey="amount" nameKey="category"
                                    labelLine={false}
                                    label={({ category, percent }: any) => `${category} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {expensesData.pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<PieTooltip selectedMonth={selectedMonth} />} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="space-y-4 h-[650px] overflow-y-auto pr-2">
                            {expensesData.listViewData.map((group: any) => (
                                <div key={group.subCategory} className="p-3 bg-gray-700 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center">
                                            <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: expensesData.pieChartData.find(p => p.category === group.subCategory)?.color }} />
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
    );
};

