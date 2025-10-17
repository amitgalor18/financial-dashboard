import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CustomTooltip } from '../components/CustomTooltips';

interface FireTabProps {
    fiData: any[];
}

export const FireTab: React.FC<FireTabProps> = ({ fiData }) => {
    if (fiData.length === 0) {
        return (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-gray-300">
                Load both workbooks to compute FI ratio.
            </div>
        );
    }

    const lastFiProgress = fiData.at(-1)!.fiProgress;

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-6">Financial Independence Progress</h3>
            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Progress to FI (25× annual expenses)</span>
                    <span className="text-white">{lastFiProgress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                        className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(lastFiProgress, 100)}%` }}
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
        </div>
    );
};

