import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Building2, HandCoins, Package, Plus, ReceiptText, Search, Trash2, Warehouse } from 'lucide-react';
import { useParties, useProducts } from '../hooks/useDatabase';
import { PartyMovementType, PartyType } from '../types';

const partyTypeLabel: Record<PartyType, string> = {
  supplier: 'Supplier',
  customer: 'Customer',
  branch: 'Branch',
  distributor: 'Distributor',
  other: 'Other',
};

const movementLabel: Record<PartyMovementType, string> = {
  purchase: 'Purchase Stock In',
  sale_return: 'Sale Return In',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  return_in: 'Return In',
  return_out: 'Return Out',
  adjustment: 'Adjustment',
};

const paymentMethodOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'other', label: 'Other' },
] as const;

const movementOptions: { value: PartyMovementType; label: string }[] = [
  { value: 'purchase', label: 'Purchase Stock In' },
  { value: 'sale_return', label: 'Sale Return In' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'return_in', label: 'Return In' },
  { value: 'return_out', label: 'Return Out' },
  { value: 'adjustment', label: 'Adjustment' },
];

const Parties: React.FC = () => {
  const { products } = useProducts();
  const { parties, movements, payments, addParty, addMovement, addPayment, deleteParty } = useParties();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<number | ''>('');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [partyType, setPartyType] = useState<PartyType>('supplier');
  const [movementType, setMovementType] = useState<PartyMovementType>('purchase');
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethodOptions)[number]['value']>('cash');
  const [newParty, setNewParty] = useState({ name: '', phone: '', email: '', address: '', openingBalance: '' as string | number, notes: '' });
  const [movementForm, setMovementForm] = useState({ quantity: '' as string | number, amount: '' as string | number, referenceNo: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '' as string | number, referenceNo: '', notes: '' });

  const filteredParties = parties.filter(party => {
    const query = searchTerm.toLowerCase();
    return (
      party.name.toLowerCase().includes(query) ||
      (party.phone || '').toLowerCase().includes(query) ||
      partyTypeLabel[party.type].toLowerCase().includes(query)
    );
  });

  const stats = useMemo(() => {
    const stockIn = movements
      .filter(m => ['purchase', 'sale_return', 'transfer_in', 'return_in', 'adjustment'].includes(m.movementType))
      .reduce((sum, m) => sum + m.quantity, 0);
    const stockOut = movements
      .filter(m => ['transfer_out', 'return_out'].includes(m.movementType))
      .reduce((sum, m) => sum + m.quantity, 0);

    return {
      totalParties: parties.length,
      suppliers: parties.filter(p => p.type === 'supplier').length,
      branches: parties.filter(p => p.type === 'branch').length,
      netStockMovement: stockIn - stockOut,
    };
  }, [movements, parties]);

  const getPartyMovements = (partyId: number) => movements.filter(m => m.partyId === partyId);
  const getPartyPayments = (partyId: number) => payments.filter(p => p.partyId === partyId);

  const getPartyOutstanding = (partyId: number) => {
    const party = parties.find(item => item.id === partyId);
    if (!party) return 0;

    const partyMovements = getPartyMovements(partyId);
    const partyPayments = getPartyPayments(partyId);

    const debitMovementTypes: PartyMovementType[] = ['purchase', 'transfer_in', 'return_in', 'adjustment'];
    const creditMovementTypes: PartyMovementType[] = ['sale_return', 'transfer_out', 'return_out'];

    const debitAmount = partyMovements
      .filter(m => debitMovementTypes.includes(m.movementType))
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const creditAmount = partyMovements
      .filter(m => creditMovementTypes.includes(m.movementType))
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const paymentAmount = partyPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return (party.openingBalance || 0) + debitAmount - creditAmount - paymentAmount;
  };

  const handleAddParty = async () => {
    if (!newParty.name.trim()) return alert('Party name is required');

    await addParty({
      name: newParty.name.trim(),
      type: partyType,
      phone: newParty.phone.trim() || undefined,
      email: newParty.email.trim() || undefined,
      address: newParty.address.trim() || undefined,
      openingBalance: Number(newParty.openingBalance) || 0,
      notes: newParty.notes.trim() || undefined,
    });

    setNewParty({ name: '', phone: '', email: '', address: '', openingBalance: '', notes: '' });
  };

  const handleAddMovement = async () => {
    if (!selectedPartyId || !selectedProductId) return alert('Select both a party and a product');
    const qty = Number(movementForm.quantity) || 0;
    if (qty <= 0) return alert('Quantity must be greater than zero');

    await addMovement({
      partyId: Number(selectedPartyId),
      productId: Number(selectedProductId),
      quantity: qty,
      amount: Number(movementForm.amount) || 0,
      movementType,
      referenceNo: movementForm.referenceNo.trim() || undefined,
      notes: movementForm.notes.trim() || undefined,
    });

    setMovementForm({ quantity: '', amount: '', referenceNo: '', notes: '' });
  };

  const handleAddPayment = async () => {
    if (!selectedPartyId) return alert('Select a party first');
    const amt = Number(paymentForm.amount) || 0;
    if (amt <= 0) return alert('Payment amount must be greater than zero');

    await addPayment({
      partyId: Number(selectedPartyId),
      amount: amt,
      method: paymentMethod,
      referenceNo: paymentForm.referenceNo.trim() || undefined,
      notes: paymentForm.notes.trim() || undefined,
    });

    setPaymentForm({ amount: '', referenceNo: '', notes: '' });
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Operations</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Parties</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Manage suppliers, branches, distributors, and other organizations linked to stock and balance movement.</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card border border-white/60 bg-white/85 shadow-soft"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Total Parties</p><p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalParties}</p></div><Building2 className="h-8 w-8 text-primary-500" /></div></div>
        <div className="card border border-white/60 bg-white/85 shadow-soft"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Suppliers</p><p className="mt-1 text-2xl font-bold text-slate-900">{stats.suppliers}</p></div><Package className="h-8 w-8 text-blue-500" /></div></div>
        <div className="card border border-white/60 bg-white/85 shadow-soft"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Branches</p><p className="mt-1 text-2xl font-bold text-slate-900">{stats.branches}</p></div><Warehouse className="h-8 w-8 text-emerald-500" /></div></div>
        <div className="card border border-white/60 bg-white/85 shadow-soft"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Net Stock Movements</p><p className="mt-1 text-2xl font-bold text-slate-900">{stats.netStockMovement}</p></div><ArrowRightLeft className="h-8 w-8 text-amber-500" /></div></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card border border-white/60 bg-white/85 shadow-soft xl:col-span-1">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Add Party</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
            <input className="input md:col-span-2 xl:col-span-1" placeholder="Organization / Party name" value={newParty.name} onChange={(e) => setNewParty(prev => ({ ...prev, name: e.target.value }))} />
            <select className="input" value={partyType} onChange={(e) => setPartyType(e.target.value as PartyType)}>
              <option value="supplier">Supplier</option>
              <option value="customer">Customer</option>
              <option value="branch">Branch</option>
              <option value="distributor">Distributor</option>
              <option value="other">Other</option>
            </select>
            <input className="input" placeholder="Phone" value={newParty.phone} onChange={(e) => setNewParty(prev => ({ ...prev, phone: e.target.value }))} />
            <input className="input" placeholder="Email" value={newParty.email} onChange={(e) => setNewParty(prev => ({ ...prev, email: e.target.value }))} />
            <input className="input" placeholder="Opening balance" type="number" value={newParty.openingBalance} onChange={(e) => setNewParty(prev => ({ ...prev, openingBalance: e.target.value }))} />
            <input className="input md:col-span-2 xl:col-span-1" placeholder="Address" value={newParty.address} onChange={(e) => setNewParty(prev => ({ ...prev, address: e.target.value }))} />
            <textarea className="input md:col-span-2 xl:col-span-1 min-h-24" placeholder="Notes" value={newParty.notes} onChange={(e) => setNewParty(prev => ({ ...prev, notes: e.target.value }))} />
          </div>
          <button onClick={handleAddParty} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 font-semibold text-white hover:bg-primary-600">
            <Plus className="h-4 w-4" /> Save Party
          </button>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft xl:col-span-1">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Stock Movement</h2>
          <p className="mb-4 text-sm text-slate-600">Record product movement and attach an amount to keep a party-wise balance history.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
            <select className="input md:col-span-2 xl:col-span-1" value={selectedPartyId} onChange={(e) => setSelectedPartyId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select party</option>
              {parties.map(party => <option key={party.id} value={party.id}>{party.name} ({partyTypeLabel[party.type]})</option>)}
            </select>
            <select className="input md:col-span-2 xl:col-span-1" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select product</option>
              {products.map(product => <option key={product.id} value={product.id}>{product.name} - stock {product.count}</option>)}
            </select>
            <select className="input md:col-span-2 xl:col-span-1" value={movementType} onChange={(e) => setMovementType(e.target.value as PartyMovementType)}>
              {movementOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input className="input" type="number" min="1" value={movementForm.quantity} onChange={(e) => setMovementForm(prev => ({ ...prev, quantity: e.target.value }))} placeholder="Quantity" />
            <input className="input" type="number" min="0" step="0.01" value={movementForm.amount} onChange={(e) => setMovementForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="Amount" />
            <input className="input md:col-span-2 xl:col-span-1" value={movementForm.referenceNo} onChange={(e) => setMovementForm(prev => ({ ...prev, referenceNo: e.target.value }))} placeholder="Reference no." />
            <textarea className="input md:col-span-2 xl:col-span-1 min-h-24" value={movementForm.notes} onChange={(e) => setMovementForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
          </div>
          <button onClick={handleAddMovement} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">
            <ArrowRightLeft className="h-4 w-4" /> Save Stock Movement
          </button>
        </div>

        <div className="card border border-white/60 bg-white/85 shadow-soft xl:col-span-1">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Collect Payment</h2>
          <p className="mb-4 text-sm text-slate-600">Reduce party dues by recording cash, bank, or UPI collections.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
            <select className="input md:col-span-2 xl:col-span-1" value={selectedPartyId} onChange={(e) => setSelectedPartyId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select party</option>
              {parties.map(party => <option key={party.id} value={party.id}>{party.name} ({partyTypeLabel[party.type]})</option>)}
            </select>
            <input className="input" type="number" min="1" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="Payment amount" />
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
              {paymentMethodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input className="input md:col-span-2 xl:col-span-1" value={paymentForm.referenceNo} onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNo: e.target.value }))} placeholder="Reference no." />
            <textarea className="input md:col-span-2 xl:col-span-1 min-h-24" value={paymentForm.notes} onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
          </div>
          <button onClick={handleAddPayment} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
            <HandCoins className="h-4 w-4" /> Save Payment
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-soft">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Party Directory and Ledger</h2>
          <div className="relative md:w-80">
            <input className="input w-full pr-10" placeholder="Search by name, phone, or type..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="space-y-4">
          {filteredParties.map(party => {
            const partyMovements = getPartyMovements(party.id);
            const partyPayments = getPartyPayments(party.id);
            const stockIn = partyMovements.filter(m => ['purchase', 'sale_return', 'transfer_in', 'return_in', 'adjustment'].includes(m.movementType)).reduce((sum, m) => sum + m.quantity, 0);
            const stockOut = partyMovements.filter(m => ['transfer_out', 'return_out'].includes(m.movementType)).reduce((sum, m) => sum + m.quantity, 0);
            const totalPayments = partyPayments.reduce((sum, payment) => sum + payment.amount, 0);
            const outstanding = getPartyOutstanding(party.id);

            return (
              <div key={party.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{party.name}</h3>
                      <span className="rounded-full bg-primary-100 px-2 py-1 text-xs font-semibold text-primary-700">{partyTypeLabel[party.type]}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">{party.phone || 'No phone'}{party.email ? ` · ${party.email}` : ''}</div>
                    <div className="mt-1 text-sm text-slate-500">Opening balance: ₹{party.openingBalance.toFixed(2)}</div>
                  </div>
                  <button onClick={async () => deleteParty(party.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">Stock In</div><div className="mt-1 text-lg font-semibold text-emerald-600">{stockIn}</div></div>
                  <div className="rounded-xl bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">Stock Out</div><div className="mt-1 text-lg font-semibold text-rose-600">{stockOut}</div></div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 shadow-sm"><div className="text-xs text-amber-700">Total Payments</div><div className="mt-1 text-lg font-semibold text-amber-900">₹{totalPayments.toFixed(2)}</div></div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 shadow-sm"><div className="text-xs text-rose-700">Balance Due</div><div className="mt-1 text-lg font-semibold text-rose-700">₹{outstanding.toFixed(2)}</div></div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Stock Ledger</div>
                  <div className="divide-y divide-slate-200">
                    {partyMovements.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No stock movement recorded for this party yet.</div>
                    ) : partyMovements.map(movement => {
                      const product = products.find(productItem => productItem.id === movement.productId);
                      return (
                        <div key={movement.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                          <div>
                            <div className="font-medium text-slate-900">{movementLabel[movement.movementType]}</div>
                            <div className="text-slate-500">{product?.name || 'Unknown product'}{movement.amount ? ` · ₹${movement.amount.toFixed(2)}` : ''}{movement.referenceNo ? ` · Ref: ${movement.referenceNo}` : ''}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-slate-900">{movement.quantity}</div>
                            <div className="text-xs text-slate-500">{new Date(movement.createdAt).toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                    <ReceiptText className="h-4 w-4" />
                    Payment Ledger
                  </div>
                  <div className="divide-y divide-slate-200">
                    {partyPayments.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No payment recorded for this party yet.</div>
                    ) : partyPayments.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium text-slate-900">{paymentMethodOptions.find(option => option.value === payment.method)?.label || payment.method}</div>
                          <div className="text-slate-500">{payment.referenceNo ? `Ref: ${payment.referenceNo}` : 'No reference'}{payment.notes ? ` · ${payment.notes}` : ''}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-700">₹{payment.amount.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">{new Date(payment.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Parties;
