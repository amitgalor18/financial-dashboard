import React from 'react';
import type { LucideProps } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.FC<LucideProps>;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon }) => (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className="bg-blue-500 bg-opacity-20 p-3 rounded-lg">
          <Icon className="text-blue-400" size={24} />
        </div>
      </div>
    </div>
);

