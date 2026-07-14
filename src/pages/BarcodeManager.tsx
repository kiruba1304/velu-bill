import React, { useState, useRef, useEffect } from 'react';
import {
  Barcode,
  Download,
  Printer,
  RefreshCw,
  Copy,
  Check,
  Plus,
  Trash2,
  Settings
} from 'lucide-react';
import { BarcodeGenerator, BarcodeOptions } from '../utils/barcode';

import { useProducts } from '../hooks/useDatabase';

interface BarcodeItem {
  id: string;
  value: string;
  productName?: string;
  format: string;
  generated: boolean;
}

const BarcodeManager: React.FC = () => {
  const [barcodes, setBarcodes] = useState<BarcodeItem[]>([]);
  const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());
  interface UIBarcodeOptions {
    format: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC';
    width: string | number;
    height: string | number;
    displayValue: boolean;
    fontSize: number;
  }

  const [barcodeOptions, setBarcodeOptions] = useState<UIBarcodeOptions>({
    format: 'CODE128',
    width: '2',
    height: '100',
    displayValue: true,
    fontSize: 20,
  });

  const getParsedOptions = (): BarcodeOptions => ({
    ...barcodeOptions,
    width: parseFloat(String(barcodeOptions.width)) || 2,
    height: parseInt(String(barcodeOptions.height)) || 100,
    fontSize: parseInt(String(barcodeOptions.fontSize)) || 20,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use real products data from database
  const { products } = useProducts();


  // Helpers to map barcode -> product and price (selling price without discount)
  const getProductForValue = (value: string) => {
    return products.find((p: any) => p?.barcode === value || p?.productCode === value);
  };
  const getProductDetails = (value: string) => {
    const p = getProductForValue(value);
    if (!p) return null;
    return {
      mrp: p.sellingPrice ? `Rs. ${Number(p.sellingPrice).toFixed(2)}` : '',
      ssPrice: p.finalPrice ? `Rs. ${Number(p.finalPrice).toFixed(2)}` : '',
      name: p.name
    };
  };

  useEffect(() => {
    // Load existing product barcodes
    const existingBarcodes: BarcodeItem[] = products.map(product => ({
      id: `product-${product.id}`,
      value: product.barcode,
      productName: product.name,
      format: 'CODE128',
      generated: false,
    }));
    setBarcodes(existingBarcodes);
  }, [products]);

  const generateNewBarcode = (format: 'CODE128' | 'EAN13' | 'UPC' = 'CODE128') => {
    let value: string;

    switch (format) {
      case 'EAN13':
        value = BarcodeGenerator.generateEAN13();
        break;
      case 'UPC':
        value = BarcodeGenerator.generateUPC();
        break;
      default:
        value = BarcodeGenerator.generateBarcodeNumber();
    }

    const newBarcodeItem: BarcodeItem = {
      id: `generated-${Date.now()}`,
      value,
      productName: newProductName || undefined,
      format,
      generated: true,
    };

    setBarcodes(prev => [...prev, newBarcodeItem]);
    setNewProductName('');
  };

  const addCustomBarcode = () => {
    if (!newBarcode.trim()) return;

    if (!BarcodeGenerator.validateBarcode(newBarcode, barcodeOptions.format || 'CODE128')) {
      alert('Invalid barcode format. Please check your input.');
      return;
    }

    const customBarcodeItem: BarcodeItem = {
      id: `custom-${Date.now()}`,
      value: newBarcode.trim(),
      productName: newProductName || undefined,
      format: barcodeOptions.format || 'CODE128',
      generated: false,
    };

    setBarcodes(prev => [...prev, customBarcodeItem]);
    setNewBarcode('');
    setNewProductName('');
  };

  const deleteBarcode = (id: string) => {
    setBarcodes(prev => prev.filter(b => b.id !== id));
    setSelectedBarcodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedBarcodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedBarcodes(new Set(barcodes.map(b => b.id)));
  };

  const clearSelection = () => {
    setSelectedBarcodes(new Set());
  };

  const copyToClipboard = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadBarcode = (barcode: BarcodeItem) => {
    const details = getProductDetails(barcode.value);
    const productName = barcode.productName || '';

    const dataURL = BarcodeGenerator.generateFullLabelDataURL(
      barcode.value,
      details?.mrp || '',
      details?.ssPrice || '',
      productName,
      {
        ...getParsedOptions(),
        format: barcode.format as any,
      }
    );

    if (dataURL) {
      const link = document.createElement('a');
      link.download = `barcode-${barcode.value}.png`;
      link.href = dataURL;
      link.click();
    }
  };

  const printSingleBarcode = (barcode: BarcodeItem) => {
    const details = getProductDetails(barcode.value);
    BarcodeGenerator.printBarcode(
      barcode.value,
      { ...getParsedOptions(), format: barcode.format as any },
      barcode.productName,
      details?.mrp,
      details?.ssPrice
    );
  };

  const printSelectedBarcodes = () => {
    const selectedItems = barcodes.filter(b => selectedBarcodes.has(b.id));
    if (selectedItems.length === 0) {
      alert('Please select barcodes to print.');
      return;
    }

    const barcodeData = selectedItems.map(b => {
      const details = getProductDetails(b.value);
      return {
        value: b.value,
        productName: b.productName,
        mrp: details?.mrp,
        ssPrice: details?.ssPrice
      };
    });

    BarcodeGenerator.printMultipleBarcodes(barcodeData, getParsedOptions());
  };

  const renderBarcode = (barcode: BarcodeItem) => {
    const details = getProductDetails(barcode.value);
    const productName = barcode.productName || '';

    // Use the full label generator for the preview as well
    return BarcodeGenerator.generateFullLabelDataURL(
      barcode.value,
      details?.mrp || '',
      details?.ssPrice || '',
      productName,
      {
        ...getParsedOptions(),
        format: barcode.format as any,
        // Scale down slightly for preview if needed, or let CSS handle it
      }
    );
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Label studio</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Barcode Management</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Generate, manage, and print barcodes with a cleaner production-style interface.</p>
        </div>
        <div className="flex flex-wrap gap-3 xl:justify-end">
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          {selectedBarcodes.size > 0 && (
            <button
              onClick={printSelectedBarcodes}
              className="btn-primary flex items-center gap-2 px-4 py-2"
            >
              <Printer className="w-4 h-4" />
              Print Selected ({selectedBarcodes.size})
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
          <div className="card mb-6 border border-white/60 bg-white/85 shadow-soft">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Barcode Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Format</label>
              <select
                value={barcodeOptions.format}
                onChange={(e) => setBarcodeOptions(prev => ({ ...prev, format: e.target.value as any }))}
                className="input w-full"
              >
                <option value="CODE128">CODE128</option>
                <option value="CODE39">CODE39</option>
                <option value="EAN13">EAN13</option>
                <option value="EAN8">EAN8</option>
                <option value="UPC">UPC</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Width</label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={barcodeOptions.width}
                onChange={(e) => setBarcodeOptions(prev => ({ ...prev, width: e.target.value }))}
                className="input w-full"
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Height</label>
              <input
                type="number"
                min="50"
                max="200"
                value={barcodeOptions.height}
                onChange={(e) => setBarcodeOptions(prev => ({ ...prev, height: e.target.value }))}
                className="input w-full"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add New Barcode */}
      <div className="card mb-6 border border-white/60 bg-white/85 shadow-soft">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add New Barcode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Generate New */}
          <div>
            <h4 className="mb-3 font-medium text-slate-900">Generate New Barcode</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Product name (optional)"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="input w-full"
              />
              <div className="flex gap-2">
                <button onClick={() => generateNewBarcode('CODE128')} className="btn-primary flex flex-1 items-center gap-2 px-4 py-2">
                  <RefreshCw className="h-4 w-4" />
                  Generate CODE128
                </button>
                <button onClick={() => generateNewBarcode('EAN13')} className="btn-secondary flex-1 px-4 py-2">
                  EAN13
                </button>
                <button onClick={() => generateNewBarcode('UPC')} className="btn-secondary flex-1 px-4 py-2">
                  UPC
                </button>
              </div>
            </div>
          </div>

          {/* Add Custom */}
          <div>
            <h4 className="mb-3 font-medium text-slate-900">Add Existing Barcode</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Product name (optional)"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="input w-full"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter barcode value"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  className="input flex-1"
                />
                <button onClick={addCustomBarcode} className="btn-primary flex items-center gap-2 px-4 py-2">
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barcodes List */}
      <div className="card border border-white/60 bg-white/85 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Barcodes ({barcodes.length})</h3>
          <div className="flex gap-2">
            <button onClick={selectAll} className="btn-ghost px-2 py-1.5 text-sm text-primary-600 hover:text-primary-700">
              Select All
            </button>
            <button onClick={clearSelection} className="btn-ghost px-2 py-1.5 text-sm text-slate-600 hover:text-slate-800">
              Clear Selection
            </button>
          </div>
        </div>

        {barcodes.length === 0 ? (
          <div className="text-center py-12">
            <Barcode className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium text-slate-900">No barcodes found</h3>
            <p className="text-slate-600">Generate or add your first barcode to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {barcodes.map((barcode) => {
              const barcodeImage = renderBarcode(barcode);
              const isSelected = selectedBarcodes.has(barcode.id);


              const details = getProductDetails(barcode.value);

              return (
                <div
                  key={barcode.id}
                  className={`rounded-2xl border p-4 shadow-soft transition-all ${isSelected ? 'border-primary-300 bg-primary-50/80' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-primary-200'
                    }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(barcode.id)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => copyToClipboard(barcode.value, barcode.id)} className="btn-icon btn-icon-neutral" title="Copy barcode">
                        {copiedId === barcode.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button onClick={() => downloadBarcode(barcode)} className="btn-icon btn-icon-neutral" title="Download">
                        <Download className="h-4 w-4" />
                      </button>
                      <button onClick={() => printSingleBarcode(barcode)} className="btn-icon btn-icon-neutral" title="Print">
                        <Printer className="h-4 w-4" />
                      </button>
                      {barcode.generated && (
                        <button onClick={() => deleteBarcode(barcode.id)} className="btn-icon btn-icon-danger" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {barcode.productName && (
                    <div className="mb-2 text-sm font-medium text-slate-900">
                      {barcode.productName}
                    </div>
                  )}

                  <div className="mb-3 text-center">
                    {barcodeImage ? (
                      <img
                        src={barcodeImage}
                        alt={`Barcode ${barcode.value}`}
                        className="mx-auto rounded-xl bg-white p-2 shadow-sm"
                      />
                    ) : (
                      <div className="text-sm text-red-500">Invalid barcode</div>
                    )}
                  </div>

                  {details?.ssPrice && (
                    <div className="mb-2 -mt-1 text-center text-base font-semibold text-slate-900 md:text-lg">
                      {details.ssPrice}
                    </div>
                  )}


                  <div className="space-y-1 text-center text-xs text-slate-500">
                    <div className="font-mono">{barcode.value}</div>
                    <div className="flex justify-between">
                      <span>{barcode.format}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${barcode.generated
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                        }`}>
                        {barcode.generated ? 'Generated' : 'Product'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden canvas for barcode generation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default BarcodeManager;
