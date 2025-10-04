// src/ExpensesEditModal.tsx
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

// Re-use or import the SeriesRow type
interface SeriesRow {
  Month: Date;
  Amount: number;
  ['קטגוריה ראשית']?: string;
  ['תת-קטגוריה']?: string;
  ['הוצאות']?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { expenses: SeriesRow[], income: SeriesRow[] }) => void;
  monthData: { expenses: SeriesRow[], income: SeriesRow[] };
  month: string;
  schema: { expenses: any[], income: any[] };
}

export const ExpensesEditModal: React.FC<Props> = ({ isOpen, onClose, onSave, monthData, month, schema }) => {
  const [expenses, setExpenses] = useState<SeriesRow[]>([]);
  const [income, setIncome] = useState<SeriesRow[]>([]);

  useEffect(() => {
    // Now, we merge the month's actual data with the master schema
    const mergeWithSchema = (currentItems: SeriesRow[], itemSchema: any[]) => {
      const itemMap = new Map(currentItems.map(item => [item['הוצאות'], item]));
      // Ensure every possible item from the schema is in our list, with Amount: 0 if it wasn't there before
      itemSchema.forEach(schemaItem => {
        if (!itemMap.has(schemaItem.expense)) {
          itemMap.set(schemaItem.expense, {
            Month: dayjs(month).toDate(),
            Amount: 0,
            'קטגוריה ראשית': schemaItem.main,
            'תת-קטגוריה': schemaItem.sub,
            'הוצאות': schemaItem.expense,
          });
        }
      });
      return Array.from(itemMap.values());
    };
    setExpenses(mergeWithSchema(monthData.expenses, schema.expenses));
    setIncome(mergeWithSchema(monthData.income, schema.income));
  }, [monthData, schema, month, isOpen]);


  if (!isOpen) return null;

  const handleExpenseChange = (index: number, newAmount: number) => {
    setExpenses(prev => prev.map((item, i) => i === index ? { ...item, Amount: newAmount } : item));
  };
  
  const handleIncomeChange = (index: number, newAmount: number) => {
    setIncome(prev => prev.map((item, i) => i === index ? { ...item, Amount: newAmount } : item));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ expenses, income });
  };
  
  const renderTable = (title: string, items: SeriesRow[], onChange: (index: number, amount: number) => void) => (
    <div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4 p-2 bg-gray-700 rounded">
            <span className="text-sm truncate">{item['הוצאות'] || item['קטגוריה ראשית']}</span>
            <input
              type="number"
              value={item.Amount}
              onChange={(e) => onChange(index, parseFloat(e.target.value) || 0)}
              className="w-32 bg-gray-600 border border-gray-500 rounded-md p-1 text-right"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-4xl border border-gray-700 h-5/6">
        <h2 className="text-2xl font-bold mb-6">Edit Expenses & Income for {month}</h2>
        <form onSubmit={handleSubmit} className="h-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[calc(100%-80px)] overflow-y-auto pr-2">
            {renderTable('Income', income, handleIncomeChange)}
            {renderTable('Expenses', expenses, handleExpenseChange)}
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