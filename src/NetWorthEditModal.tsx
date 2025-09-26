// src/NetWorthEditModal.tsx
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

// Re-use the DetailedNetWorthRow type definition (or import it if you move it to a types file)
type DetailedNetWorthRow = {
  Month: Date;
  Cash: number; MMF: number; Bonds: number; Stocks: number; Hishtalmut: number;
  ProvFund: number; RealEstateInv: number; Crypto: number;
  Pension: number; Car: number; Residence: number; OtherNonLiquid: number;
  Mortgage: number; Loans: number; CreditCardDebt: number;
  'Total Liquid Assets': number; 'Total Non-Liquid Assets': number;
  'Total Debt': number; 'Net Worth': number;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: DetailedNetWorthRow) => void;
  rowData: DetailedNetWorthRow | null;
}

export const NetWorthEditModal: React.FC<Props> = ({ isOpen, onClose, onSave, rowData }) => {
  const [data, setData] = useState<DetailedNetWorthRow | null>(rowData);

  useEffect(() => {
    setData(rowData);
  }, [rowData]);

  if (!isOpen || !data) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(prev => prev ? { ...prev, [name]: parseFloat(value) || 0 } : null);
  };
  
  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    
    const sumLiquid = data.Cash + data.MMF + data.Bonds + data.Stocks + data.Hishtalmut + data.ProvFund + data.RealEstateInv + data.Crypto;
    
    if (name === 'Total Liquid Assets' && numValue !== sumLiquid) {
      if (!window.confirm(`Warning: The new total (${numValue.toLocaleString()}) does not match the sum of its components (${sumLiquid.toLocaleString()}). Do you want to proceed?`)) {
        return; // User cancelled
      }
    }
    // Similar checks can be added for Non-Liquid and Debt totals
    
    setData(prev => prev ? { ...prev, [name]: numValue } : null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (data) {
      onSave(data);
    }
  };

  const renderInput = (label: string, name: keyof DetailedNetWorthRow) => (
    <div key={name}>
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <input
        type="number" step="any" name={name} value={data[name]} onChange={handleChange}
        className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-md p-2"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-3xl border border-gray-700 h-5/6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Edit Net Worth for {dayjs(data.Month).format('MMMM YYYY')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-400">Liquid Assets</h3>
              {renderInput('Cash', 'Cash')}
              {renderInput('MMF & Deposits', 'MMF')}
              {renderInput('Bonds', 'Bonds')}
              {renderInput('Stocks', 'Stocks')}
              {renderInput('Keren Hishtalmut', 'Hishtalmut')}
              {renderInput('Provident Fund', 'ProvFund')}
              {renderInput('Investment Real Estate', 'RealEstateInv')}
              {renderInput('Crypto', 'Crypto')}
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-yellow-400">Non-Liquid Assets</h3>
              {renderInput('Pension', 'Pension')}
              {renderInput('Car(s)', 'Car')}
              {renderInput('Primary Residence', 'Residence')}
              {renderInput('Other', 'OtherNonLiquid')}
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-400">Debts</h3>
              {renderInput('Mortgage', 'Mortgage')}
              {renderInput('Loans', 'Loans')}
              {renderInput('Credit Card Debt', 'CreditCardDebt')}
            </div>
          </div>
          <div className="mt-8 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};