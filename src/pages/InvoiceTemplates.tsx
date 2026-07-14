import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, Printer, X } from 'lucide-react';
import { Bill } from '../types';
import {
  generateQRData,
  generateRegularA4DetailedReceipt,
  generateRegularA4Receipt,
  generateRegularA5Receipt,
  generateThermalCompactReceipt,
  generateThermalDetailedReceipt,
  generateThermalStandardReceipt,
} from '../utils/templateGenerator';

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'thermal' | 'regular';
  width: number; // in mm
  preview: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'thermal-compact',
    name: 'Thermal - Compact',
    description: 'Compact thermal receipt (80mm) - minimal spacing',
    category: 'thermal',
    width: 80,
    preview: 'Perfect for high-speed transactions with condensed layout'
  },
  {
    id: 'thermal-standard',
    name: 'Thermal - Standard',
    description: 'Standard thermal receipt (80mm) - comfortable spacing',
    category: 'thermal',
    width: 80,
    preview: 'Default format with balanced spacing for thermal printers'
  },
  {
    id: 'thermal-detailed',
    name: 'Thermal - Detailed',
    description: 'Thermal receipt with detailed breakdown',
    category: 'thermal',
    width: 80,
    preview: 'Includes GST breakdown, item codes, and payment details'
  },
  {
    id: 'regular-a5',
    name: 'Regular - A5 (Half Page)',
    description: 'A5 size invoice (148x210mm) - compact',
    category: 'regular',
    width: 148,
    preview: 'Perfect for regular inkjet/laser printers - half page format'
  },
  {
    id: 'regular-a4',
    name: 'Regular - A4 (Full Page)',
    description: 'A4 size invoice (210x297mm) - professional',
    category: 'regular',
    width: 210,
    preview: 'Professional full-page invoice with company logo space'
  },
  {
    id: 'regular-a4-detailed',
    name: 'Regular - A4 Detailed',
    description: 'A4 size with extended details and notes',
    category: 'regular',
    width: 210,
    preview: 'Full-page invoice with customer notes and payment terms'
  }
];

const InvoiceTemplates: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('thermal-standard');
  const [category, setCategory] = useState<'all' | 'thermal' | 'regular'>('all');
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('selected_invoice_template');
      if (saved && TEMPLATES.find(t => t.id === saved)) {
        setSelectedTemplate(saved);
      }
    } catch { }
  }, []);

  const saveTemplate = (templateId: string) => {
    localStorage.setItem('selected_invoice_template', templateId);
    setSelectedTemplate(templateId);
    alert('Template saved! It will be used for all future bills.');
  };

  const filteredTemplates = category === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === category);

  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplate);

  const previewHtml = useMemo(() => {
    const template = TEMPLATES.find(t => t.id === previewTemplateId);
    if (!template) return '';

    const sampleBill: Bill = {
      id: 1,
      billNumber: 'INV-0001',
      customerId: 1,
      totalAmount: 1250,
      totalDiscount: 50,
      totalGst: 67.5,
      finalAmount: 1267.5,
      paymentMethod: 'upi',
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: {
        id: 1,
        name: 'Sample Customer',
        phone: '9876543210',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      items: [
        {
          id: 1,
          billId: 1,
          productId: 1,
          quantity: 2,
          unitPrice: 300,
          discount: 5,
          gst: 12,
          totalPrice: 600,
          product: {
            id: 1,
            name: 'Printed Saree',
            company: 'Bill போடு',
            count: 10,
            costPrice: 250,
            sellingPrice: 300,
            discount: 5,
            gst: 12,
            finalPrice: 324,
            barcode: 'PRD-001',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        {
          id: 2,
          billId: 1,
          productId: 2,
          quantity: 1,
          unitPrice: 650,
          discount: 0,
          gst: 12,
          totalPrice: 650,
          product: {
            id: 2,
            name: 'Designer Blouse',
            company: 'Bill போடு',
            count: 5,
            costPrice: 550,
            sellingPrice: 650,
            discount: 0,
            gst: 12,
            finalPrice: 728,
            barcode: 'PRD-002',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      ],
    };

    const appSettingsRaw = localStorage.getItem('app_settings');
    const appSettings = appSettingsRaw ? JSON.parse(appSettingsRaw) : {};

    const settings = {
      storeName: appSettings.storeName || 'SASHVIKA SAREES',
      upiId: appSettings.upiId || 'sample@upi',
      bankAccountNumber: appSettings.bankAccountNumber || '123456789012',
      bankIfscCode: appSettings.bankIfscCode || 'SBIN0001234',
      accountHolderName: appSettings.accountHolderName || 'SASHVIKA SAREES',
      address: appSettings.address || '32-F, Near Eswaran Temple, Kadaiveethi\nIdappadi – 637101',
      phone: appSettings.phone || '9965326590, 9047656890',
      gstNumber: appSettings.gstNumber || '',
      showGst: appSettings.showGst !== undefined ? appSettings.showGst : true,
      footerMessage: appSettings.footerMessage || 'Thank you for your business!',
      logoUrl: appSettings.logoUrl || ''
    };

    const qrData = generateQRData(sampleBill, settings);

    const renderedHtml = (() => {
      switch (template.id) {
      case 'thermal-compact':
          return generateThermalCompactReceipt(sampleBill, settings, qrData);
      case 'thermal-detailed':
          return generateThermalDetailedReceipt(sampleBill, settings, qrData);
      case 'regular-a5':
          return generateRegularA5Receipt(sampleBill, settings, qrData);
      case 'regular-a4':
          return generateRegularA4Receipt(sampleBill, settings, qrData);
      case 'regular-a4-detailed':
          return generateRegularA4DetailedReceipt(sampleBill, settings, qrData);
      case 'thermal-standard':
      default:
          return generateThermalStandardReceipt(sampleBill, settings, qrData);
      }
    })();

    return renderedHtml.replace(/<script>[\s\S]*?<\/script>\s*$/i, '');
  }, [previewTemplateId]);

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Customization</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Invoice Templates</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Choose a bill template that suits your printer type. The selected template will be used for all future bill printing.</p>
        </div>
      </div>

      {/* Current Selection Info */}
      {currentTemplate && (
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 p-4 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-primary-600 font-semibold">Currently Selected</p>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{currentTemplate.name}</h2>
              <p className="text-sm text-slate-600 mt-1">{currentTemplate.description}</p>
            </div>
            <div className="rounded-full bg-primary-500 p-3">
              <Check className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setCategory('all')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            category === 'all'
              ? 'bg-primary-500 text-white shadow-lg'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Templates
        </button>
        <button
          onClick={() => setCategory('thermal')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            category === 'thermal'
              ? 'bg-primary-500 text-white shadow-lg'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Thermal Printers (80mm)
        </button>
        <button
          onClick={() => setCategory('regular')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            category === 'regular'
              ? 'bg-primary-500 text-white shadow-lg'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Regular Printers (A4/A5)
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className={`card border rounded-2xl p-6 transition-all cursor-pointer ${
              selectedTemplate === template.id
                ? 'border-primary-500 bg-primary-50/50 shadow-lg ring-2 ring-primary-200'
                : 'border-slate-200 bg-white hover:border-primary-300 hover:shadow-lg'
            }`}
            onClick={() => saveTemplate(template.id)}
          >
            {/* Category Badge */}
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                template.category === 'thermal'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {template.category === 'thermal' ? 'Thermal' : 'Regular'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Preview template"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewTemplateId(template.id);
                  }}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {selectedTemplate === template.id && (
                  <Check className="h-5 w-5 text-primary-500" />
                )}
              </div>
            </div>

            {/* Template Name */}
            <h3 className="text-lg font-bold text-slate-900 mb-2">{template.name}</h3>

            {/* Description */}
            <p className="text-sm text-slate-600 mb-3">{template.description}</p>

            {/* Preview Box */}
            <div className={`mb-4 p-3 rounded-xl border-2 border-dashed ${
              template.category === 'thermal'
                ? 'border-blue-200 bg-blue-50'
                : 'border-purple-200 bg-purple-50'
            }`}>
              <div className="text-xs text-slate-600 text-center italic">
                {template.preview}
              </div>
            </div>

            {/* Width Info */}
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-700">
              <Printer className="h-4 w-4 text-slate-400" />
              <span className="font-medium">Width: {template.width}mm</span>
            </div>

            {/* Select Button */}
            <button
              onClick={() => saveTemplate(template.id)}
              className={`w-full py-2 rounded-lg font-semibold transition-all ${
                selectedTemplate === template.id
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              {selectedTemplate === template.id ? '✓ Selected' : 'Select Template'}
            </button>
          </div>
        ))}
      </div>

      {/* Information Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card border border-blue-200 bg-blue-50 p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-blue-900 mb-3">Thermal Printers</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Typically 80mm width (some 58mm)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Used for POS/receipts</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Fast printing, continuous roll paper</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Best for quick transactions</span>
            </li>
          </ul>
        </div>

        <div className="card border border-purple-200 bg-purple-50 p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-purple-900 mb-3">Regular Printers</h3>
          <ul className="space-y-2 text-sm text-purple-800">
            <li className="flex gap-2">
              <span className="text-purple-600 font-bold">•</span>
              <span>Inkjet or Laser printers</span>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-600 font-bold">•</span>
              <span>A4 or A5 paper sizes</span>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-600 font-bold">•</span>
              <span>Professional invoice look</span>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-600 font-bold">•</span>
              <span>Better for detailed records</span>
            </li>
          </ul>
        </div>
      </div>

      {previewTemplateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-600">Template Preview</p>
                <h3 className="text-lg font-bold text-slate-900">
                  {TEMPLATES.find(t => t.id === previewTemplateId)?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplateId(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
              <div className="bg-slate-100 p-4">
                <iframe
                  title="Invoice template preview"
                  srcDoc={previewHtml}
                  className="h-[75vh] w-full rounded-2xl border border-slate-200 bg-white shadow-inner"
                />
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Template Details</p>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  <div>
                    <div className="font-semibold text-slate-900">Printer Type</div>
                    <div>{TEMPLATES.find(t => t.id === previewTemplateId)?.category === 'thermal' ? 'Thermal Printer' : 'Regular Printer'}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">Paper Width</div>
                    <div>{TEMPLATES.find(t => t.id === previewTemplateId)?.width}mm</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">Description</div>
                    <div>{TEMPLATES.find(t => t.id === previewTemplateId)?.description}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (previewTemplateId) {
                      saveTemplate(previewTemplateId);
                      setPreviewTemplateId(null);
                    }
                  }}
                  className="mt-6 w-full rounded-xl bg-primary-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-600"
                >
                  Use This Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceTemplates;
