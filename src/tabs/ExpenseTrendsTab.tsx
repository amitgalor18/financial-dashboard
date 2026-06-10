import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import type { SeriesRow } from '../lib/types';
import { getCategoryColor } from '../lib/categoryColors';

interface ExpenseTrendsTabProps {
    expensesTime: SeriesRow[];
}

export const ExpenseTrendsTab: React.FC<ExpenseTrendsTabProps> = ({ expensesTime }) => {
    const [hiddenCategories, setHiddenCategories] = React.useState<Set<string>>(new Set());

    const { chartData, categories } = React.useMemo(() => {
        // Group expenses by month, then sum per sub-category
        const byMonth = new Map<string, Record<string, number>>();
        const totals = new Map<string, number>();

        for (const r of expensesTime) {
            if (!(r.Amount > 0)) continue;
            const month = dayjs(r.Month).format('YYYY-MM');
            const cat = r['תת-קטגוריה'] ?? 'Uncategorized';
            if (!byMonth.has(month)) byMonth.set(month, {});
            const monthRow = byMonth.get(month)!;
            monthRow[cat] = (monthRow[cat] ?? 0) + r.Amount;
            totals.set(cat, (totals.get(cat) ?? 0) + r.Amount);
        }

        // Sort categories by total spend (largest first) for stable stacking
        const categories = [...totals.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([cat]) => ({ name: cat, color: getCategoryColor(cat) }));

        const chartData = [...byMonth.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, values]) => {
                const row: Record<string, number | string> = { month };
                for (const c of categories) row[c.name] = Math.round(values[c.name] ?? 0);
                return row;
            });

        return { chartData, categories };
    }, [expensesTime]);

    const toggleCategory = (name: string) => {
        setHiddenCategories(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const visibleCategories = categories.filter(c => !hiddenCategories.has(c.name));

    return (
        <div className="space-y-8">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Expenses by Category Over Time</h3>
                    {hiddenCategories.size > 0 && (
                        <button
                            onClick={() => setHiddenCategories(new Set())}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500"
                        >
                            Show All ({hiddenCategories.size} hidden)
                        </button>
                    )}
                </div>

                {chartData.length === 0 ? (
                    <div className="text-gray-400">No expense data available.</div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height={520}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                <defs>
                                    {visibleCategories.map((c, i) => (
                                        <linearGradient key={c.name} id={`catGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={c.color} stopOpacity={0.8} />
                                            <stop offset="95%" stopColor={c.color} stopOpacity={0.3} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="month" stroke="#9CA3AF" />
                                <YAxis stroke="#9CA3AF" tickFormatter={(v: number) => `₪${v.toLocaleString()}`} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null;
                                        const items = payload.filter((p: any) => (p.value ?? 0) > 0)
                                            .sort((a: any, b: any) => b.value - a.value);
                                        const total = items.reduce((s: number, p: any) => s + p.value, 0);
                                        return (
                                            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl max-h-80 overflow-y-auto">
                                                <p className="text-white font-bold mb-2">{label} — Total ₪{Math.round(total).toLocaleString()}</p>
                                                {items.map((p: any) => (
                                                    <div key={p.dataKey} className="flex justify-between gap-4 text-sm">
                                                        <span style={{ color: p.color }}>{p.dataKey}</span>
                                                        <span className="text-gray-200">₪{Math.round(p.value).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }}
                                />
                                {visibleCategories.map((c, i) => (
                                    <Area
                                        key={c.name}
                                        type="monotone"
                                        dataKey={c.name}
                                        stackId="1"
                                        stroke={c.color}
                                        fill={`url(#catGradient-${i})`}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>

                        <div className="flex flex-wrap gap-2 mt-6 justify-center">
                            {categories.map(c => {
                                const hidden = hiddenCategories.has(c.name);
                                return (
                                    <button
                                        key={c.name}
                                        onClick={() => toggleCategory(c.name)}
                                        title={hidden ? 'Click to show' : 'Click to hide'}
                                        className={`flex items-center px-3 py-1.5 rounded-full text-sm transition-all border ${
                                            hidden
                                                ? 'bg-gray-900 border-gray-700 text-gray-500 line-through opacity-60'
                                                : 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className="w-3 h-3 rounded-full mr-2"
                                            style={{ backgroundColor: hidden ? '#4B5563' : c.color }}
                                        />
                                        {c.name}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
