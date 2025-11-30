
import React from 'react';
import { DrugBatch } from '@/types';

interface BatchInfoProps {
  batch: DrugBatch;
}

const BatchInfo: React.FC<BatchInfoProps> = ({ batch }) => {
  const isExpiring = new Date(batch.expiry_date).getTime() < (Date.now() + 1000 * 3600 * 24 * 30);

  return (
    <div className={`text-xs px-2 py-1 rounded flex justify-between items-center ${isExpiring ? 'bg-orange-100 text-orange-800' : 'bg-gray-100'}`}>
      <div>
        <span className="font-semibold">Batch:</span> {batch.batch_no}
        <span className="ml-2"><span className="font-semibold">Exp:</span> {new Date(batch.expiry_date).toLocaleDateString()}</span>
      </div>
      <span className="font-bold text-gray-900">{batch.current_quantity}</span>
    </div>
  );
};

export default BatchInfo;
