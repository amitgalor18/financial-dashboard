import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Calculator, TrendingUp, Wallet } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { CustomTooltip } from '../components/CustomTooltips';

interface OverviewTabProps {
    monthlyData: any[];
    netWorthData: any[];
    haveFinance: boolean;
    haveNetWorth: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ monthlyData, netWorthData, haveFinance, haveNetWorth }) => {
    if (!haveFinance || !haveNetWorth) {
        return (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-gray-300">
                Load both Excel files above to populate charts.
            </div>
        );
    }

    return (
        <div className="space-y-8">
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
        </div>
    );
};

