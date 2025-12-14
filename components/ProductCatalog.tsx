import React from 'react';
import { Drug } from '../types';

interface ProductCatalogProps {
  inventory: Drug[];
}

const ProductCatalog: React.FC<ProductCatalogProps> = ({ inventory }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {inventory.map(drug => (
        <div key={drug.id} className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold">{drug.name}</h3>
          <p className="text-sm text-gray-500">{drug.description}</p>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-lg font-bold">${(drug.price_cents ?? 0) / 100}</span>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Add to Cart</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductCatalog;
