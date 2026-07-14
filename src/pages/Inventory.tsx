import React, { useState } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Calendar,
  BarChart3
} from 'lucide-react';
import { Product } from '../types';
import { useProducts, useTransactions, useBills } from '../hooks/useDatabase';

interface InventoryItem extends Product {
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  lastRestocked: string;
}

const Inventory: React.FC = () => {
  // Use real products data from database
  const { products, updateProduct } = useProducts();

  // Convert products to inventory items with default inventory settings
  const inventory: InventoryItem[] = products.map(product => ({
    ...product,
    minStock: 10, // Default minimum stock
    maxStock: 100, // Default maximum stock
    reorderPoint: 15, // Default reorder point
    lastRestocked: product.updatedAt, // Use product update time as last restock
  }));

  // Inventory transactions from database
  const { transactions } = useTransactions();
  const { bills } = useBills();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out' | 'normal'>('all');
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [stockAction, setStockAction] = useState<'add' | 'remove'>('add');
  const [stockQuantity, setStockQuantity] = useState<string>('');
  const [stockReason, setStockReason] = useState('');

  const getStockStatus = (item: InventoryItem) => {
    if (item.count === 0) return 'out';
    if (item.count <= item.reorderPoint) return 'low';
    return 'normal';
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'out': return 'bg-red-100 text-red-800';
      case 'low': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const getStockStatusText = (status: string) => {
    switch (status) {
      case 'out': return 'Out of Stock';
      case 'low': return 'Low Stock';
      default: return 'In Stock';
    }
  };

  const updateStock = async () => {
    const qty = parseInt(stockQuantity) || 0;
    if (!selectedProduct || qty <= 0) return;

    const newQuantity = stockAction === 'add'
      ? selectedProduct.count + qty
      : Math.max(0, selectedProduct.count - qty);

    try {
      // Update product stock in database
      await updateProduct(selectedProduct.id, { count: newQuantity });

      // For now, we'll skip transaction logging since it's not implemented
      // In a full implementation, you would save the transaction to database

      // Reset form
      setShowStockModal(false);
      setSelectedProduct(null);
      setStockQuantity('');
      setStockReason('');
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock. Please try again.');
    }
  };

  const openStockModal = (product: InventoryItem, action: 'add' | 'remove') => {
    setSelectedProduct(product);
    setStockAction(action);
    setStockQuantity('');
    setShowStockModal(true);
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm);

    const matchesFilter = filterStatus === 'all' || getStockStatus(item) === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const inventoryStats = {
    totalProducts: inventory.length,
    lowStockItems: inventory.filter(item => getStockStatus(item) === 'low').length,
    outOfStockItems: inventory.filter(item => getStockStatus(item) === 'out').length,
    totalValue: inventory.reduce((sum, item) => sum + (item.count * item.costPrice), 0),
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Operations</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Inventory Management</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Track stock levels, manage inventory, and monitor transactions in a clean workspace.</p>
        </div>
        <div className="flex flex-wrap gap-3 xl:justify-end">
          <button onClick={() => {
            const salesMap = new Map<number, { qty: number; sell: number; discount: number }>();
            bills.forEach(b => (b.items || []).forEach(it => {
              const entry = salesMap.get(it.productId) || { qty: 0, sell: 0, discount: 0 };
              entry.qty += it.quantity;
              entry.sell += it.totalPrice;
              const prod = inventory.find(p => p.id === it.productId);
              const listSell = prod?.sellingPrice ?? it.unitPrice;
              entry.discount += (listSell - it.unitPrice) * it.quantity;
              salesMap.set(it.productId, entry);
            }));

            const rows = [
              ['Product', 'Code', 'Stock', 'Sales Qty', 'Total Cost', 'Total Sell', 'Total Discount'],
              ...inventory.map(i => {
                const s = salesMap.get(i.id) || { qty: 0, sell: 0, discount: 0 };
                const totalCost = i.costPrice * s.qty;
                return [
                  i.name,
                  i.productCode || '',
                  i.count,
                  s.qty,
                  totalCost.toFixed(2),
                  s.sell.toFixed(2),
                  s.discount.toFixed(2),
                ];
              })
            ];
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'inventory_sales_report.csv'; a.click();
            URL.revokeObjectURL(url);
          }} className="btn-secondary flex items-center gap-2 px-4 py-2">
              <Download className="h-4 w-4" />
            Export
          </button>
            <button className="btn-secondary flex items-center gap-2 px-4 py-2">
              <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Inventory Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Products</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{inventoryStats.totalProducts}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Low Stock Items</p>
              <p className="mt-1 text-2xl font-bold text-yellow-600">{inventoryStats.lowStockItems}</p>
            </div>
            <div className="rounded-2xl bg-yellow-50 p-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Out of Stock</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{inventoryStats.outOfStockItems}</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-3">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Value</p>
              <p className="mt-1 text-2xl font-bold text-green-600">₹{inventoryStats.totalValue.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-green-50 p-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-soft md:flex-row md:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search products by name, company, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pr-10 w-full"
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="input w-auto"
          >
            <option value="all">All Items</option>
            <option value="normal">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Stock Update Modal */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {stockAction === 'add' ? 'Add Stock' : 'Remove Stock'} - {selectedProduct.name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Stock: {selectedProduct.count}
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity to {stockAction === 'add' ? 'Add' : 'Remove'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="input w-full"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  className="input w-full"
                  placeholder="Enter reason for stock update"
                />
              </div>

              {stockAction === 'add' && (
                <div className="text-sm text-gray-600">
                  New stock will be: {selectedProduct.count + (parseInt(stockQuantity) || 0)}
                </div>
              )}

              {stockAction === 'remove' && (
                <div className="text-sm text-gray-600">
                  New stock will be: {Math.max(0, selectedProduct.count - (parseInt(stockQuantity) || 0))}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={updateStock} className="btn-primary flex-1 px-4 py-2" disabled={(parseInt(stockQuantity) || 0) <= 0}>
                {stockAction === 'add' ? 'Add Stock' : 'Remove Stock'}
              </button>
              <button
                onClick={() => setShowStockModal(false)}
                className="btn-secondary px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="card border border-white/60 bg-white/85 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Inventory Items</h2>
          <span className="text-sm text-slate-500">
            {filteredInventory.length} item(s) found
          </span>
        </div>

        {filteredInventory.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium text-slate-900">No items found</h3>
            <p className="text-slate-600">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'No inventory items available'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-soft">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Product</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Company</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Current Stock</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reorder Point</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Value</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Last Restocked</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const status = getStockStatus(item);
                  const value = item.count * item.costPrice;

                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium text-slate-900">{item.name}</div>
                          <div className="text-sm text-slate-500">ID: {item.id} • Code: {item.productCode || '-'}</div>
                          <div className="font-mono text-xs text-slate-500">{item.barcode}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{item.company}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{item.count}</div>
                        <div className="text-xs text-slate-500">Min: {item.minStock} | Max: {item.maxStock}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`badge ${getStockStatusColor(status)}`}>
                          {getStockStatusText(status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-medium ${item.count <= item.reorderPoint ? 'text-red-600' : 'text-slate-900'}`}>
                          {item.reorderPoint}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">₹{value.toFixed(2)}</td>
                      <td className="px-4 py-4 text-slate-700">
                        {new Date(item.lastRestocked).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openStockModal(item, 'add')} className="btn-icon btn-icon-success" title="Add Stock">
                            <Plus className="h-4 w-4" />
                          </button>
                          <button onClick={() => openStockModal(item, 'remove')} className="btn-icon btn-icon-danger" title="Remove Stock" disabled={item.count === 0}>
                            <Minus className="h-4 w-4" />
                          </button>
                          <button className="btn-icon btn-icon-primary" title="View Details">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="card mt-6 border border-white/60 bg-white/85 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Recent Transactions</h2>
          <button className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            View All
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <p className="text-slate-500">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-soft">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Product</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Quantity</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reason / Bill</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map((transaction) => {
                  const product = inventory.find(p => p.id === transaction.productId);

                  return (
                    <tr key={transaction.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{product?.name || 'Unknown Product'}</div>
                        <div className="text-sm text-slate-600">{product?.company}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{product?.productCode || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${transaction.type === 'in'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {transaction.type === 'in' ? 'Stock In' : 'Stock Out'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${transaction.type === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {transaction.type === 'in' ? '+' : '-'}{transaction.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {transaction.reason}
                        {transaction.billId ? (
                          <span className="ml-2 text-xs text-slate-500">(Bill #{transaction.billId})</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
