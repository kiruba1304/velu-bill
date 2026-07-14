import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Barcode,
  Save,
  X,
  Eye,
  RefreshCw,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';
import { Product } from '../types';
import { useProducts, useCategories } from '../hooks/useDatabase';


const getGlobalGstSetting = (): number => {
  try {
    const raw = localStorage.getItem('app_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.gstPercentage !== undefined) {
        return parseFloat(parsed.gstPercentage) || 0;
      }
    }
  } catch {}
  return 18; // default to 18%
};


const Products: React.FC = () => {
  const { products, loading, error, addProduct, updateProduct, deleteProduct, refreshProducts } = useProducts();
  const { categories } = useCategories();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  // Label printer integration (Electron) and selection
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedLabelPrinter, setSelectedLabelPrinter] = useState<string>(() => localStorage.getItem('label_printer_name') || '');
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.listPrinters) {
      api.listPrinters()
        .then((list: any[]) => {
          setPrinters(list || []);
          // Auto-select TVS LP46 Dlite if found
          if (!selectedLabelPrinter) {
            const tvs = (list || []).find((p: any) => /tvs\s*lp\s*46/i.test(p.name) || /tvs\s*lp\s*46/i.test(p.displayName || ''));
            if (tvs) {
              setSelectedLabelPrinter(tvs.name);
              localStorage.setItem('label_printer_name', tvs.name);
            }
          }
        })
        .catch(() => setPrinters([]));
    }
  }, []);
  const onChangeLabelPrinter = (name: string) => {
    setSelectedLabelPrinter(name);
    if (name) localStorage.setItem('label_printer_name', name);
    else localStorage.removeItem('label_printer_name');
  };

  const [formData, setFormData] = useState({
    name: '',
    company: 'N/A',
    productCode: '',
    skuCode: '',
    hsnCode: '',
    count: '' as string | number,
    costPrice: '' as string | number,
    sellingPrice: '' as string | number,
    discount: '' as string | number,
    barcode: '',
    categoryName: ''
  });

  // Calculate final price whenever relevant fields change
  const calculateFinalPrice = (sellingPrice: number, discount: number, gst: number) => {
    const discountAmount = (sellingPrice * discount) / 100;
    const priceAfterDiscount = sellingPrice - discountAmount;
    
    let gstInclusive = false;
    try {
      const raw = localStorage.getItem('app_settings');
      if (raw) {
        gstInclusive = !!JSON.parse(raw).gstInclusive;
      }
    } catch {}

    if (gstInclusive) {
      return priceAfterDiscount;
    }
    const gstAmount = (priceAfterDiscount * gst) / 100;
    return priceAfterDiscount + gstAmount;
  };

  const finalPrice = calculateFinalPrice(
    parseFloat(String(formData.sellingPrice)) || 0,
    parseFloat(String(formData.discount)) || 0,
    getGlobalGstSetting()
  );

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateBarcode = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const barcode = `${timestamp}${random}`.slice(-12);
    setFormData(prev => ({ ...prev, barcode }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const activeGst = getGlobalGstSetting();
      const productData = {
        name: formData.name,
        company: formData.company,
        productCode: formData.skuCode || formData.productCode,
        skuCode: formData.skuCode || formData.productCode,
        hsnCode: formData.hsnCode,
        count: parseInt(String(formData.count)) || 0,
        costPrice: parseFloat(String(formData.costPrice)) || 0,
        sellingPrice: parseFloat(String(formData.sellingPrice)) || 0,
        discount: parseFloat(String(formData.discount)) || 0,
        gst: activeGst,
        barcode: formData.barcode,
        finalPrice,
        categoryName: formData.categoryName
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        setEditingProduct(null);
      } else {
        await addProduct(productData);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company: 'N/A',
      productCode: '',
      skuCode: '',
      hsnCode: '',
      count: '',
      costPrice: '',
      sellingPrice: '',
      discount: '',
      barcode: '',
      categoryName: ''
    });
    setShowAddForm(false);
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      company: product.company,
      productCode: product.skuCode || product.productCode || '',
      skuCode: product.skuCode || product.productCode || '',
      hsnCode: product.hsnCode || '',
      count: product.count,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      discount: product.discount,
      barcode: product.barcode,
      categoryName: product.categoryName || ''
    });
    setEditingProduct(product);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Failed to delete product. Please try again.');
      }
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.productCode ? product.productCode.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
    product.barcode.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Package className="mx-auto mb-4 h-12 w-12 animate-pulse text-slate-400" />
            <p className="text-slate-500">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <p className="mb-2 text-red-500">Error loading products</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const exportBarcodesExcel = () => {
    // Build a simple HTML table and download as .xls (opens in Excel)
    const headers = ['ID', 'Code', 'Name', 'Company', 'Barcode'];
    const escape = (s: string | number) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;');

    const rowsHtml = products.map(p => (
      `<tr>` +
      `<td>${escape(p.id)}</td>` +
      `<td>${escape(p.productCode || '')}</td>` +

      `<td>${escape(p.name)}</td>` +
      `<td>${escape(p.company)}</td>` +
      `<td>${escape(p.barcode)}</td>` +
      `</tr>`
    )).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Barcodes</title></head>
<body>
  <table border="1" cellspacing="0" cellpadding="4">
    <thead>
      <tr>${headers.map(h => `<th>${escape(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'barcodes.xls';
    a.click();
    URL.revokeObjectURL(url);
  };
  const buildLabelsHtml = () => {
    const escape = (s: string | number) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;');

    const labels = products.map(p => {
      const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(p.barcode)}&scale=2&includetext=false&background=ffffff`;
      return (
        `<div class=\"label\">\n          <div class=\"label-inner\">\n            <div class=\"top\">\n              <div class=\"name\">${escape(p.name)}</div>\n              <div class=\"code\">${escape(p.productCode || '')}</div>\n            </div>\n            <img class=\"barcode-img\" src=\"${barcodeUrl}\" alt=\"${escape(p.barcode)}\" />\n            <div class=\"meta\">\n              <div class=\"barcode-text\">${escape(p.barcode)}</div>\n              <div class=\"price">\u20b9${Number(p.sellingPrice).toFixed(2)}</div>\n            </div>\n          </div>\n        </div>`
      );
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>Barcode Labels</title>
  <style>
    @page { size: A4; margin: 10mm; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .sheet { display: grid; grid-template-columns: 10cm 10cm; column-gap: 0.5cm; row-gap: 0.5cm; padding: 5mm; }
    .label { width: 10cm; height: 2.8cm; border: 1px dashed #999; box-sizing: border-box; display: flex; align-items: center; }
    .label-inner { width: 100%; padding: 2mm 3mm; box-sizing: border-box; }
    .top { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2mm; }
    .name { font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 70%; }
    .code { font-family: monospace; font-size: 10px; color: #555; }
    .barcode-img { display:block; margin: 0 auto; width: 95%; max-height: 12mm; object-fit: contain; }
    .meta { display: flex; justify-content: space-between; align-items: center; margin-top: 1mm; font-size: 11px; }
    .barcode-text { font-family: monospace; font-size: 10px; color: #333; }
    .price { font-weight: 700; font-size: 12px; }
    @media print { .sheet { padding: 0; } }
  </style>
</head>
<body>
  <div class=\"sheet\">\n    ${labels}\n  </div>
</body>
</html>`;
  };

  const printLabels = () => {
    const html = buildLabelsHtml();
    const api = (window as any).electronAPI;
    if (api?.printHtml) {
      api.printHtml(html, { deviceName: selectedLabelPrinter || undefined })
        .catch((err: any) => {
          const errMsg = err?.message || String(err);
          if (errMsg.includes('canceled') || errMsg.includes('cancelled')) {
            console.log('Print job was canceled by the user.');
            return;
          }
          alert('Print failed: ' + errMsg);
        });
      return;
    }
    const w = window.open('', '_blank');
    if (!w) return;
    (w as any).document.write(html);
    (w as any).document.close();
    (w as any).focus();
    (w as any).print();
  };

  const downloadLabelsHtml = () => {
    const html = buildLabelsHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'barcode_labels.html'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const ws = utils.json_to_sheet(products.map(p => ({
      ID: p.id,
      Name: p.name,
      Company: p.company,
      SKUCode: p.skuCode || p.productCode || '',
      HSNCode: p.hsnCode || '',
      Stock: p.count,
      CostPrice: p.costPrice,
      SellingPrice: p.sellingPrice,
      Discount: p.discount,
      GST: p.gst,
      FinalPrice: p.finalPrice,
      Barcode: p.barcode
    })));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Products");
    writeFile(wb, "Products_Export.xlsx");
  };

  const downloadSample = () => {
    const ws = utils.json_to_sheet([{
      Name: "Sample Product",
      Company: "Sample Company",
      SKUCode: "SKU-SHIRT-001",
      HSNCode: "62052000",
      Stock: 10,
      CostPrice: 100,
      SellingPrice: 150,
      Discount: 5,
      Barcode: "123456789012"
    }]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "Product_Import_Template.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const wb = read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = utils.sheet_to_json(ws);

        let addedCount = 0;
        const globalGst = getGlobalGstSetting();
        // Process sequentially to avoid database locking issues if any
        for (const row of jsonData as any[]) {
          if (row.Name && row.SellingPrice !== undefined) {
            const sellingPrice = Number(row.SellingPrice) || 0;
            const discount = Number(row.Discount) || 0;
            const gst = globalGst;

            // Calculate final price
            const discountAmount = (sellingPrice * discount) / 100;
            const priceAfterDiscount = sellingPrice - discountAmount;
            
            let gstInclusive = false;
            try {
              const raw = localStorage.getItem('app_settings');
              if (raw) {
                gstInclusive = !!JSON.parse(raw).gstInclusive;
              }
            } catch {}

            const gstAmount = gstInclusive ? 0 : (priceAfterDiscount * gst) / 100;
            const finalPrice = priceAfterDiscount + gstAmount;

            let barcode = row.Barcode ? String(row.Barcode) : '';
            if (!barcode) {
              const timestamp = Date.now();
              const random = Math.floor(Math.random() * 1000);
              barcode = `${timestamp}${random}`.slice(-12);
            }

            const sku = String(row.SKUCode || row.Code || row.SKU || '').trim();
            const hsn = String(row.HSNCode || row.HSN || row.HSCCode || row.HSC || '').trim();

            const newProduct = {
              name: row.Name,
              company: row.Company || 'N/A',
              productCode: sku,
              skuCode: sku,
              hsnCode: hsn,
              count: Number(row.Stock) || 0,
              costPrice: Number(row.CostPrice) || 0,
              sellingPrice,
              discount,
              gst,
              barcode,
              finalPrice
            };

            await addProduct(newProduct);
            addedCount++;
          }
        }
        alert(`Successfully imported ${addedCount} products.`);
        refreshProducts();
      } catch (err) {
        console.error(err);
        alert('Error importing file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset
  };
  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Catalog</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Products Management</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Manage inventory, pricing, discounts, and barcodes from one modern workspace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <button
            onClick={() => {
              const rows = [
                ['ID', 'Code', 'Name', 'Company', 'Stock', 'Cost', 'Selling', 'Discount', 'GST', 'Final', 'Barcode'],
                ...filteredProducts.map(p => [
                  p.id,
                  p.productCode || '',
                  p.name,
                  p.company,
                  p.count,
                  p.costPrice.toFixed(2),
                  p.sellingPrice.toFixed(2),
                  p.discount,
                  p.gst.toFixed(2),
                  p.finalPrice.toFixed(2),
                  p.barcode
                ])
              ];
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'products.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={exportToExcel}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImport}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Import from Excel"
            />
            <button className="btn-secondary flex items-center gap-2 px-4 py-2">
              <Upload className="w-4 h-4" />
              Import Excel
            </button>
          </div>
          <button
            onClick={downloadSample}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
            title="Download Sample Excel Sheet"
          >
            <Download className="w-4 h-4" />
            Sample Sheet
          </button>
          <button
            onClick={exportBarcodesExcel}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
            title="Download all barcodes as Excel (.xls)"
          >
            <Download className="w-4 h-4" />
            Barcodes Excel
          </button>

          {/* Label printer selector (auto-selects TVS LP46 Dlite if present) */}
          <select
            value={selectedLabelPrinter}
            onChange={(e) => onChangeLabelPrinter(e.target.value)}
            className="input"
            style={{ minWidth: 240 }}
            title="Select Label Printer"
          >
            <option value="">Select Label Printer...</option>
            {printers.map((p: any) => (
              <option key={p.name} value={p.name}>{p.displayName || p.name}</option>
            ))}
          </select>

          <button
            onClick={printLabels}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
            title="Direct print 10.0cm x 2.8cm labels (2 columns)"
            disabled={products.length === 0}
          >
            <Download className="w-4 h-4" />
            Print Labels 2×
          </button>
          <button
            onClick={downloadLabelsHtml}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
            title="Download printable labels as HTML"
            disabled={products.length === 0}
          >
            <Download className="w-4 h-4" />
            Labels HTML
          </button>

          <button
            onClick={() => refreshProducts()}
            className="btn-secondary flex items-center gap-2 px-4 py-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search products by name, company, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pr-10 w-full max-w-md"
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Add/Edit Product Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form */}
              <div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="input w-full"
                      placeholder="Enter product name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      className="input w-full"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={formData.categoryName}
                      onChange={(e) => handleInputChange('categoryName', e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stock Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.count}
                      onChange={(e) => handleInputChange('count', e.target.value)}
                      className="input w-full"
                      placeholder="0"
                    />
                  </div>

                  {/* POS Integration Section styled like website */}
                  <div className="bg-primary-50/20 p-4 rounded-2xl border border-primary-100/50 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-primary-700 mb-1">
                        SKU Code (POS Inventory)
                      </label>
                      <input
                        type="text"
                        value={formData.skuCode}
                        onChange={(e) => {
                          handleInputChange('skuCode', e.target.value);
                          handleInputChange('productCode', e.target.value);
                        }}
                        className="input w-full text-sm bg-white"
                        placeholder="e.g., SKU-SHIRT-001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-primary-700 mb-1">
                        HSC / HSN Code (GST classification)
                      </label>
                      <input
                        type="text"
                        value={formData.hsnCode}
                        onChange={(e) => handleInputChange('hsnCode', e.target.value)}
                        className="input w-full text-sm bg-white"
                        placeholder="e.g., 62052000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-primary-700 mb-1">
                        Barcode (Scan Code)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.barcode}
                          onChange={(e) => handleInputChange('barcode', e.target.value)}
                          className="input flex-1 text-sm bg-white"
                          placeholder="Enter or generate barcode"
                        />
                        <button
                          type="button"
                          onClick={generateBarcode}
                          className="btn-secondary flex items-center justify-center p-2 text-xs"
                          title="Generate Barcode"
                        >
                          <Barcode className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cost Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.costPrice}
                        onChange={(e) => handleInputChange('costPrice', e.target.value)}
                        className="input w-full"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Selling Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.sellingPrice}
                        onChange={(e) => handleInputChange('sellingPrice', e.target.value)}
                        className="input w-full"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.discount}
                      onChange={(e) => handleInputChange('discount', e.target.value)}
                      className="input w-full"
                      placeholder="0"
                    />
                  </div>

                  <div className="flex gap-3 pt-5">
                    <button
                      type="submit"
                      className="btn-primary flex items-center gap-2 px-6 py-2"
                    >
                      <Save className="h-4 w-4" />
                      {editingProduct ? 'Update Product' : 'Add Product'}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="btn-secondary px-6 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>

              {/* Product Preview */}
              <div>
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Product Preview</h3>
                <div className="card border border-slate-200 bg-slate-50/80 shadow-soft">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Name</span>
                      <span className="font-medium text-slate-900">{formData.name || 'N/A'}</span>
                    </div>

                    {/* View Product Modal */}
                    {viewingProduct && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="w-full max-w-xl rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
                          <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">Product Details</h2>
                            <button onClick={() => setViewingProduct(null)} className="text-slate-400 hover:text-slate-600">
                              <X className="w-6 h-6" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><span className="text-slate-500">Name:</span><div className="font-medium text-slate-900">{viewingProduct.name}</div></div>
                            <div><span className="text-slate-500">Company:</span><div className="font-medium text-slate-900">{viewingProduct.company}</div></div>
                            <div><span className="text-slate-500">SKU Code:</span><div className="font-medium text-slate-900">{viewingProduct.skuCode || viewingProduct.productCode || '-'}</div></div>
                            <div><span className="text-slate-500">HSN Code:</span><div className="font-medium text-slate-900">{viewingProduct.hsnCode || '-'}</div></div>
                            <div><span className="text-slate-500">Stock:</span><div className="font-medium text-slate-900">{viewingProduct.count}</div></div>
                            <div><span className="text-slate-500">Cost Price:</span><div className="font-medium text-slate-900">₹{viewingProduct.costPrice.toFixed(2)}</div></div>
                            <div><span className="text-slate-500">Selling Price:</span><div className="font-medium text-slate-900">₹{viewingProduct.sellingPrice.toFixed(2)}</div></div>
                            <div><span className="text-slate-500">Discount:</span><div className="font-medium text-slate-900">{viewingProduct.discount}%</div></div>
                            <div><span className="text-slate-500">GST:</span><div className="font-medium text-slate-900">{viewingProduct.gst.toFixed(2)}%</div></div>
                            <div><span className="text-slate-500">Final Price:</span><div className="font-medium text-slate-900">₹{viewingProduct.finalPrice.toFixed(2)}</div></div>
                            <div className="col-span-2"><span className="text-slate-500">Barcode:</span><div className="rounded-xl bg-slate-50 p-2 font-mono">{viewingProduct.barcode}</div></div>
                          </div>
                          <div className="mt-6 text-right">
                            <button onClick={() => setViewingProduct(null)} className="btn-secondary px-4 py-2">Close</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">SKU Code</span>
                      <span className="font-medium">{formData.skuCode || formData.productCode || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">HSN Code</span>
                      <span className="font-medium">{formData.hsnCode || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Company</span>
                      <span className="font-medium">{formData.company}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Count</span>
                      <span className="font-medium">{formData.count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Cost Price</span>
                      <span className="font-medium">₹{(parseFloat(String(formData.costPrice)) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Selling Price</span>
                      <span className="font-medium">₹{(parseFloat(String(formData.sellingPrice)) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Discount</span>
                      <span className="font-medium">{formData.discount || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">GST</span>
                      <span className="font-medium">{getGlobalGstSetting().toFixed(2)}%</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold text-slate-900">Final Price</span>
                      <span className="font-bold text-lg text-primary-600">₹{finalPrice.toFixed(2)}</span>
                    </div>
                    {formData.barcode && (
                      <div className="mt-4">
                        <span className="text-sm text-slate-500">Barcode</span>
                        <div className="mt-1 p-2 bg-white border rounded text-center font-mono text-sm">
                          {formData.barcode}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products List */}
      <div className="card border border-white/60 bg-white/85 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Products List</h2>
          <span className="text-sm text-slate-500">
            {filteredProducts.length} product(s) found
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium text-slate-900">No products found</h3>
            <p className="mb-4 text-slate-600">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first product'}
            </p>
            {!searchTerm && (
              <button onClick={() => setShowAddForm(true)} className="btn-primary px-4 py-2">
                Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-soft">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Product</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">SKU Code</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">HSN Code</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Company</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Category</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Stock</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Cost Price</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Selling Price</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Final Price</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Barcode</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div>
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="text-sm text-slate-500">ID: {product.id}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{product.skuCode || product.productCode || '-'}</td>
                    <td className="px-5 py-4 text-slate-700">{product.hsnCode || '-'}</td>
                    <td className="px-5 py-4 text-slate-700">{product.company}</td>
                    <td className="px-5 py-4 text-slate-700">
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-700 font-medium">
                        {(!product.categoryName || product.categoryName === 'POS Imported') ? 'Uncategorized' : product.categoryName}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${product.count > 10
                        ? 'bg-green-100 text-green-800'
                        : product.count > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {product.count}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">₹{product.costPrice.toFixed(2)}</td>
                    <td className="px-5 py-4 text-slate-700">₹{product.sellingPrice.toFixed(2)}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">₹{product.finalPrice.toFixed(2)}</td>
                    <td className="px-5 py-4">
                      <code className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{product.barcode}</code>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewingProduct(product)} className="btn-icon btn-icon-neutral text-slate-600" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleEdit(product)} className="btn-icon btn-icon-primary" title="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="btn-icon btn-icon-danger" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
