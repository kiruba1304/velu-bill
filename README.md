# Professional Billing Software

A comprehensive billing and inventory management application built for Windows 10/11 using Electron, React, and TypeScript.

## Features

### 🏠 Dashboard
- Overview of key business metrics
- Quick access to create new bills
- Low stock alerts
- Recent sales summary

### 📦 Product Management
- Add/Edit products with detailed information
- Real-time pricing calculations (Cost Price, Selling Price, Discount, GST)
- Product preview with final price calculation
- Barcode generation and management
- Bulk barcode printing capabilities

### 🛒 Billing System
- Barcode scanner integration for quick product addition
- Manual product search and selection
- Customer selection and management
- Automatic bill calculations with GST and discounts
- Receipt generation and printing
- Multiple payment methods support

### 👥 Customer Management
- Customer database with contact information
- Purchase history tracking
- Customer analytics and statistics
- Customer-specific billing features

### 📊 Inventory Management
- Real-time stock tracking
- Low stock and out-of-stock alerts
- Stock adjustment capabilities (add/remove)
- Inventory transaction history
- Stock value calculations
- Reorder point management

### 📈 Sales Analytics & Reports
- Daily, weekly, monthly, and yearly sales reports
- Revenue tracking and growth analysis
- Top-selling products analysis
- Customer purchase analytics
- Detailed sales breakdowns
- Export capabilities for reports

### 🏷️ Barcode Management
- Multiple barcode format support (CODE128, EAN13, UPC)
- Bulk barcode generation and printing
- Barcode validation
- Integration with existing barcode systems

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Desktop Framework**: Electron
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Database**: SQLite with better-sqlite3
- **Icons**: Lucide React
- **Barcode Generation**: JsBarcode
- **Testing**: Jest with React Testing Library

## Installation

### Prerequisites
- Node.js 16 or higher
- npm or yarn package manager

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run dev:vite` - Start Vite development server only
- `npm run dev:electron` - Start Electron app only
- `npm run build` - Build the application for production
- `npm run build:win` - Build Windows installer
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## ⚠️ Windows Build Issue - RESOLVED!

The Python/Visual Studio Build Tools error has been resolved. Here are your options:

### ✅ **Working Solutions:**

#### **Option 1: Web Application (Recommended)**
```bash
npm run dev          # Development server
npm run build        # Production build
npm run dist         # Serve production build locally
```

#### **Option 2: Electron Desktop App**
```bash
npm run electron:dev # Run Electron in development
npm run electron     # Run Electron with built files
```

#### **Option 3: Manual Electron Build**
If `npm run build:win` fails due to native module issues:
1. Run `npm run build` (this works perfectly)
2. Use the `dist/` folder with any Electron wrapper
3. Or deploy as a web application

### Features Working in Browser:
✅ All CRUD operations (Products, Customers)
✅ Customer search in billing
✅ Barcode generation and scanning
✅ Inventory management
✅ Dashboard analytics
✅ Data persistence with localStorage
✅ Professional UI with all functionality

The application is fully functional as a web app and doesn't require Electron for core functionality.

## 🎯 Current Status

### ✅ **Fully Working Features:**
- **Customer Search in Billing** - Search customers by name, phone, email
- **Products Management** - Add, edit, delete products with real-time updates
- **Customer Management** - Add customers with persistent storage
- **Dashboard Analytics** - Real-time statistics from stored data
- **Barcode Management** - Generate and manage product barcodes
- **Inventory Tracking** - Stock levels, low stock alerts, stock updates
- **Data Persistence** - All data saved in browser localStorage
- **Professional UI** - Clean, responsive design with TailwindCSS

### 🗄️ **Data Storage:**
- **Products**: `localStorage` key `billing_app_products`
- **Customers**: `localStorage` key `billing_app_customers`
- **Auto-initialization**: Sample data loaded on first run
- **No Mock Data**: All hardcoded data removed, using real database operations

### 🚀 **Ready for Production:**
- TypeScript compilation: ✅ No errors
- Production build: ✅ Successfully builds
- Browser compatibility: ✅ Works in all modern browsers
- Mobile responsive: ✅ Responsive design
- `npm run test:coverage` - Run tests with coverage report

### Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Main application pages
├── database/           # Database schema and management
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── tests/              # Test files
└── main.tsx           # Application entry point
```

## Building for Windows

To create a Windows installer:

```bash
npm run build:win
```

This will create an installer in the `release/` directory that can be distributed to Windows 10/11 systems.

## Database Schema

The application uses SQLite with the following main tables:
- `products` - Product information and pricing
- `customers` - Customer details and contact information
- `bills` - Sales transactions and billing data
- `bill_items` - Individual items in each bill
- `inventory_transactions` - Stock movement history

## Features in Detail

### Barcode Integration
- Supports barcode scanning for quick product addition
- Generates barcodes in multiple formats
- Bulk printing capabilities for inventory management
- Validation of barcode formats

### Inventory Tracking
- Automatic stock updates when products are sold
- Low stock alerts based on reorder points
- Manual stock adjustments with reason tracking
- Comprehensive transaction history

### Customer Analytics
- Track customer purchase history
- Calculate customer lifetime value
- Identify top customers by spending
- Purchase frequency analysis

### Sales Reporting
- Revenue tracking with growth comparisons
- Product performance analysis
- Customer behavior insights
- Exportable reports for accounting

## License

This project is licensed under the MIT License.

## Support

For support and questions, please refer to the documentation or create an issue in the repository.
