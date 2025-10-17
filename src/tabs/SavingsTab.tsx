import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CurrencyTooltip } from '../components/CustomTooltips';

interface SavingsTabProps {
    savingsSeries: any[];
    totalCumulative: number;
    avgMonthly: number;
    avgSavingsRate: number;
}

export const SavingsTab: React.FC<SavingsTabProps> = ({ savingsSeries, totalCumulative, avgMonthly, avgSavingsRate }) => {
    if (!savingsSeries.length) {
        return (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-gray-300">
                Load the Expenses/Income workbook to see monthly and cumulative savings.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-2">Cumulative Savings</h3>
                    <div className="text-3xl font-extrabold">₪{totalCumulative.toLocaleString()}</div>
                    <p className="text-gray-400 mt-1 text-sm">Sum of (Income − Expenses)</p>
                </div>
                
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-2">Avg. Monthly Savings</h3>
                    <div className="text-3xl font-extrabold">₪{avgMonthly.toLocaleString()}</div>
                    <p className="text-gray-400 mt-1 text-sm">Mean of monthly savings</p>
                </div>

                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-2">Avg. Savings Rate</h3>
                    <div className="text-3xl font-extrabold">{avgSavingsRate.toFixed(1)}%</div>
                    <p className="text-gray-400 mt-1 text-sm">Average of (Savings / Income)</p>
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
        </div>
    );
};

