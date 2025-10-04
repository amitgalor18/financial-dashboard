// src/PortfolioEditModal.tsx
import React, { useState, useEffect } from 'react';

// Define the shape of a portfolio item
interface PortfolioItem {
  ticker: string;
  name: string;
  qty: number;
  category: string;
  price?: number; // Price is optional as it's not edited here
  value?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: PortfolioItem) => void;
  itemData: PortfolioItem | null; // null when adding, object when editing
}

export const PortfolioEditModal: React.FC<Props> = ({ isOpen, onClose, onSave, itemData }) => {
  const [item, setItem] = useState<PortfolioItem>({ ticker: '', name: '', qty: 0, category: '' });

  useEffect(() => {
    // If itemData is provided, we are in "edit" mode
    if (itemData) {
      setItem(itemData);
    } else {
      // Otherwise, we are in "add" mode, reset the form
      setItem({ ticker: '', name: '', qty: 0, category: '' });
    }
  }, [itemData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setItem(prev => ({ ...prev, [name]: name === 'qty' ? parseFloat(value) || 0 : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(item);
  };

  const isEditing = itemData !== null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md border border-gray-700">
        <h2 className="text-2xl font-bold mb-6">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">Ticker</label>
              <input
                type="text" name="ticker" value={item.ticker} onChange={handleChange}
                disabled={isEditing} // Ticker is the ID, cannot be changed when editing
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-md p-2 disabled:opacity-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Name</label>
              <input
                type="text" name="name" value={item.name} onChange={handleChange}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Quantity</label>
              <input
                type="number" step="any" name="qty" value={item.qty} onChange={handleChange}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Category</label>
              <input
                type="text" name="category" value={item.category} onChange={handleChange}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-md p-2"
                required
              />
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