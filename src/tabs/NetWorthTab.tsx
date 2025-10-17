import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CustomTooltip } from '../components/CustomTooltips';

interface NetWorthTabProps {
    netWorthData: any[];
    haveNetWorth: boolean;
    handleOpenEditNetWorthModal: () => void;
    handleOpenAddNetWorthModal: () => void;
}

export const NetWorthTab: React.FC<NetWorthTabProps> = ({ netWorthData, haveNetWorth, handleOpenAddNetWorthModal, handleOpenEditNetWorthModal }) => {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Net Worth Growth</h3>
                <div className="flex items-center gap-4">
                    <button onClick={handleOpenEditNetWorthModal} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500">
                        Edit Month
                    </button>
                    <button onClick={handleOpenAddNetWorthModal} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-500">
                        Add Month
                    </button>
                </div>
            </div>
            {!haveNetWorth ? (
                <div className="text-gray-400 text-center py-16">Load the net worth workbook to view the chart.</div>
            ) : (
                <ResponsiveContainer width="100%" height={500}>
                    <LineChart data={netWorthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="month" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" tickFormatter={(value) => `₪${value.toLocaleString()}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ opacity: 0.8 }} formatter={(value) => {
                            const legendMap: Record<string, string> = {
                                'Net Worth': 'Net Worth (actual)', 'Projected Net Worth': 'Net Worth (projected)',
                                'Total Liquid Assets': 'Liquid Assets (actual)', 'Projected Total Liquid Assets': 'Liquid Assets (projected)',
                                'Total Non-Liquid Assets': 'Non-Liquid Assets (actual)', 'Projected Total Non-Liquid Assets': 'Non-Liquid Assets (projected)',
                                'Total Debt': 'Debt (actual)', 'Projected Total Debt': 'Debt (projected)',
                            };
                            return legendMap[value] || value;
                        }} />
                        
                        {/* Actual data lines (solid) */}
                        <Line type="monotone" dataKey="Total Liquid Assets" stroke="#10B981" strokeWidth={2} dot={false} connectNulls={false} />
                        <Line type="monotone" dataKey="Total Non-Liquid Assets" stroke="#f5d60bff" strokeWidth={2} dot={false} connectNulls={false} />
                        <Line type="monotone" dataKey="Total Debt" stroke="#EF4444" strokeWidth={2} dot={false} connectNulls={false} />
                        <Line type="monotone" dataKey="Net Worth" stroke="#3B82F6" strokeWidth={3} dot={false} connectNulls={false} />
                        
                        {/* Projected data lines (dashed) */}
                        <Line type="monotone" dataKey="Projected Total Liquid Assets" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={true} />
                        <Line type="monotone" dataKey="Projected Total Non-Liquid Assets" stroke="#f5d60bff" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={true} />
                        <Line type="monotone" dataKey="Projected Total Debt" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={true} />
                        <Line type="monotone" dataKey="Projected Net Worth" stroke="#3B82F6" strokeWidth={3} strokeDasharray="5 5" connectNulls={true} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

