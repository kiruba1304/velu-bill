import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  Download,
  Filter,
  Eye,
  RefreshCw,
  PieChart,
  LineChart,
  Target,
  Printer,
  Trash2,
  Share2
} from 'lucide-react';
import { useBills, useProducts, useCustomers, useBikes } from '../hooks/useDatabase';
import { useAuth } from '../hooks/useAuth';
import { getStoreSettings } from '../utils/getStoreSettings';
import { exportToExcel } from '../utils/exportToExcel';
import { ShareModal } from '../components/ShareModal';
import {
  generateQRData,
  generateThermalCompactReceipt,
  generateThermalDetailedReceipt,
  generateThermalStandardReceipt,
  generateRegularA5Receipt,
  generateRegularA4Receipt,
  generateRegularA4DetailedReceipt
} from '../utils/templateGenerator';
import { Bill } from '../types';

interface SalesData {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
}

interface ProductSales {
  productId: number;
  productName: string;
  company: string;
  quantitySold: number;
  revenue: number;
  profit: number;
}

interface CustomerSales {
  customerId: number;
  customerName: string;
  totalSpent: number;
  orderCount: number;
  lastPurchase: string;
}

const SalesTrendChart: React.FC<{ data: SalesData[] }> = ({ data }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: SalesData } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl bg-slate-50/55 text-slate-400 w-full">
        <LineChart className="mb-2 h-10 w-10 text-slate-300 animate-pulse" />
        <p className="text-sm font-medium">No sales data for this period</p>
      </div>
    );
  }

  const width = 500;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => d.revenue), 100);
  const cleanMax = Math.ceil(maxVal / 100) * 100;

  // Generate points
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.revenue / cleanMax) * chartHeight;
    return { x, y, data: d };
  });

  let lineD = '';
  let areaD = '';

  if (points.length > 0) {
    lineD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    areaD = `${lineD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;
  }

  const yTicks = [0, cleanMax / 2, cleanMax];
  const step = Math.ceil(data.length / 5) || 1;
  const xTicks = points.filter((_, idx) => idx % step === 0);

  return (
    <div className="relative w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="salesTrendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid Lines */}
        {yTicks.map((tick, i) => {
          const y = padding.top + chartHeight - (tick / cleanMax) * chartHeight;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] font-semibold fill-slate-400"
              >
                ₹{tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Area */}
        {areaD && (
          <path
            d={areaD}
            fill="url(#salesTrendGradient)"
          />
        )}

        {/* Line */}
        {lineD && (
          <path
            d={lineD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* X labels */}
        {xTicks.map((p, idx) => {
          const dateLabel = new Date(p.data.date).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
          });
          return (
            <text
              key={idx}
              x={p.x}
              y={height - 5}
              textAnchor="middle"
              className="text-[9px] font-semibold fill-slate-400"
            >
              {dateLabel}
            </text>
          );
        })}

        {/* Points */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={hoveredPoint?.data.date === p.data.date ? 5.5 : 3.5}
            className={`fill-white stroke-emerald-500 cursor-pointer transition-all duration-150 ${
              hoveredPoint?.data.date === p.data.date ? 'stroke-[2.5px]' : 'stroke-2'
            }`}
            onMouseEnter={() => setHoveredPoint(p)}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute z-10 p-2.5 text-xs font-semibold text-white bg-slate-900/95 rounded-xl shadow-lg pointer-events-none transition-all duration-150 border border-slate-700/50"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100 - 65}%`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="text-[10px] text-slate-300 font-normal">
            {new Date(hoveredPoint.data.date).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </div>
          <div className="text-emerald-400 font-bold mt-0.5">
            Revenue: ₹{hoveredPoint.data.revenue.toLocaleString()}
          </div>
          <div className="text-[9px] text-slate-300 font-normal mt-0.5">
            Orders: {hoveredPoint.data.orders} | Cust: {hoveredPoint.data.customers}
          </div>
        </div>
      )}
    </div>
  );
};

const RevenueByProductChart: React.FC<{ productSales: ProductSales[] }> = ({ productSales }) => {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  const totalRevenue = useMemo(() => productSales.reduce((sum, p) => sum + p.revenue, 0), [productSales]);

  const segments = useMemo(() => {
    if (totalRevenue === 0) return [];
    const sorted = [...productSales].sort((a, b) => b.revenue - a.revenue);
    const top = sorted.slice(0, 4);
    const othersRev = sorted.slice(4).reduce((sum, p) => sum + p.revenue, 0);

    const list = top.map((p, idx) => ({
      name: p.productName,
      revenue: p.revenue,
      percentage: (p.revenue / totalRevenue) * 100,
      color: ['#10b981', '#6366f1', '#f59e0b', '#ec4899'][idx]
    }));

    if (othersRev > 0) {
      list.push({
        name: 'Others',
        revenue: othersRev,
        percentage: (othersRev / totalRevenue) * 100,
        color: '#64748b'
      });
    }

    return list;
  }, [productSales, totalRevenue]);

  if (!productSales || productSales.length === 0 || totalRevenue === 0) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl bg-slate-50/55 text-slate-400 w-full">
        <PieChart className="mb-2 h-10 w-10 text-slate-300 animate-pulse" />
        <p className="text-sm font-medium">No revenue data for this period</p>
      </div>
    );
  }



  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-6 w-full h-full p-2">
      <div className="relative w-36 h-36 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          {segments.map((seg, idx) => {
            const strokeDasharray = `${(seg.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
            accumulatedPercent += seg.percentage;

            const isHovered = hoveredSegment === idx;

            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? 11 : 8}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredSegment(idx)}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredSegment !== null ? (
            <>
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 text-center max-w-[70px] truncate">
                {segments[hoveredSegment].name}
              </span>
              <span className="text-xs font-bold text-slate-800">
                {segments[hoveredSegment].percentage.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Total</span>
              <span className="text-xs font-extrabold text-slate-800">
                ₹{totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(0)}k` : totalRevenue.toFixed(0)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-1.5 w-full min-w-0">
        {segments.map((seg, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-1 rounded-xl transition-all duration-150 ${
              hoveredSegment === idx ? 'bg-slate-100 shadow-sm scale-[1.02]' : ''
            }`}
            onMouseEnter={() => setHoveredSegment(idx)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-[11px] font-semibold text-slate-700 truncate" title={seg.name}>
                {seg.name}
              </span>
            </div>
            <div className="text-right flex-shrink-0 pl-1.5">
              <span className="text-[11px] font-bold text-slate-800">₹{seg.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-[8px] text-slate-400 block leading-none">{seg.percentage.toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const getLocalDateString = (dateObj: Date): string => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Reports: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { bills, refreshBills, deleteBill } = useBills();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { bikes } = useBikes(0);
  const { activeBranchId, branches } = useAuth();
  const [sharingBill, setSharingBill] = useState<Bill | null>(null);

  // Helper to resolve product details for regular products vs showroom bikes (-888)
  const resolveProductDetails = (productId: number, item: any, bill: Bill) => {
    const p = products.find(pp => pp.id === productId);
    let name = p?.name || item.product?.name || `Product #${productId}`;
    let code = p?.productCode || item.product?.productCode || '';
    let company = p?.company || item.product?.company || '';

    if (productId === -888) {
      const billDateStr = bill.createdAt ? new Date(bill.createdAt).toISOString().split('T')[0] : '';
      const soldBike = (bikes || []).find(bike => 
        bike.status === 'sold' && 
        bike.soldToCustomerId === bill.customerId && 
        (bike.saleDate === billDateStr || (bike.saleDate && bill.createdAt && new Date(bike.saleDate).toDateString() === new Date(bill.createdAt).toDateString()))
      );
      if (soldBike) {
        name = `${soldBike.brand} ${soldBike.modelName} (Showroom Bike)`;
        code = soldBike.chassisNumber;
        company = `Chassis: ${soldBike.chassisNumber} | Engine: ${soldBike.engineNumber}`;
      } else {
        name = 'Showroom Bike Sale';
        code = 'BIKE';
      }
    }

    return { name, code, company };
  };

  const populateBillItems = (bill: Bill) => {
    return {
      ...bill,
      items: (bill.items || []).map(item => {
        let prod = products.find(p => p.id === item.productId) || item.product;
        if (item.productId === -888 && !prod) {
          const { name, code, company } = resolveProductDetails(item.productId, item, bill);
          prod = {
            id: -888,
            name,
            company,
            productCode: code,
            barcode: `BIKE_${code}`,
            count: 1,
            costPrice: 0,
            sellingPrice: item.unitPrice,
            discount: item.discount,
            gst: item.gst,
            finalPrice: item.totalPrice,
            createdAt: bill.createdAt,
            updatedAt: bill.createdAt
          };
        }
        return {
          ...item,
          product: prod
        };
      })
    };
  };

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'gst' | 'bills'>(() => {
    try {
      const saved = localStorage.getItem('reports_active_subtab');
      if (saved === 'bills' || saved === 'sales' || saved === 'gst') {
        return saved as 'sales' | 'gst' | 'bills';
      }
    } catch {}
    return 'sales';
  });

  useEffect(() => {
    try {
      localStorage.setItem('reports_active_subtab', activeSubTab);
    } catch {}
  }, [activeSubTab]);
  const [gstRateFilter, setGstRateFilter] = useState<string>('all');

  const periodBills = useMemo(() => {
    if (selectedPeriod === 'daily') {
      const todayStr = getLocalDateString(new Date());
      return bills.filter(b => {
        if (!b.createdAt) return false;
        return getLocalDateString(new Date(b.createdAt)) === todayStr;
      });
    }
    if (selectedPeriod === 'weekly') {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return bills.filter(b => {
        if (!b.createdAt) return false;
        const d = new Date(b.createdAt);
        return d >= sevenDaysAgo && d <= now;
      });
    }
    if (selectedPeriod === 'yearly') {
      return bills.filter(b => {
        if (!b.createdAt) return false;
        const d = new Date(b.createdAt);
        return d.getFullYear() === selectedYear;
      });
    }
    if (selectedPeriod === 'monthly') {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      return bills.filter(b => {
        if (!b.createdAt) return false;
        const d = new Date(b.createdAt);
        return d >= start && d <= end;
      });
    }
    return bills;
  }, [bills, selectedPeriod, selectedMonth, selectedYear]);

  const filteredPeriodBills = useMemo(() => {
    return periodBills.filter(b => {
      if (!b.createdAt) return false;
      const billDate = getLocalDateString(new Date(b.createdAt));
      if (fromDate && billDate < fromDate) return false;
      if (toDate && billDate > toDate) return false;
      return true;
    });
  }, [periodBills, fromDate, toDate]);

  const gstRecords = useMemo(() => {
    const list: Array<{
      id: string;
      billNumber: string;
      createdAt: string;
      branchName: string;
      customerName: string;
      productName: string;
      productCode: string;
      gstRate: number;
      taxableValue: number;
      cgst: number;
      sgst: number;
      totalGst: number;
      grossValue: number;
    }> = [];

    filteredPeriodBills.forEach(b => {
      if (b.isGstBill === false) return;
      const branchName = branches.find(br => Number(br.id) === Number(b.branchId))?.name || 'Main Branch';
      const items = b.items || [];
      const itemDiscounts = items.map(it => Number(it.totalPrice) * (Number(it.discount || 0) / 100));
      const itemBases = items.map((it, idx) => Math.max(0, Number(it.totalPrice) - itemDiscounts[idx]));
      const base = itemBases.reduce((a, c) => a + c, 0);
      const itemDiscSum = itemDiscounts.reduce((a, c) => a + c, 0);
      const extraPart = Math.max(0, Number(b.totalDiscount || 0) - itemDiscSum);

      items.forEach((it, idx) => {
        const itemBase = itemBases[idx] || 0;
        const share = base > 0 ? (itemBase / base) : 0;
        const perItemExtra = extraPart * share;
        let gstInclusive = false;
        try {
          const raw = localStorage.getItem('app_settings');
          if (raw) {
            gstInclusive = !!JSON.parse(raw).gstInclusive;
          }
        } catch {}

        const adjustedBaseRaw = Math.max(0, itemBase - perItemExtra);
        let adjustedBase = adjustedBaseRaw;
        let itemGstAmt = 0;
        let grossValue = 0;

        if (gstInclusive) {
          adjustedBase = adjustedBaseRaw / (1 + Number(it.gst || 0) / 100);
          itemGstAmt = adjustedBaseRaw * (Number(it.gst || 0) / 100) / (1 + Number(it.gst || 0) / 100);
          grossValue = adjustedBaseRaw;
        } else {
          itemGstAmt = adjustedBaseRaw * (Number(it.gst || 0) / 100);
          grossValue = adjustedBaseRaw + itemGstAmt;
        }

        const cgst = itemGstAmt / 2;
        const sgst = itemGstAmt / 2;

        const { name: prodName, code: prodCode } = resolveProductDetails(it.productId, it, b);
        list.push({
          id: `${b.billNumber}-${it.id}`,
          billNumber: b.billNumber,
          createdAt: b.createdAt,
          branchName,
          customerName: b.customer?.name || 'Walk-in Customer',
          productName: prodName,
          productCode: prodCode,
          gstRate: it.gst,
          taxableValue: adjustedBase,
          cgst,
          sgst,
          totalGst: itemGstAmt,
          grossValue,
        });
      });

      const shippingCharge = b.shippingCharge || 0;
      const shippingGst = b.shippingGst || 0;
      if (shippingCharge > 0) {
        const taxableValue = shippingCharge - shippingGst;
        const cgst = shippingGst / 2;
        const sgst = shippingGst / 2;
        const shippingGstRate = taxableValue > 0 ? Math.round((shippingGst / taxableValue) * 100) : 18;
        list.push({
          id: `${b.billNumber}-shipping`,
          billNumber: b.billNumber,
          createdAt: b.createdAt,
          branchName,
          customerName: b.customer?.name || 'Walk-in Customer',
          productName: 'Delivery / Shipping Charge',
          productCode: 'N/A',
          gstRate: shippingGstRate,
          taxableValue,
          cgst,
          sgst,
          totalGst: shippingGst,
          grossValue: shippingCharge,
        });
      }
    });

    return list;
  }, [periodBills, products, bikes]);

  const filteredGstRecords = useMemo(() => {
    return gstRecords.filter(r => {
      if (fromDate && getLocalDateString(new Date(r.createdAt)) < fromDate) return false;
      if (toDate && getLocalDateString(new Date(r.createdAt)) > toDate) return false;
      if (gstRateFilter !== 'all' && r.gstRate !== parseFloat(gstRateFilter)) return false;
      return true;
    });
  }, [gstRecords, fromDate, toDate, gstRateFilter]);

  const uniqueGstRates = useMemo(() => {
    const rates = new Set<number>();
    gstRecords.forEach(r => rates.add(r.gstRate));
    return Array.from(rates).sort((a, b) => a - b);
  }, [gstRecords]);

  const gstSummary = useMemo(() => {
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalGstAmt = 0;
    let totalGross = 0;

    filteredGstRecords.forEach(r => {
      totalTaxable += r.taxableValue;
      totalCgst += r.cgst;
      totalSgst += r.sgst;
      totalGstAmt += r.totalGst;
      totalGross += r.grossValue;
    });

    return { totalTaxable, totalCgst, totalSgst, totalGstAmt, totalGross };
  }, [filteredGstRecords]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getPeriodLabel = () => {
    if (fromDate || toDate) {
      if (fromDate && toDate && fromDate === toDate) {
        return `Daily (${fromDate})`;
      }
      return `Custom Period (${fromDate || 'Start'} to ${toDate || 'End'})`;
    }

    if (selectedPeriod === 'daily') {
      const todayStr = getLocalDateString(new Date());
      return `Daily (${todayStr})`;
    }

    if (selectedPeriod === 'weekly') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      return `Weekly (${getLocalDateString(start)} to ${getLocalDateString(end)})`;
    }

    if (selectedPeriod === 'monthly') {
      const monthName = months[selectedMonth] || '';
      return `Monthly (${monthName} ${selectedYear})`;
    }

    return 'All Records';
  };

  const getPeriodFileSuffix = () => {
    if (fromDate || toDate) {
      if (fromDate && toDate && fromDate === toDate) {
        return `daily_${fromDate}`;
      }
      return `${fromDate || 'start'}_to_${toDate || 'end'}`;
    }

    if (selectedPeriod === 'daily') {
      const todayStr = getLocalDateString(new Date());
      return `daily_${todayStr}`;
    }

    if (selectedPeriod === 'weekly') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      return `weekly_${getLocalDateString(start)}_to_${getLocalDateString(end)}`;
    }

    if (selectedPeriod === 'monthly') {
      const monthName = months[selectedMonth]?.toLowerCase() || '';
      return `monthly_${monthName}_${selectedYear}`;
    }

    if (selectedPeriod === 'yearly') {
      return `yearly_${selectedYear}`;
    }

    return 'all';
  };

  const exportGstReport = () => {
    const rows: (string | number)[][] = [];

    // Group records by branch
    const branchMap = new Map<string, typeof filteredGstRecords>();
    filteredGstRecords.forEach(r => {
      const bKey = r.branchName || 'Main Branch';
      if (!branchMap.has(bKey)) branchMap.set(bKey, []);
      branchMap.get(bKey)!.push(r);
    });

    const isAllBranches = !activeBranchId || branchMap.size > 1;

    branchMap.forEach((records, bName) => {
      if (isAllBranches) {
        rows.push([`BRANCH: ${bName.toUpperCase()}`]);
      }
      rows.push(['Bill Number', 'Date', 'Customer Name', 'Product Name', 'Product Code', 'Taxable Value (₹)', 'GST Rate (%)', 'CGST Amount (₹)', 'SGST Amount (₹)', 'Total GST Amount (₹)', 'Gross Value (₹)']);

      let bTaxable = 0, bCgst = 0, bSgst = 0, bTotalGst = 0, bGross = 0;
      records.forEach(r => {
        bTaxable += r.taxableValue;
        bCgst += r.cgst;
        bSgst += r.sgst;
        bTotalGst += r.totalGst;
        bGross += r.grossValue;

        rows.push([
          r.billNumber,
          new Date(r.createdAt).toLocaleDateString() + ' ' + new Date(r.createdAt).toLocaleTimeString(),
          r.customerName,
          r.productName,
          r.productCode,
          Number(r.taxableValue.toFixed(2)),
          Number(r.gstRate.toFixed(0)),
          Number(r.cgst.toFixed(2)),
          Number(r.sgst.toFixed(2)),
          Number(r.totalGst.toFixed(2)),
          Number(r.grossValue.toFixed(2)),
        ]);
      });

      rows.push([
        `${bName.toUpperCase()} TOTALS`,
        '',
        '',
        '',
        '',
        Number(bTaxable.toFixed(2)),
        '',
        Number(bCgst.toFixed(2)),
        Number(bSgst.toFixed(2)),
        Number(bTotalGst.toFixed(2)),
        Number(bGross.toFixed(2))
      ]);
      rows.push([]);
    });

    if (isAllBranches && branchMap.size > 0) {
      rows.push([
        'GRAND TOTALS (ALL BRANCHES)',
        '',
        '',
        '',
        '',
        Number(gstSummary.totalTaxable.toFixed(2)),
        '',
        Number(gstSummary.totalCgst.toFixed(2)),
        Number(gstSummary.totalSgst.toFixed(2)),
        Number(gstSummary.totalGstAmt.toFixed(2)),
        Number(gstSummary.totalGross.toFixed(2))
      ]);
    }

    const storeSettings = getStoreSettings(null, branches, activeBranchId);
    const headerInfo = {
      reportTitle: `GST Audit Report - ${getPeriodLabel()}`,
      branchName: activeBranchId ? storeSettings.storeName : 'ALL BRANCHES',
      branchId: activeBranchId ? activeBranchId : 'ALL',
      address: activeBranchId ? storeSettings.address : 'All Branches Combined',
      phone: activeBranchId ? storeSettings.phone : '-',
      dateRange: getPeriodLabel()
    };
    exportToExcel(rows, `gst_audit_report_${getPeriodFileSuffix()}.xlsx`, 'GST Audit Report', headerInfo);
  };

  const salesData: SalesData[] = useMemo(() => {
    const map = new Map<string, { revenue: number; orders: number; customers: Set<number> }>();
    filteredPeriodBills.forEach(b => {
      if (!b.createdAt) return;
      const key = getLocalDateString(new Date(b.createdAt));
      if (!map.has(key)) map.set(key, { revenue: 0, orders: 0, customers: new Set() });
      const entry = map.get(key)!;
      entry.revenue += b.finalAmount;
      entry.orders += 1;
      if (b.customerId) entry.customers.add(b.customerId);
    });
    return Array.from(map.entries()).sort(([a],[b]) => a < b ? -1 : 1).map(([date, v]) => ({
      date,
      revenue: v.revenue,
      orders: v.orders,
      customers: v.customers.size,
    }));
  }, [filteredPeriodBills]);

  const filteredSalesData = useMemo(() => {
    return salesData.filter(d => {
      if (fromDate && d.date < fromDate) return false;
      if (toDate && d.date > toDate) return false;
      return true;
    });
  }, [salesData, fromDate, toDate]);

  const productSales: ProductSales[] = useMemo(() => {
    const map = new Map<number, ProductSales>();
    filteredPeriodBills.forEach(b => {
      (b.items || []).forEach(it => {
        const p = products.find(pp => pp.id === it.productId);
        const { name: prodName, company: prodCompany } = resolveProductDetails(it.productId, it, b);
        const rec = map.get(it.productId) || {
          productId: it.productId,
          productName: prodName,
          company: prodCompany,
          quantitySold: 0,
          revenue: 0,
          profit: 0,
        };
        rec.quantitySold += it.quantity;
        let gstInclusive = false;
        try {
          const raw = localStorage.getItem('app_settings');
          if (raw) {
            gstInclusive = !!JSON.parse(raw).gstInclusive;
          }
        } catch {}

        const isBillGstEnabled = b.isGstBill !== false;
        const itemGstRate = isBillGstEnabled ? Number(it.gst || 0) : 0;
        const itemBase = it.totalPrice - (it.totalPrice * it.discount / 100);
        const itemRevenue = gstInclusive ? itemBase : (itemBase + (itemBase * itemGstRate / 100));
        rec.revenue += itemRevenue;
        // rough profit estimate
        if (p) rec.profit += (it.unitPrice - p.costPrice) * it.quantity;
        map.set(it.productId, rec);
      });
    });
    return Array.from(map.values());
  }, [filteredPeriodBills, products, bikes]);

  const customerSales: CustomerSales[] = useMemo(() => {
    const map = new Map<number, CustomerSales>();
    filteredPeriodBills.forEach(b => {
      const cid = b.customerId;
      if (!cid) return;
      const cust = customers.find(c => c.id === cid);
      const rec = map.get(cid) || {
        customerId: cid,
        customerName: cust?.name || `Customer #${cid}`,
        totalSpent: 0,
        orderCount: 0,
        lastPurchase: b.createdAt,
      };
      rec.totalSpent += b.finalAmount;
      rec.orderCount += 1;
      if (new Date(b.createdAt) > new Date(rec.lastPurchase)) rec.lastPurchase = b.createdAt;
      map.set(cid, rec);
    });
    return Array.from(map.values());
  }, [filteredPeriodBills, customers]);

  const calculatePeriodStats = () => {
    const totalRevenue = salesData.reduce((sum, day) => sum + day.revenue, 0);
    const totalOrders = salesData.reduce((sum, day) => sum + day.orders, 0);
    const totalCustomers = salesData.reduce((sum, day) => sum + day.customers, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const previousPeriodRevenue = totalRevenue * 0.85; // Mock previous period data
    const revenueGrowth = ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      avgOrderValue,
      revenueGrowth
    };
  };

  const stats = calculatePeriodStats();

  const onRefresh = () => {
    refreshBills();
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [];

    // Group bills by branch
    const branchMap = new Map<string, typeof filteredPeriodBills>();
    filteredPeriodBills.forEach(b => {
      const bName = branches.find(br => Number(br.id) === Number(b.branchId))?.name || 'Main Branch';
      if (!branchMap.has(bName)) branchMap.set(bName, []);
      branchMap.get(bName)!.push(b);
    });

    const isAllBranches = !activeBranchId || branchMap.size > 1;

    let grandSubtotal = 0, grandDiscount = 0, grandGoodsGst = 0, grandDeliveryCharge = 0, grandDeliveryGst = 0, grandTotalGst = 0, grandFinal = 0, grandItems = 0;

    branchMap.forEach((bills, bName) => {
      if (isAllBranches) {
        rows.push([`BRANCH: ${bName.toUpperCase()}`]);
      }
      rows.push(['Bill Number', 'Date', 'Customer', 'Items Subtotal (₹)', 'Discount (₹)', 'Goods GST (₹)', 'Delivery Charge (₹)', 'Delivery GST (₹)', 'Total GST (₹)', 'Final Amount (₹)', 'Payment Method', 'Items Count']);

      let bSubtotal = 0, bDiscount = 0, bGoodsGst = 0, bDeliveryCharge = 0, bDeliveryGst = 0, bTotalGst = 0, bFinal = 0, bItems = 0;

      bills.forEach(b => {
        const totalGst = b.totalGst || 0;
        const deliveryGst = b.shippingGst || 0;
        const goodsGst = totalGst - deliveryGst;
        const deliveryCharge = b.shippingCharge || 0;
        const subtotal = b.totalAmount || 0;
        const discount = b.totalDiscount || 0;
        const finalAmt = b.finalAmount || 0;
        const itemsCount = b.items?.length || 0;

        bSubtotal += subtotal;
        bDiscount += discount;
        bGoodsGst += goodsGst;
        bDeliveryCharge += deliveryCharge;
        bDeliveryGst += deliveryGst;
        bTotalGst += totalGst;
        bFinal += finalAmt;
        bItems += itemsCount;

        grandSubtotal += subtotal;
        grandDiscount += discount;
        grandGoodsGst += goodsGst;
        grandDeliveryCharge += deliveryCharge;
        grandDeliveryGst += deliveryGst;
        grandTotalGst += totalGst;
        grandFinal += finalAmt;
        grandItems += itemsCount;

        rows.push([
          b.billNumber,
          new Date(b.createdAt).toLocaleString(),
          b.customer?.name || '',
          Number(subtotal.toFixed(2)),
          Number(discount.toFixed(2)),
          Number(goodsGst.toFixed(2)),
          Number(deliveryCharge.toFixed(2)),
          Number(deliveryGst.toFixed(2)),
          Number(totalGst.toFixed(2)),
          Number(finalAmt.toFixed(2)),
          b.paymentMethod,
          Number(itemsCount),
        ]);
      });

      rows.push([
        `${bName.toUpperCase()} TOTALS`,
        '',
        '',
        Number(bSubtotal.toFixed(2)),
        Number(bDiscount.toFixed(2)),
        Number(bGoodsGst.toFixed(2)),
        Number(bDeliveryCharge.toFixed(2)),
        Number(bDeliveryGst.toFixed(2)),
        Number(bTotalGst.toFixed(2)),
        Number(bFinal.toFixed(2)),
        '',
        Number(bItems)
      ]);
      rows.push([]);
    });

    if (isAllBranches && branchMap.size > 0) {
      rows.push([
        'GRAND TOTALS (ALL BRANCHES)',
        '',
        '',
        Number(grandSubtotal.toFixed(2)),
        Number(grandDiscount.toFixed(2)),
        Number(grandGoodsGst.toFixed(2)),
        Number(grandDeliveryCharge.toFixed(2)),
        Number(grandDeliveryGst.toFixed(2)),
        Number(grandTotalGst.toFixed(2)),
        Number(grandFinal.toFixed(2)),
        '',
        Number(grandItems)
      ]);
    }

    const storeSettings = getStoreSettings(null, branches, activeBranchId);
    const headerInfo = {
      reportTitle: `Sales Overview Report - ${getPeriodLabel()}`,
      branchName: activeBranchId ? storeSettings.storeName : 'ALL BRANCHES',
      branchId: activeBranchId ? activeBranchId : 'ALL',
      address: activeBranchId ? storeSettings.address : 'All Branches Combined',
      phone: activeBranchId ? storeSettings.phone : '-',
      dateRange: getPeriodLabel()
    };
    exportToExcel(rows, `sales_report_${getPeriodFileSuffix()}.xlsx`, 'Sales Report', headerInfo);
  };

  const exportBillsListToExcel = () => {
    const rows: (string | number)[][] = [];

    const branchMap = new Map<string, typeof filteredPeriodBills>();
    filteredPeriodBills.forEach(b => {
      const bName = branches.find(br => Number(br.id) === Number(b.branchId))?.name || 'Main Branch';
      if (!branchMap.has(bName)) branchMap.set(bName, []);
      branchMap.get(bName)!.push(b);
    });

    const isAllBranches = !activeBranchId || branchMap.size > 1;

    let grandSubtotal = 0, grandDiscount = 0, grandGst = 0, grandTotal = 0;

    branchMap.forEach((bills, bName) => {
      if (isAllBranches) {
        rows.push([`BRANCH: ${bName.toUpperCase()}`]);
      }
      rows.push(['Invoice No', 'Date & Time', 'Customer Name', 'Subtotal (₹)', 'Discount (₹)', 'GST (₹)', 'Total Amount (₹)', 'Payment Method', 'Status']);

      let bSubtotal = 0, bDiscount = 0, bGst = 0, bTotal = 0;

      bills.forEach(b => {
        const subtotal = b.totalAmount || 0;
        const discount = b.totalDiscount || 0;
        const gst = b.totalGst || 0;
        const finalAmt = b.finalAmount || 0;

        bSubtotal += subtotal;
        bDiscount += discount;
        bGst += gst;
        bTotal += finalAmt;

        grandSubtotal += subtotal;
        grandDiscount += discount;
        grandGst += gst;
        grandTotal += finalAmt;

        rows.push([
          b.billNumber,
          new Date(b.createdAt).toLocaleDateString() + ' ' + new Date(b.createdAt).toLocaleTimeString(),
          b.customer?.name || 'Walk-in Customer',
          Number(subtotal.toFixed(2)),
          Number(discount.toFixed(2)),
          Number(gst.toFixed(2)),
          Number(finalAmt.toFixed(2)),
          b.paymentMethod.toUpperCase(),
          b.status
        ]);
      });

      rows.push([
        `${bName.toUpperCase()} TOTALS`,
        '',
        '',
        Number(bSubtotal.toFixed(2)),
        Number(bDiscount.toFixed(2)),
        Number(bGst.toFixed(2)),
        Number(bTotal.toFixed(2)),
        '',
        ''
      ]);
      rows.push([]);
    });

    if (isAllBranches && branchMap.size > 0) {
      rows.push([
        'GRAND TOTALS (ALL BRANCHES)',
        '',
        '',
        Number(grandSubtotal.toFixed(2)),
        Number(grandDiscount.toFixed(2)),
        Number(grandGst.toFixed(2)),
        Number(grandTotal.toFixed(2)),
        '',
        ''
      ]);
    }

    const storeSettings = getStoreSettings(null, branches, activeBranchId);
    const headerInfo = {
      reportTitle: `Invoices & Bills List - ${getPeriodLabel()}`,
      branchName: activeBranchId ? storeSettings.storeName : 'ALL BRANCHES',
      branchId: activeBranchId ? activeBranchId : 'ALL',
      address: activeBranchId ? storeSettings.address : 'All Branches Combined',
      phone: activeBranchId ? storeSettings.phone : '-',
      dateRange: getPeriodLabel()
    };
    exportToExcel(rows, `invoices_list_${getPeriodFileSuffix()}.xlsx`, 'Invoices List', headerInfo);
  };

  const topProducts = [...productSales]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const topCustomers = [...customerSales]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  const exportSalesDetails = () => {
    const rows: (string | number)[][] = [];

    // Group bills by branch
    const branchMap = new Map<string, typeof filteredPeriodBills>();
    filteredPeriodBills.forEach(b => {
      const bName = branches.find(br => Number(br.id) === Number(b.branchId))?.name || 'Main Branch';
      if (!branchMap.has(bName)) branchMap.set(bName, []);
      branchMap.get(bName)!.push(b);
    });

    const isAllBranches = !activeBranchId || branchMap.size > 1;

    let grandCost = 0, grandSell = 0, grandProfit2 = 0, grandBillFinal = 0, grandBillDiscount = 0;

    branchMap.forEach((bills, bName) => {
      if (isAllBranches) {
        rows.push([`BRANCH: ${bName.toUpperCase()}`]);
      }
      rows.push(['Date', 'Bill No', 'Item Name', 'Code', 'Qty', 'Unit Cost', 'Unit Sell', 'Cost Total', 'Sell Total', 'Item Discount', 'GST', 'Final Bill Total', 'Bill Total Discount', 'Profit']);

      let bCost = 0, bSell = 0, bProfit2 = 0, bBillFinal = 0, bBillDiscount = 0;

      bills.forEach(b => {
        const items = (b.items || []);
        const itemDiscounts = items.map(it => Number(it.totalPrice) * (Number(it.discount || 0) / 100));
        const itemBases = items.map((it, idx) => Math.max(0, Number(it.totalPrice) - itemDiscounts[idx]));
        const base = itemBases.reduce((a, c) => a + c, 0);
        const itemDiscSum = itemDiscounts.reduce((a, c) => a + c, 0);
        const extraPart = Math.max(0, Number(b.totalDiscount || 0) - itemDiscSum);

        items.forEach((it, idx) => {
          const p = products.find(pp => pp.id === it.productId);
          const unitCost = Number(p?.costPrice ?? 0);
          const unitSell = Number(it.unitPrice);
          const qty = Number(it.quantity);
          const costTotal = unitCost * qty;
          const sellTotal = unitSell * qty;

          const itemBase = itemBases[idx] || 0;
          const share = base > 0 ? (itemBase / base) : 0;
          const perItemExtra = extraPart * share;
          const perItemDisc = (itemDiscounts[idx] || 0) + perItemExtra;
          let gstInclusive = false;
          try {
            const raw = localStorage.getItem('app_settings');
            if (raw) {
              gstInclusive = !!JSON.parse(raw).gstInclusive;
            }
          } catch {}

          const isBillGstEnabled = b.isGstBill !== false;
          const itemGstRate = isBillGstEnabled ? Number(it.gst || 0) : 0;
          const adjustedBaseRaw = Math.max(0, itemBase - perItemExtra);
          let itemGst = 0;
          let itemFinalIncGst = 0;

          if (gstInclusive) {
            itemGst = adjustedBaseRaw * (itemGstRate / 100) / (1 + itemGstRate / 100);
            itemFinalIncGst = adjustedBaseRaw;
          } else {
            itemGst = adjustedBaseRaw * (itemGstRate / 100);
            itemFinalIncGst = adjustedBaseRaw + itemGst;
          }

          const profit2 = itemFinalIncGst - costTotal;

          bCost += costTotal;
          bSell += sellTotal;
          bProfit2 += profit2;

          grandCost += costTotal;
          grandSell += sellTotal;
          grandProfit2 += profit2;

          rows.push([
            new Date(b.createdAt).toLocaleDateString(),
            b.billNumber,
            resolveProductDetails(it.productId, it, b).name,
            resolveProductDetails(it.productId, it, b).code,
            qty,
            unitCost.toFixed(2),
            unitSell.toFixed(2),
            costTotal.toFixed(2),
            sellTotal.toFixed(2),
            (-perItemDisc).toFixed(2),
            itemGst.toFixed(2),
            Number(b.finalAmount || 0).toFixed(2),
            Number(b.totalDiscount || 0).toFixed(2),
            profit2.toFixed(2),
          ]);
        });

        bBillFinal += Number(b.finalAmount || 0);
        bBillDiscount += Number(b.totalDiscount || 0);
        grandBillFinal += Number(b.finalAmount || 0);
        grandBillDiscount += Number(b.totalDiscount || 0);
      });

      rows.push([
        `${bName.toUpperCase()} TOTALS`,
        '',
        '',
        '',
        '',
        '',
        '',
        Number(bCost.toFixed(2)),
        Number(bSell.toFixed(2)),
        '',
        '',
        Number(bBillFinal.toFixed(2)),
        Number(bBillDiscount.toFixed(2)),
        Number(bProfit2.toFixed(2))
      ]);
      rows.push([]);
    });

    if (isAllBranches && branchMap.size > 0) {
      rows.push([
        'GRAND TOTALS (ALL BRANCHES)',
        '',
        '',
        '',
        '',
        '',
        '',
        Number(grandCost.toFixed(2)),
        Number(grandSell.toFixed(2)),
        '',
        '',
        Number(grandBillFinal.toFixed(2)),
        Number(grandBillDiscount.toFixed(2)),
        Number(grandProfit2.toFixed(2))
      ]);
    }

    const storeSettings = getStoreSettings(null, branches, activeBranchId);
    const headerInfo = {
      reportTitle: `Itemized Sales Breakdown - ${getPeriodLabel()}`,
      branchName: activeBranchId ? storeSettings.storeName : 'ALL BRANCHES',
      branchId: activeBranchId ? activeBranchId : 'ALL',
      address: activeBranchId ? storeSettings.address : 'All Branches Combined',
      phone: activeBranchId ? storeSettings.phone : '-',
      dateRange: getPeriodLabel()
    };
    exportToExcel(rows, `sales_details_${getPeriodFileSuffix()}.xlsx`, 'Sales Details', headerInfo);
  };


  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - 3 + i);
  }, []);

  const handlePrintBill = (bill: Bill) => {
    // Check if running on Android (Capacitor or WebView)
    const isAndroid = navigator.userAgent.toLowerCase().includes('android') || 
                      (window as any).Capacitor?.getPlatform() === 'android';
                      
    if (isAndroid) {
      const populatedBill = populateBillItems(bill);

      const appSettingsRaw = localStorage.getItem('app_settings');
      const appSettings = appSettingsRaw ? JSON.parse(appSettingsRaw) : {};
      
      const settings = {
        storeName: appSettings.storeName || 'SASHVIKA SAREES',
        upiId: appSettings.upiId || '',
        bankAccountNumber: appSettings.bankAccountNumber || '',
        bankIfscCode: appSettings.bankIfscCode || '',
        accountHolderName: appSettings.accountHolderName || '',
        address: appSettings.address || '',
        phone: appSettings.phone || '',
        gstNumber: appSettings.gstNumber || '',
        showGst: appSettings.showGst !== undefined ? appSettings.showGst : true,
        footerMessage: appSettings.footerMessage || '',
        logoUrl: appSettings.logoUrl || ''
      };

      const qrData = generateQRData(populatedBill, settings);
      const selectedTemplate = localStorage.getItem('selected_invoice_template') || 'thermal-standard';

      let receiptHTML = '';

      switch (selectedTemplate) {
        case 'thermal-compact':
          receiptHTML = generateThermalCompactReceipt(populatedBill, settings, qrData);
          break;
        case 'thermal-detailed':
          receiptHTML = generateThermalDetailedReceipt(populatedBill, settings, qrData);
          break;
        case 'regular-a5':
          receiptHTML = generateRegularA5Receipt(populatedBill, settings, qrData);
          break;
        case 'regular-a4':
          receiptHTML = generateRegularA4Receipt(populatedBill, settings, qrData);
          break;
        case 'regular-a4-detailed':
          receiptHTML = generateRegularA4DetailedReceipt(populatedBill, settings, qrData);
          break;
        case 'thermal-standard':
        default:
          receiptHTML = generateThermalStandardReceipt(populatedBill, settings, qrData);
      }

      const blob = new Blob([receiptHTML], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${bill.billNumber}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Invoice HTML downloaded to your device downloads folder.');
      return;
    }

    const populatedBill = populateBillItems(bill);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const settings = getStoreSettings(bill.branchId, branches, activeBranchId);

    const qrData = generateQRData(populatedBill, settings);
    const selectedTemplate = localStorage.getItem('selected_invoice_template') || 'thermal-standard';

    let receiptHTML = '';

    switch (selectedTemplate) {
      case 'thermal-compact':
        receiptHTML = generateThermalCompactReceipt(populatedBill, settings, qrData);
        break;
      case 'thermal-detailed':
        receiptHTML = generateThermalDetailedReceipt(populatedBill, settings, qrData);
        break;
      case 'regular-a5':
        receiptHTML = generateRegularA5Receipt(populatedBill, settings, qrData);
        break;
      case 'regular-a4':
        receiptHTML = generateRegularA4Receipt(populatedBill, settings, qrData);
        break;
      case 'regular-a4-detailed':
        receiptHTML = generateRegularA4DetailedReceipt(populatedBill, settings, qrData);
        break;
      case 'thermal-standard':
      default:
        receiptHTML = generateThermalStandardReceipt(populatedBill, settings, qrData);
    }

    const api = (window as any).electronAPI;
    if (api?.printHtml) {
      try { (printWindow as any).close(); } catch { }
      const selectedReceiptPrinter = localStorage.getItem('receipt_printer_name') || '';
      api.printHtml(receiptHTML, { deviceName: selectedReceiptPrinter || undefined })
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

    (printWindow as any).document.write(receiptHTML);
    (printWindow as any).document.close();
  };

  const handlePreviewBill = (bill: Bill) => {
    const populatedBill = populateBillItems(bill);

    const settings = getStoreSettings(bill.branchId, branches, activeBranchId);

    const qrData = generateQRData(populatedBill, settings);
    const selectedTemplate = localStorage.getItem('selected_invoice_template') || 'thermal-standard';

    let receiptHTML = '';

    switch (selectedTemplate) {
      case 'thermal-compact':
        receiptHTML = generateThermalCompactReceipt(populatedBill, settings, qrData);
        break;
      case 'thermal-detailed':
        receiptHTML = generateThermalDetailedReceipt(populatedBill, settings, qrData);
        break;
      case 'regular-a5':
        receiptHTML = generateRegularA5Receipt(populatedBill, settings, qrData);
        break;
      case 'regular-a4':
        receiptHTML = generateRegularA4Receipt(populatedBill, settings, qrData);
        break;
      case 'regular-a4-detailed':
        receiptHTML = generateRegularA4DetailedReceipt(populatedBill, settings, qrData);
        break;
      case 'thermal-standard':
      default:
        receiptHTML = generateThermalStandardReceipt(populatedBill, settings, qrData);
    }

    const previewHTML = receiptHTML.replace(
      /<script>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi,
      ''
    );

    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(previewHTML);
      previewWindow.document.close();
    }
  };

  const handleShareBill = (bill: Bill) => {
    const populatedBill = populateBillItems(bill);

    const settings = getStoreSettings(bill.branchId, branches, activeBranchId);

    const qrData = generateQRData(populatedBill, settings);
    const selectedTemplate = localStorage.getItem('selected_invoice_template') || 'thermal-standard';

    let receiptHTML = '';
    switch (selectedTemplate) {
      case 'thermal-compact':
        receiptHTML = generateThermalCompactReceipt(populatedBill, settings, qrData);
        break;
      case 'thermal-detailed':
        receiptHTML = generateThermalDetailedReceipt(populatedBill, settings, qrData);
        break;
      case 'regular-a5':
        receiptHTML = generateRegularA5Receipt(populatedBill, settings, qrData);
        break;
      case 'regular-a4':
        receiptHTML = generateRegularA4Receipt(populatedBill, settings, qrData);
        break;
      case 'regular-a4-detailed':
        receiptHTML = generateRegularA4DetailedReceipt(populatedBill, settings, qrData);
        break;
      case 'thermal-standard':
      default:
        receiptHTML = generateThermalStandardReceipt(populatedBill, settings, qrData);
    }

    const customerName = bill.customer?.name || '';

    const api = (window as any).electronAPI;
    if (api?.saveBillPdf) {
      api.saveBillPdf(bill.billNumber, receiptHTML, customerName)
        .then(() => {
          setSharingBill(populatedBill);
        })
        .catch((err: any) => {
          console.error("Failed to generate PDF for sharing:", err);
          setSharingBill(populatedBill);
        });
    } else {
      setSharingBill(populatedBill);
    }
  };

  const handleDeleteBill = async (id: number, billNumber: string) => {
    if (confirm(`Are you sure you want to permanently delete bill ${billNumber}? This will revert any stock changes and credit balances associated with it.`)) {
      try {
        const success = await deleteBill(id);
        if (success) {
          alert('Bill deleted successfully.');
        } else {
          alert('Failed to delete bill.');
        }
      } catch (err: any) {
        alert('Error deleting bill: ' + (err.message || String(err)));
      }
    }
  };

  return (
    <div className="min-h-full rounded-none md:rounded-[2rem] bg-white/70 p-4 md:p-8 shadow-soft backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-600">Insights</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Sales Analytics & Reports</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Track performance, analyze trends, and generate insights from a polished analytics view.</p>
        </div>
        <div className="flex flex-wrap gap-3 xl:justify-end">
          <button onClick={exportCsv} className="btn-secondary flex items-center gap-2 px-4 py-2">
            <Download className="h-4 w-4" />
            Export Report
          </button>
          <button onClick={onRefresh} className="btn-secondary flex items-center gap-2 px-4 py-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="mb-6 flex border-b border-slate-200/80">
        <button
          onClick={() => setActiveSubTab('sales')}
          className={`pb-3 px-6 text-sm font-bold transition-all border-b-2 ${
            activeSubTab === 'sales'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📈 Sales Overview & Trends
        </button>
        <button
          onClick={() => setActiveSubTab('bills')}
          className={`pb-3 px-6 text-sm font-bold transition-all border-b-2 ${
            activeSubTab === 'bills'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📄 Invoices / Bills List
        </button>
        <button
          onClick={() => setActiveSubTab('gst')}
          className={`pb-3 px-6 text-sm font-bold transition-all border-b-2 ${
            activeSubTab === 'gst'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🧾 GST Auditing Report
        </button>
      </div>

      {/* Period Selection */}
      <div className="card border border-white/60 bg-white/85 shadow-soft mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Period:</span>
            </div>

            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`btn-ghost rounded-full px-4 py-2 text-sm transition-colors ${
                    selectedPeriod === period
                      ? 'bg-primary-100 text-primary-700 shadow-soft font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>

            {selectedPeriod === 'monthly' && (
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="input text-sm"
                >
                  {months.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="input text-sm"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Integrated Auditing Date Range Picker */}
          <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
            <span className="text-xs font-semibold text-slate-500">Date Range:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input text-xs py-1.5 px-2"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input text-xs py-1.5 px-2"
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-xl transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {activeSubTab === 'sales' && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Revenue</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">₹{stats.totalRevenue.toLocaleString()}</p>
                  <div className="flex items-center mt-2">
                    {stats.revenueGrowth >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      stats.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Math.abs(stats.revenueGrowth).toFixed(1)}%
                    </span>
                    <span className="ml-1 text-sm text-slate-500">vs last period</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-green-50 p-3">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Orders</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalOrders}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Avg: {(stats.totalOrders / salesData.length || 0).toFixed(1)} per day
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Customers</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalCustomers}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Unique customers served
                  </p>
                </div>
                <div className="rounded-2xl bg-purple-50 p-3">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Avg Order Value</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">₹{stats.avgOrderValue.toFixed(0)}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Per transaction
                  </p>
                </div>
                <div className="rounded-2xl bg-orange-50 p-3">
                  <Target className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Sales Trend Chart */}
            <div className="card border border-white/60 bg-white/85 shadow-soft flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Sales Trend</h3>
                <LineChart className="h-5 w-5 text-slate-400" />
              </div>

              <div className="flex min-h-[240px] items-center justify-center rounded-2xl bg-slate-50/50 p-4 border border-slate-100/60">
                <SalesTrendChart data={filteredSalesData} />
              </div>
            </div>

            {/* Revenue Distribution */}
            <div className="card border border-white/60 bg-white/85 shadow-soft flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Revenue by Product</h3>
                <PieChart className="h-5 w-5 text-slate-400" />
              </div>

              <div className="flex min-h-[240px] items-center justify-center rounded-2xl bg-slate-50/50 p-4 border border-slate-100/60">
                <RevenueByProductChart productSales={productSales} />
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Top Selling Products</h3>
                <button onClick={() => setShowAllProducts(true)} className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm">
                  <Eye className="h-4 w-4" />
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={product.productId} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                          <span className="text-sm font-bold text-primary-700">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{product.productName}</div>
                        <div className="text-sm text-slate-600">{product.company}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900">₹{product.revenue.toLocaleString()}</div>
                      <div className="text-sm text-slate-500">{product.quantitySold} sold</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Customers */}
            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Top Customers</h3>
                <button onClick={() => setShowAllCustomers(true)} className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm">
                  <Eye className="h-4 w-4" />
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div key={customer.customerId} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                          <span className="text-sm font-bold text-green-700">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{customer.customerName}</div>
                        <div className="text-sm text-slate-600">{customer.orderCount} orders</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900">₹{customer.totalSpent.toLocaleString()}</div>
                      <div className="text-sm text-slate-500">
                        {new Date(customer.lastPurchase).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Sales Table */}
          <div className="card border border-white/60 bg-white/85 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Daily Sales Breakdown</h3>
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <input type="date" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} className="input text-sm" />
                  <span className="text-slate-500">to</span>
                  <input type="date" value={toDate} onChange={(e)=>setToDate(e.target.value)} className="input text-sm" />
                </div>
                <button onClick={exportSalesDetails} className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm">
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Revenue</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Orders</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Customers</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Avg Order Value</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalesData.map((day, index) => {
                    const avgOrderValue = day.orders > 0 ? day.revenue / day.orders : 0;
                    const previousDay = filteredSalesData[index - 1];
                    const growth = previousDay ? ((day.revenue - previousDay.revenue) / previousDay.revenue) * 100 : 0;

                    return (
                      <tr key={day.date} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-slate-700">
                          {new Date(day.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          ₹{day.revenue.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{day.orders}</td>
                        <td className="px-4 py-3 text-slate-700">{day.customers}</td>
                        <td className="px-4 py-3 text-slate-700">₹{avgOrderValue.toFixed(0)}</td>
                        <td className="px-4 py-3">
                          {index > 0 && (
                            <div className="flex items-center">
                              {growth >= 0 ? (
                                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                              )}
                              <span className={`text-sm font-medium ${
                                growth >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {Math.abs(growth).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* View All Modals */}
          {showAllProducts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">All Top Selling Products</h3>
                  <button onClick={() => setShowAllProducts(false)} className="btn-secondary px-3 py-2 text-sm">Close</button>
                </div>
                <div className="space-y-2">
                  {[...productSales].sort((a,b)=>b.revenue-a.revenue).map((p, idx) => (
                    <div key={p.productId} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                          <span className="text-sm font-bold text-primary-700">#{idx + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{p.productName}</div>
                          <div className="text-sm text-slate-600">Qty: {p.quantitySold}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-slate-900">₹{p.revenue.toLocaleString()}</div>
                        <div className="text-sm text-slate-600">Profit: ₹{p.profit.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showAllCustomers && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">All Top Customers</h3>
                  <button onClick={() => setShowAllCustomers(false)} className="btn-secondary px-3 py-2 text-sm">Close</button>
                </div>
                <div className="space-y-2">
                  {[...customerSales].sort((a,b)=>b.totalSpent-a.totalSpent).map((c, idx) => (
                    <div key={c.customerId} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                          <span className="text-sm font-bold text-green-700">#{idx + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{c.customerName}</div>
                          <div className="text-sm text-slate-600">Orders: {c.orderCount}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-slate-900">₹{c.totalSpent.toLocaleString()}</div>
                        <div className="text-sm text-slate-600">Last: {new Date(c.lastPurchase).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeSubTab === 'gst' && (
        <div className="space-y-6">
          {/* GST Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Taxable Value</p>
              <p className="mt-2 text-xl font-bold text-slate-900">₹{gstSummary.totalTaxable.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Net sales before tax</p>
            </div>
            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">CGST Amount</p>
              <p className="mt-2 text-xl font-bold text-slate-900">₹{gstSummary.totalCgst.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Central Tax (50%)</p>
            </div>
            <div className="card border border-white/60 bg-white/85 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">SGST Amount</p>
              <p className="mt-2 text-xl font-bold text-slate-900">₹{gstSummary.totalSgst.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500 mt-1">State Tax (50%)</p>
            </div>
            <div className="card border border-white/60 bg-white/85 shadow-soft bg-primary-50/20">
              <p className="text-xs font-bold uppercase tracking-wider text-primary-700">Total GST Collected</p>
              <p className="mt-2 text-xl font-extrabold text-primary-600">₹{gstSummary.totalGstAmt.toFixed(2)}</p>
              <p className="text-[10px] text-primary-700 mt-1">CGST + SGST</p>
            </div>
            <div className="card border border-white/60 bg-white/85 shadow-soft bg-emerald-50/10">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Gross Sales Value</p>
              <p className="mt-2 text-xl font-extrabold text-emerald-600">₹{gstSummary.totalGross.toFixed(2)}</p>
              <p className="text-[10px] text-emerald-700 mt-1">Taxable + Total GST</p>
            </div>
          </div>

          {/* GST Auditing Log Table */}
          <div className="card border border-white/60 bg-white/85 shadow-soft">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">GST Invoice Audit Log</h3>
                <p className="text-xs text-slate-500 mt-0.5">Auditable itemized invoice journal matching tax structures.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <select
                    value={gstRateFilter}
                    onChange={(e) => setGstRateFilter(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="all">All Tax Rates</option>
                    {uniqueGstRates.map(rate => (
                      <option key={rate} value={rate.toString()}>{rate}% GST</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={exportGstReport}
                  className="btn-secondary flex items-center gap-2 px-3 py-2 text-xs"
                >
                  <Download className="h-4 w-4" />
                  Export GST Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Invoice No</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Date & Time</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Item</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Code</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Taxable Value</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">GST %</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">CGST (50%)</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">SGST (50%)</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Total GST</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Gross Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGstRecords.length > 0 ? (
                    filteredGstRecords.map((rec) => (
                      <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{rec.billNumber}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(rec.createdAt).toLocaleDateString()} {new Date(rec.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{rec.customerName}</td>
                        <td className="px-4 py-3 text-slate-700 truncate max-w-[150px]" title={rec.productName}>
                          {rec.productName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{rec.productCode || '-'}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">₹{rec.taxableValue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                            {Number(rec.gstRate).toFixed(2).replace(/\.00$/, '')}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">₹{rec.cgst.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">₹{rec.sgst.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-primary-600">₹{rec.totalGst.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">₹{rec.grossValue.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-500 font-medium">
                        No transactions found with the active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredGstRecords.length > 0 && (
                  <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-left text-slate-800">TOTAL SUMMARY</td>
                      <td className="px-4 py-3 text-right text-slate-900">₹{gstSummary.totalTaxable.toFixed(2)}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right text-slate-700">₹{gstSummary.totalCgst.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">₹{gstSummary.totalSgst.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-primary-600">₹{gstSummary.totalGstAmt.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">₹{gstSummary.totalGross.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'bills' && (
        <div className="space-y-6">
          <div className="card border border-white/60 bg-white/85 shadow-soft">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Invoices / Bills List</h3>
                <p className="text-xs text-slate-500 mt-0.5">List of all bills generated in the selected period, ordered date-wise.</p>
              </div>
              <button
                onClick={exportBillsListToExcel}
                className="btn-secondary flex items-center gap-2 px-3 py-2 text-xs self-start sm:self-auto"
              >
                <Download className="h-4 w-4" />
                Export Invoices Excel
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Invoice No</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Date & Time</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Customer</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Subtotal</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Discount</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">GST</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment Mode</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeriodBills.length > 0 ? (
                    filteredPeriodBills.map((bill) => {
                      const customerName = bill.customer?.name || 'Walk-in Customer';
                      return (
                        <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-900">{bill.billNumber}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(bill.createdAt).toLocaleDateString()} {new Date(bill.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{customerName}</td>
                          <td className="px-4 py-3 text-right text-slate-600">₹{bill.totalAmount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-red-600">-₹{bill.totalDiscount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">₹{bill.totalGst.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">₹{bill.finalAmount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-left">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700 uppercase">
                              {bill.paymentMethod}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center space-x-2">
                            <button
                              onClick={() => handlePreviewBill(bill)}
                              className="text-slate-500 hover:text-primary-600 p-1.5 rounded-lg border border-slate-200 bg-white shadow-sm inline-flex items-center"
                              title="Preview Bill"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handlePrintBill(bill)}
                              className="text-slate-500 hover:text-primary-600 p-1.5 rounded-lg border border-slate-200 bg-white shadow-sm inline-flex items-center"
                              title="Print Bill"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleShareBill(bill)}
                              className="text-slate-500 hover:text-primary-600 p-1.5 rounded-lg border border-slate-200 bg-white shadow-sm inline-flex items-center"
                              title="Share Bill"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBill(bill.id, bill.billNumber)}
                              className="text-red-500 hover:text-red-700 hover:border-red-300 p-1.5 rounded-lg border border-red-200 bg-white shadow-sm inline-flex items-center"
                              title="Delete Bill"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500 font-medium">
                        No invoices found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {sharingBill && (
        <ShareModal bill={sharingBill} onClose={() => setSharingBill(null)} />
      )}
    </div>
  );
};

export default Reports;
