import React from 'react';
import { TrendingUp, DollarSign, BarChart3, Target, Wallet, PieChart as PieIcon } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type TabId = 'overview' | 'expenses' | 'savings' | 'networth' | 'portfolio' | 'fire';

interface TabButtonProps {
    id: TabId;
    label: string;
    icon: React.FC<LucideProps>;
    isActive: boolean;
    onClick: (id: TabId) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ id, label, icon: Icon, isActive, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
        isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <Icon size={18} className="mr-2" />
      {label}
    </button>
);

interface DashboardTabsProps {
    activeTab: TabId;
    setActiveTab: (id: TabId) => void;
}

export const DashboardTabs: React.FC<DashboardTabsProps> = ({ activeTab, setActiveTab }) => {
    const tabs: { id: TabId; label: string; icon: React.FC<LucideProps> }[] = [
        { id: 'overview', label: 'Overview', icon: DollarSign },
        { id: 'expenses', label: 'Expenses', icon: PieIcon },
        { id: 'savings', label: 'Savings', icon: TrendingUp },
        { id: 'networth', label: 'Net Worth', icon: Wallet },
        { id: 'portfolio', label: 'Portfolio', icon: BarChart3 },
        { id: 'fire', label: 'FIRE', icon: Target },
    ];
    
    return (
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex space-x-2 overflow-x-auto">
                {tabs.map(tab => (
                    <TabButton 
                        key={tab.id}
                        id={tab.id}
                        label={tab.label}
                        icon={tab.icon}
                        isActive={activeTab === tab.id}
                        onClick={setActiveTab}
                    />
                ))}
            </div>
          </div>
        </div>
    );
};

