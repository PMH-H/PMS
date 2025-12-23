
import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { User, NetworkInventoryItem } from '../types';
import { Network, ArrowRightLeft, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface NetworkInventoryProps {
    currentUser: User;
}

export const NetworkInventory: React.FC<NetworkInventoryProps> = ({ currentUser }) => {
    const [networkStock, setNetworkStock] = useState<NetworkInventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    // Transfer State
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferItem, setTransferItem] = useState<NetworkInventoryItem | null>(null);
    const [transferQty, setTransferQty] = useState<number>(0);
    const [targetFacility, setTargetFacility] = useState<string>('');
    const [childFacilities, setChildFacilities] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, [currentUser.facility_id]);

    const loadData = async () => {
        if (!currentUser.facility_id) return;
        setLoading(true);
        try {
            const [stock, children] = await Promise.all([
                inventoryService.getNetworkInventory(currentUser.facility_id),
                inventoryService.getChildFacilities(currentUser.facility_id)
            ]);
            setNetworkStock(stock || []);
            setChildFacilities(children || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!transferItem || !targetFacility || transferQty <= 0) return;
        if (!currentUser.facility_id) return;

        try {
            await inventoryService.transferStock(
                currentUser.facility_id,
                targetFacility,
                transferItem.item_id,
                transferQty,
                currentUser.id
            );
            toast.success('Transfer Successful!');
            setShowTransfer(false);
            loadData();
        } catch (err: any) {
            toast.error('Transfer Failed: ' + err.message);
        }
    };

    const toggleExpand = (itemId: string) => {
        setExpandedItem(expandedItem === itemId ? null : itemId);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Network className="text-indigo-600" />
                    Network Inventory
                </h2>
                <button
                    onClick={loadData}
                    className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Item</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Total Network Qty</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400">Loading network data...</td></tr>
                            ) : networkStock.length === 0 ? (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400">No stock found in network.</td></tr>
                            ) : (
                                networkStock.map(item => (
                                    <React.Fragment key={item.item_id}>
                                        <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleExpand(item.item_id)}>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {expandedItem === item.item_id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                                    <span className="font-medium text-gray-900">{item.item_name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-bold text-indigo-700">
                                                {item.total_quantity}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTransferItem(item);
                                                        setShowTransfer(true);
                                                    }}
                                                    className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 border border-indigo-200"
                                                >
                                                    Transfer
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedItem === item.item_id && (
                                            <tr className="bg-gray-50/50">
                                                <td colSpan={3} className="p-4 pl-12">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Location Breakdown</h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        {item.facility_breakdown.map((loc, idx) => (
                                                            <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                                                                <span className="text-sm font-medium text-gray-700">{loc.facility_name}</span>
                                                                <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block">
                                                                    {loc.quantity}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transfer Modal */}
            {showTransfer && transferItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl animate-in zoom-in-95">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <ArrowRightLeft size={20} className="text-indigo-600" />
                            Transfer Stock: {transferItem.item_name}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Destination Facility</label>
                                <select
                                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={targetFacility}
                                    onChange={e => setTargetFacility(e.target.value)}
                                >
                                    <option value="">Select Facility...</option>
                                    {childFacilities.filter(f => f.facility_id !== currentUser.facility_id).map(f => (
                                        <option key={f.facility_id} value={f.facility_id}>
                                            {f.facility_name} (Depth: {f.depth})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={transferQty}
                                    onChange={e => setTransferQty(parseInt(e.target.value))}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Current Stock at source: {transferItem.facility_breakdown.find(f => f.facility_id === currentUser.facility_id)?.quantity || 0}
                                </p>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    onClick={() => setShowTransfer(false)}
                                    className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTransfer}
                                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md"
                                >
                                    Confirm Transfer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
