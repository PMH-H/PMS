
import React from 'react';
import { Drug, DrugBatch } from '@/types';
import BatchInfo from './BatchInfo';

interface ProductRowProps {
  drug: Drug;
  batches: DrugBatch[];
  onEdit: () => void;
  onDelete: () => void;
  onAddBatch: () => void;
}

const ProductRow: React.FC<ProductRowProps> = ({ drug, batches, onEdit, onDelete, onAddBatch }) => {
  const totalStock = batches.reduce((sum, b) => sum + b.current_quantity, 0);
  const isLowStock = totalStock < drug.min_level;

  return (
    <tr className="hover:bg-gray-50 border-b">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {drug.image_front_url ? (
            <img src={drug.image_front_url} alt={drug.name} className="w-12 h-12 object-cover rounded border" />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">Img</div>
          )}
          <div>
            <div className="font-bold text-gray-900">{drug.name}</div>
            <div className="text-xs text-gray-500">SKU: {drug.sku} | Barcode: {drug.barcode}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 rounded text-xs font-bold ${drug.category === 'A' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
          Class {drug.category}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {totalStock} {drug.unit}
        </span>
        {isLowStock && <div className="text-xs text-red-600 font-semibold mt-1">Low Stock</div>}
      </td>
      <td className="px-6 py-4">
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {batches.length > 0 ? (
            batches.map(b => (
              <BatchInfo key={b.id} batch={b} />
            ))
          ) : (
            <span className="text-xs text-gray-400 italic">No batches</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex gap-2 justify-end">
          <button
            onClick={onAddBatch}
            className="text-xs bg-white border border-gray-300 px-3 py-1 rounded-md hover:bg-gray-50"
          >
            + Batch
          </button>
          <button
            onClick={onEdit}
            className="text-xs bg-white border border-indigo-300 text-indigo-600 px-3 py-1 rounded-md hover:bg-indigo-50"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs bg-red-500 border border-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ProductRow;
