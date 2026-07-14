export interface Product {
  id: number;
  name: string;
  company: string;
  productCode?: string; // optional for backward-compatibility
  count: number;
  costPrice: number;
  sellingPrice: number;
  discount: number;
  gst: number;
  barcode: string;
  finalPrice: number;
  reservedStock?: number; // Stock reserved for online orders
  hsnCode?: string;
  skuCode?: string;
  images?: string[]; // URLs of product images from website
  createdAt: string;
  updatedAt: string;
  categoryName?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  customizationEnabled?: boolean;
  returnWindowDays?: number;
  allowedBranches?: string; // Comma-separated branch names
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  name: string;
  type?: 'walk-in' | 'online'; // Added for E-commerce integration
  phone: string;
  email?: string;
  address?: string;
  gstNumber?: string; // GST number for client
  totalPurchases?: number; // Total amount spent
  purchaseCount?: number; // Number of purchases
  lastPurchaseDate?: string; // Last purchase date
  lastPurchaseAmount?: number; // Last purchase amount
  creditBalance?: number; // Credit balance for the customer
  creditHistory?: CreditTransaction[]; // Transaction history for credit
  vehicleName?: string;
  vehicleNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: number;
  customerId: number;
  amount: number; // Positive for credit added, negative for credit used
  type: 'added' | 'used' | 'adjusted';
  description?: string;
  billId?: number;
  createdAt: string;
}

export type PartyType = 'supplier' | 'customer' | 'branch' | 'distributor' | 'other';

export interface Party {
  id: number;
  name: string;
  type: PartyType;
  phone?: string;
  email?: string;
  address?: string;
  openingBalance: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PartyMovementType = 'purchase' | 'sale_return' | 'transfer_in' | 'transfer_out' | 'return_in' | 'return_out' | 'adjustment';

export interface PartyStockMovement {
  id: number;
  partyId: number;
  productId: number;
  quantity: number;
  amount?: number;
  movementType: PartyMovementType;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}

export interface PartyPayment {
  id: number;
  partyId: number;
  amount: number;
  method: 'cash' | 'bank' | 'upi' | 'adjustment' | 'other';
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}

export interface BillItem {
  id: number;
  billId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  gst: number;
  totalPrice: number;
  product?: Product;
  productImage?: string; // Thumbnail/image URL for item
}

export interface Bill {
  id: number;
  customerId?: number;
  billNumber: string;
  totalAmount: number;
  totalDiscount: number;
  totalGst: number;
  finalAmount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'credit' | 'other' | 'online' | 'cod';
  status: 'pending' | 'completed' | 'cancelled';
  salesChannel?: 'pos' | 'ecommerce'; // Source of the bill
  invoiceType?: 'customer_bill' | 'seller_bill'; // Type of invoice
  isGstBill?: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  items?: BillItem[];
  shippingCharge?: number;
  shippingGst?: number;
  previousBalance?: number;
  currentlyPaid?: number;
  totalOutstanding?: number;
  netBalance?: number;
}

export interface InventoryTransaction {
  id: number;
  productId: number;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  billId?: number;
  createdAt: string;
}

export interface SalesReport {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  totalSales: number;
  totalProfit: number;
  totalBills: number;
  topProducts: Array<{
    productId: number;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
}

export interface Service {
  id: number;
  customerId?: number | null;
  vehicleName: string;
  vehicleNumber: string;
  serviceDate: string;
  description: string;
  estimatedCost: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  branchId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bike {
  id: number;
  brand: string;
  modelName: string;
  chassisNumber: string;
  engineNumber: string;
  color?: string;
  price: number;
  costPrice: number;
  sellingPrice: number;
  discountPrice: number;
  discountPercentage: number;
  gstPercentage: number;
  showGstInBill: boolean;
  finalPrice: number;
  status: 'available' | 'sold';
  soldToCustomerId?: number | null;
  saleDate?: string | null;
  branchId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BikeServiceReminder {
  id: number;
  bikeId: number;
  customerId: number;
  serviceNo: number;
  scheduledDays: number;
  scheduledDate: string;
  reminderDate: string;
  actualVisitDate?: string | null;
  status: 'pending' | 'overdue' | 'completed';
  notes?: string;
  branchId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id?: number;
  userId: number;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'half_day' | 'leave';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  notes?: string | null;
  branchId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord extends Attendance {
  attendanceId?: number;
  name?: string;
  role?: string;
  username?: string;
}

export interface AttendanceRules {
  id?: number;
  shiftStart: string; // HH:MM
  shiftEnd: string; // HH:MM
  gracePeriodMins: number;
  allowSubadminHoliday?: boolean | number;
  allowSubadminModify?: boolean | number;
  updatedAt?: string;
}

export interface Holiday {
  id?: number;
  date: string; // YYYY-MM-DD
  name: string;
  branchId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeavePermissionRequest {
  id?: number;
  userId: number;
  requestType: 'leave' | 'permission';
  leaveType?: 'sick' | 'casual' | 'other' | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM (for permission)
  endTime?: string | null; // HH:MM (for permission)
  durationHours?: number | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: number | null;
  rejectReason?: string | null;
  branchId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  // Join fields
  employeeName?: string;
  employeeRole?: string;
}


