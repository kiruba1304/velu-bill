const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

let pool;
let dbConfig = null;

async function initDb() {
  const config = {
    host: 'mysql-env-wxixfkg1yk.ap-south-1a.lb.nimbuz.tech',
    port: 31885,
    user: 'root',
    password: 'visH325',
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 30000,
    queueLimit: 0,
    decimalNumbers: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000
  };

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('Connected to MySQL server with primary password.');
  } catch (error) {
    console.error('Primary DB connection failed. Trying fallback password:', error.message);
    try {
      config.password = 'visH$325';
      connection = await mysql.createConnection(config);
      console.log('Connected to MySQL server with fallback password.');
    } catch (fallbackError) {
      console.error('All DB connection attempts failed:', fallbackError);
      throw fallbackError;
    }
  }

  // Create database if not exists
  await connection.query('CREATE DATABASE IF NOT EXISTS samdb');
  await connection.end();

  // Store config and create pool
  config.database = 'samdb';
  dbConfig = config;
  pool = mysql.createPool(config);

  // Test pool
  await pool.query('SELECT 1');
  console.log('Connected to database pool successfully.');

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      customizationEnabled BOOLEAN DEFAULT FALSE,
      returnWindowDays INT NULL,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      company VARCHAR(255),
      productCode VARCHAR(255),
      count INT DEFAULT 0,
      costPrice DECIMAL(12,2) DEFAULT 0.00,
      sellingPrice DECIMAL(12,2) DEFAULT 0.00,
      discount DECIMAL(5,2) DEFAULT 0.00,
      gst DECIMAL(5,2) DEFAULT 0.00,
      finalPrice DECIMAL(12,2) DEFAULT 0.00,
      barcode VARCHAR(255) UNIQUE,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255),
      hsnCode VARCHAR(255),
      skuCode VARCHAR(255),
      categoryName VARCHAR(255),
      images JSON
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(255) UNIQUE,
      email VARCHAR(255),
      address TEXT,
      creditBalance DECIMAL(12,2) DEFAULT 0.00,
      creditHistory JSON,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255),
      gstNumber VARCHAR(255),
      type VARCHAR(50) DEFAULT 'standard'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Parties (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50),
      phone VARCHAR(255),
      email VARCHAR(255),
      address TEXT,
      openingBalance DECIMAL(12,2) DEFAULT 0.00,
      notes TEXT,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS PartyMovements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      partyId INT,
      productId INT,
      quantity INT,
      amount DECIMAL(12,2) DEFAULT 0.00,
      movementType VARCHAR(50),
      referenceNo VARCHAR(255),
      notes TEXT,
      createdAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS PartyPayments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      partyId INT,
      amount DECIMAL(12,2) DEFAULT 0.00,
      method VARCHAR(50),
      referenceNo VARCHAR(255),
      notes TEXT,
      createdAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      billNumber VARCHAR(255) UNIQUE NOT NULL,
      customerId INT NULL,
      totalAmount DECIMAL(12,2) DEFAULT 0.00,
      totalDiscount DECIMAL(12,2) DEFAULT 0.00,
      totalGst DECIMAL(12,2) DEFAULT 0.00,
      finalAmount DECIMAL(12,2) DEFAULT 0.00,
      paymentMethod VARCHAR(50),
      status VARCHAR(50),
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255),
      isGstBill BOOLEAN DEFAULT TRUE,
      salesChannel VARCHAR(50) DEFAULT 'pos',
      invoiceType VARCHAR(50) DEFAULT 'customer_bill',
      previousBalance DECIMAL(12,2) NULL,
      currentlyPaid DECIMAL(12,2) NULL,
      totalOutstanding DECIMAL(12,2) NULL,
      netBalance DECIMAL(12,2) NULL,
      shippingCharge DECIMAL(12,2) DEFAULT 0.00,
      shippingGst DECIMAL(12,2) DEFAULT 0.00
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS BillItems (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      billId INT,
      productId INT,
      quantity INT,
      unitPrice DECIMAL(12,2) DEFAULT 0.00,
      discount DECIMAL(5,2) DEFAULT 0.00,
      gst DECIMAL(5,2) DEFAULT 0.00,
      totalPrice DECIMAL(12,2) DEFAULT 0.00,
      productImage TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS InventoryTransactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT,
      type VARCHAR(50),
      quantity INT,
      reason TEXT,
      billId INT NULL,
      createdAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      name VARCHAR(255),
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS RolePermissions (
      role VARCHAR(50) NOT NULL,
      pageId VARCHAR(50) NOT NULL,
      branchId INT NOT NULL DEFAULT 1,
      PRIMARY KEY (role, pageId, branchId)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS UserPermissions (
      username VARCHAR(255) NOT NULL,
      pageId VARCHAR(50) NOT NULL,
      branchId INT NOT NULL DEFAULT 1,
      PRIMARY KEY (username, pageId, branchId)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      date VARCHAR(10) NOT NULL,
      status VARCHAR(50) NOT NULL,
      checkInTime VARCHAR(255) NULL,
      checkOutTime VARCHAR(255) NULL,
      notes TEXT NULL,
      branchId INT NULL DEFAULT 1,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255),
      UNIQUE KEY uq_user_date (userId, date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS AttendanceRules (
      id INT PRIMARY KEY DEFAULT 1,
      shiftStart VARCHAR(10) NOT NULL DEFAULT '09:00',
      shiftEnd VARCHAR(10) NOT NULL DEFAULT '18:00',
      gracePeriodMins INT NOT NULL DEFAULT 15,
      allowSubadminHoliday TINYINT NOT NULL DEFAULT 0,
      allowSubadminModify TINYINT NOT NULL DEFAULT 0,
      updatedAt VARCHAR(255)
    )
  `);

  try {
    await pool.query('ALTER TABLE AttendanceRules ADD COLUMN allowSubadminHoliday TINYINT NOT NULL DEFAULT 0');
  } catch (err) {
    // Ignore duplicate column error
  }
  try {
    await pool.query('ALTER TABLE AttendanceRules ADD COLUMN allowSubadminModify TINYINT NOT NULL DEFAULT 0');
  } catch (err) {
    // Ignore duplicate column error
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Holidays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date VARCHAR(10) NOT NULL,
      name VARCHAR(255) NOT NULL,
      branchId INT NULL,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255),
      UNIQUE KEY uq_holiday_date_branch (date, branchId)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS LeavePermissionRequests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      requestType VARCHAR(50) NOT NULL,
      leaveType VARCHAR(50) NULL,
      startDate VARCHAR(10) NOT NULL,
      endDate VARCHAR(10) NOT NULL,
      startTime VARCHAR(5) NULL,
      endTime VARCHAR(5) NULL,
      durationHours DECIMAL(4,2) NULL,
      reason TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      approvedBy INT NULL,
      rejectReason TEXT NULL,
      branchId INT NULL DEFAULT 1,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Branches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255),
      phone VARCHAR(255),
      gst VARCHAR(255),
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NULL,
      vehicleName VARCHAR(255),
      vehicleNumber VARCHAR(50),
      serviceDate VARCHAR(255),
      description TEXT,
      estimatedCost DECIMAL(12,2) DEFAULT 0.00,
      status VARCHAR(50) DEFAULT 'pending',
      branchId INT NULL DEFAULT 1,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Bikes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brand VARCHAR(255) NOT NULL,
      modelName VARCHAR(255) NOT NULL,
      chassisNumber VARCHAR(255) UNIQUE NOT NULL,
      engineNumber VARCHAR(255) UNIQUE NOT NULL,
      color VARCHAR(100),
      price DECIMAL(12,2) DEFAULT 0.00,
      costPrice DECIMAL(12,2) DEFAULT 0.00,
      sellingPrice DECIMAL(12,2) DEFAULT 0.00,
      discountPrice DECIMAL(12,2) DEFAULT 0.00,
      discountPercentage DECIMAL(5,2) DEFAULT 0.00,
      gstPercentage DECIMAL(5,2) DEFAULT 0.00,
      showGstInBill BOOLEAN DEFAULT TRUE,
      finalPrice DECIMAL(12,2) DEFAULT 0.00,
      status VARCHAR(50) DEFAULT 'available',
      soldToCustomerId INT NULL,
      saleDate VARCHAR(255) NULL,
      branchId INT NULL DEFAULT 1,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS BikeServiceReminders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bikeId INT NOT NULL,
      customerId INT NOT NULL,
      serviceNo INT NOT NULL,
      scheduledDays INT NOT NULL,
      scheduledDate VARCHAR(255) NOT NULL,
      reminderDate VARCHAR(255) NOT NULL,
      actualVisitDate VARCHAR(255) NULL,
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      branchId INT NULL DEFAULT 1,
      createdAt VARCHAR(255),
      updatedAt VARCHAR(255)
    )
  `);

  // Helper to add branchId column to tables if not present
  async function addColumnIfNotExists(tableName, columnName, definition) {
    try {
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tableName, columnName]
      );
      if (columns.length === 0) {
        await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
        console.log(`Added column ${columnName} to table ${tableName}.`);
      }
    } catch (err) {
      console.error(`Failed to add column ${columnName} to table ${tableName}:`, err);
    }
  }

  // Add branchId to isolated tables
  await addColumnIfNotExists('Users', 'branchId', 'INT NULL');
  await addColumnIfNotExists('Products', 'branchId', 'INT NULL DEFAULT 1');
  await addColumnIfNotExists('Categories', 'branchId', 'INT NULL DEFAULT 1');
  await addColumnIfNotExists('Customers', 'branchId', 'INT NULL DEFAULT 1');
  await addColumnIfNotExists('Bills', 'branchId', 'INT NULL DEFAULT 1');
  await addColumnIfNotExists('InventoryTransactions', 'branchId', 'INT NULL DEFAULT 1');
  await addColumnIfNotExists('Parties', 'branchId', 'INT NULL DEFAULT 1');
  await addColumnIfNotExists('PartyMovements', 'branchId', 'INT NULL DEFAULT 1');
  await addColumnIfNotExists('PartyPayments', 'branchId', 'INT NULL DEFAULT 1');

  // Add Vehicle fields to Customers table
  await addColumnIfNotExists('Customers', 'vehicleName', 'VARCHAR(255) NULL');
  await addColumnIfNotExists('Customers', 'vehicleNumber', 'VARCHAR(50) NULL');

  // Add pricing fields to Bikes table
  await addColumnIfNotExists('Bikes', 'costPrice', 'DECIMAL(12,2) DEFAULT 0.00');
  await addColumnIfNotExists('Bikes', 'sellingPrice', 'DECIMAL(12,2) DEFAULT 0.00');
  await addColumnIfNotExists('Bikes', 'discountPrice', 'DECIMAL(12,2) DEFAULT 0.00');
  await addColumnIfNotExists('Bikes', 'discountPercentage', 'DECIMAL(5,2) DEFAULT 0.00');
  await addColumnIfNotExists('Bikes', 'gstPercentage', 'DECIMAL(5,2) DEFAULT 0.00');
  await addColumnIfNotExists('Bikes', 'showGstInBill', 'BOOLEAN DEFAULT TRUE');
  await addColumnIfNotExists('Bikes', 'finalPrice', 'DECIMAL(12,2) DEFAULT 0.00');

  // Migrate RolePermissions branchId column & primary key
  await addColumnIfNotExists('RolePermissions', 'branchId', 'INT NOT NULL DEFAULT 1');
  try {
    await pool.query('ALTER TABLE RolePermissions DROP PRIMARY KEY');
    await pool.query('ALTER TABLE RolePermissions ADD PRIMARY KEY (role, pageId, branchId)');
  } catch (err) {
    // Ignore if already migrated
  }

  // Migrate Categories unique index constraint from global to (name, branchId)
  try {
    await pool.query('ALTER TABLE Categories DROP INDEX name');
  } catch (err) {
    // Ignore if index doesn't exist
  }
  try {
    await pool.query('ALTER TABLE Categories ADD UNIQUE KEY uq_category_name_branch (name, branchId)');
  } catch (err) {
    // Ignore if constraint already exists
  }

  // Seed default branch if empty
  const [branchesCountRows] = await pool.query('SELECT COUNT(*) as count FROM Branches');
  if (branchesCountRows[0].count === 0) {
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO Branches (id, name, address, phone, gst, createdAt, updatedAt) VALUES (1, 'Main Branch', 'Store Address', '9999999999', 'GSTIN12345', ?, ?)`,
      [now, now]
    );
    console.log('Seeded default Main Branch (ID: 1).');
  }

  // Seed default users if empty
  const [usersCountRows] = await pool.query('SELECT COUNT(*) as count FROM Users');
  if (usersCountRows[0].count === 0) {
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO Users (username, password, role, name, branchId, createdAt, updatedAt) VALUES 
       (?, ?, 'super_admin', 'Super Admin', NULL, ?, ?),
       (?, ?, 'admin', 'Admin User', NULL, ?, ?),
       (?, ?, 'employee', 'Employee User', 1, ?, ?)`,
      [
        'superadmin', hashPassword('superadmin123'), now, now,
        'admin', hashPassword('admin123'), now, now,
        'employee', hashPassword('employee123'), now, now
      ]
    );
    console.log('Seeded default users (superadmin, admin, employee).');
  }

  // Seed default employee and sub_admin permissions if empty
  const [permsCountRows] = await pool.query('SELECT COUNT(*) as count FROM RolePermissions');
  if (permsCountRows[0].count === 0) {
    await pool.query(
      `INSERT INTO RolePermissions (role, pageId) VALUES 
       ('employee', 'dashboard'),
       ('employee', 'billing'),
       ('employee', 'products'),
       ('employee', 'categories'),
       ('employee', 'barcodes'),
       ('employee', 'customers'),
       ('employee', 'online_orders'),
       ('employee', 'services'),
       ('employee', 'service_bill'),
       ('employee', 'sale_bike'),
       ('employee', 'inventory'),
       ('employee', 'parties'),
       ('employee', 'reports'),
       ('employee', 'templates'),
       ('employee', 'settings'),
       ('employee', 'attendance'),
       ('sub_admin', 'dashboard'),
       ('sub_admin', 'billing'),
       ('sub_admin', 'products'),
       ('sub_admin', 'categories'),
       ('sub_admin', 'barcodes'),
       ('sub_admin', 'customers'),
       ('sub_admin', 'online_orders'),
       ('sub_admin', 'services'),
       ('sub_admin', 'service_bill'),
       ('sub_admin', 'sale_bike'),
       ('sub_admin', 'inventory'),
       ('sub_admin', 'parties'),
       ('sub_admin', 'reports'),
       ('sub_admin', 'templates'),
       ('sub_admin', 'settings'),
       ('sub_admin', 'attendance')`
    );
    console.log('Seeded default employee and sub_admin permissions.');
  } else {
    // Make sure all sidebar pages are added to existing databases
    try {
      await pool.query(
        `INSERT IGNORE INTO RolePermissions (role, pageId) VALUES 
         ('employee', 'service_bill'),
         ('sub_admin', 'service_bill'),
         ('employee', 'sale_bike'),
         ('sub_admin', 'sale_bike'),
         ('employee', 'categories'),
         ('sub_admin', 'categories'),
         ('employee', 'templates'),
         ('sub_admin', 'templates'),
         ('employee', 'settings'),
         ('sub_admin', 'settings'),
         ('employee', 'inventory'),
         ('employee', 'parties'),
         ('employee', 'attendance'),
         ('sub_admin', 'attendance'),
         ('employee', 'reports')`
      );
    } catch (e) {
      console.error('Failed to auto-seed role permissions for all pages:', e);
    }
  }

  // Seed default attendance rules if empty
  try {
    const [rulesCountRows] = await pool.query('SELECT COUNT(*) as count FROM AttendanceRules');
    if (rulesCountRows[0].count === 0) {
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO AttendanceRules (id, shiftStart, shiftEnd, gracePeriodMins, updatedAt) VALUES (1, '09:00', '18:00', 15, ?)`,
        [now]
      );
      console.log('Seeded default attendance rules.');
    }
  } catch (err) {
    console.error('Failed to seed default attendance rules:', err);
  }

  console.log('Database tables successfully verified/created.');

  // Normalize empty strings to NULL for unique columns to avoid duplicate key errors
  try {
    await pool.query("UPDATE Products SET barcode = NULL WHERE barcode = ''");
    await pool.query("UPDATE Customers SET phone = NULL WHERE phone = ''");
  } catch (err) {
    console.error('Failed to normalize unique columns:', err);
  }
}

// Rebuild the connection pool after a fatal/timeout error
async function reconnectPool() {
  if (!dbConfig) throw new Error('DB config not available for reconnect');
  console.log('Reconnecting to database pool...');
  try {
    await pool.end();
  } catch (_) { /* ignore errors while closing dead pool */ }
  pool = mysql.createPool(dbConfig);
  await pool.query('SELECT 1'); // verify new pool works
  console.log('Database pool reconnected successfully.');
}

// Returns true for errors that mean the connection is dead and we should retry
function isFatalConnectionError(err) {
  if (err && err.fatal) return true;
  const code = err && (err.code || err.errorno || '');
  return [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'PROTOCOL_CONNECTION_LOST',
    'ER_SERVER_LOST',
  ].includes(code);
}

async function executeDbCall(method, args) {
  if (!pool) {
    throw new Error('Database not initialized');
  }

  // Inner runner – extracted so we can retry once after reconnect
  const run = () => _executeDbCallInner(method, args);

  try {
    return await run();
  } catch (firstErr) {
    if (isFatalConnectionError(firstErr)) {
      console.warn('DB connection lost, attempting pool reconnect before retry...', firstErr.code || firstErr.message);
      try {
        await reconnectPool();
        return await run(); // single retry on fresh pool
      } catch (retryErr) {
        console.error('DB retry after reconnect also failed:', retryErr.message);
        throw retryErr;
      }
    }
    throw firstErr;
  }
}

async function _executeDbCallInner(method, args) {
  if (!pool) {
    throw new Error('Database not initialized');
  }

  const parseJsonField = (field) => {
    if (field === null || field === undefined) return [];
    if (typeof field === 'object') return field;
    try {
      return JSON.parse(field);
    } catch (e) {
      return [];
    }
  };

  switch (method) {
    case 'getProducts': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM Products WHERE branchId = ? OR branchId IS NULL ORDER BY id ASC', [targetBranch]);
      return rows.map(r => ({
        ...r,
        images: parseJsonField(r.images)
      }));
    }
    case 'createProduct': {
      const [productData, branchId] = args;
      const targetBranch = branchId === undefined ? 1 : branchId;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO Products (name, company, productCode, count, costPrice, sellingPrice, discount, gst, finalPrice, barcode, createdAt, updatedAt, hsnCode, skuCode, categoryName, images, branchId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productData.name,
          productData.company || '',
          productData.productCode || '',
          productData.count || 0,
          productData.costPrice || 0,
          productData.sellingPrice || 0,
          productData.discount || 0,
          productData.gst || 0,
          productData.finalPrice || 0,
          productData.barcode && productData.barcode.trim() !== '' ? productData.barcode.trim() : null,
          now,
          now,
          productData.hsnCode || '',
          productData.skuCode || '',
          productData.categoryName || '',
          JSON.stringify(productData.images || []),
          targetBranch
        ]
      );
      return res.insertId;
    }
    case 'updateProduct': {
      const [id, updates] = args;
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'branchId') continue;
        fields.push(`\`${key}\` = ?`);
        if (key === 'images') {
          values.push(JSON.stringify(val || []));
        } else if (key === 'barcode') {
          values.push(val && val.trim() !== '' ? val.trim() : null);
        } else {
          values.push(val);
        }
      }
      if (fields.length === 0) return true;
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(id);

      const [res] = await pool.query(`UPDATE Products SET ${fields.join(', ')} WHERE id = ?`, values);
      return res.affectedRows > 0;
    }
    case 'deleteProduct': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Products WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }

    case 'getAttendance': {
      const [date, branchId] = args;
      const targetBranch = branchId || 1;
      const query = `
        SELECT u.id as userId, u.username, u.name, u.role, u.branchId,
               a.id as attendanceId, a.date, a.status, a.checkInTime, a.checkOutTime, a.notes
        FROM Users u
        LEFT JOIN Attendance a ON u.id = a.userId AND a.date = ?
        WHERE (u.branchId = ? OR u.branchId IS NULL OR ? = 0) AND u.role != 'super_admin'
        ORDER BY u.name ASC
      `;
      const [rows] = await pool.query(query, [date, targetBranch, targetBranch]);
      return rows;
    }
    case 'saveAttendance': {
      const [record] = args;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO Attendance (userId, date, status, checkInTime, checkOutTime, notes, branchId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           checkInTime = VALUES(checkInTime),
           checkOutTime = VALUES(checkOutTime),
           notes = VALUES(notes),
           updatedAt = VALUES(updatedAt)`,
        [
          record.userId,
          record.date,
          record.status,
          record.checkInTime || null,
          record.checkOutTime || null,
          record.notes || null,
          record.branchId || 1,
          now,
          now
        ]
      );
      return res.insertId || true;
    }
    case 'getAttendanceReport': {
      const [month, year, branchId] = args;
      const targetBranch = branchId || 1;
      const query = `
        SELECT a.id, a.userId, a.date, a.status, a.checkInTime, a.checkOutTime, a.notes,
               u.name, u.role, u.username
        FROM Attendance a
        JOIN Users u ON a.userId = u.id
        WHERE a.date LIKE ? AND (a.branchId = ? OR a.branchId IS NULL OR ? = 0)
        ORDER BY a.date ASC, u.name ASC
      `;
      const [rows] = await pool.query(query, [`${year}-${String(month).padStart(2, '0')}%`, targetBranch, targetBranch]);
      return rows;
    }
    case 'getAttendanceRules': {
      const [rows] = await pool.query('SELECT * FROM AttendanceRules WHERE id = 1');
      if (rows.length === 0) {
        return { shiftStart: '09:00', shiftEnd: '18:00', gracePeriodMins: 15 };
      }
      return rows[0];
    }
    case 'saveAttendanceRules': {
      const [rules] = args;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO AttendanceRules (id, shiftStart, shiftEnd, gracePeriodMins, allowSubadminHoliday, allowSubadminModify, updatedAt)
         VALUES (1, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           shiftStart = VALUES(shiftStart),
           shiftEnd = VALUES(shiftEnd),
           gracePeriodMins = VALUES(gracePeriodMins),
           allowSubadminHoliday = VALUES(allowSubadminHoliday),
           allowSubadminModify = VALUES(allowSubadminModify),
           updatedAt = VALUES(updatedAt)`,
        [rules.shiftStart || '09:00', rules.shiftEnd || '18:00', rules.gracePeriodMins ?? 15, rules.allowSubadminHoliday ? 1 : 0, rules.allowSubadminModify ? 1 : 0, now]
      );
      return true;
    }
    case 'getMyAttendanceHistory': {
      const [userId, month, year] = args;
      const query = `
        SELECT * FROM Attendance
        WHERE userId = ? AND date LIKE ?
        ORDER BY date ASC
      `;
      const [rows] = await pool.query(query, [userId, `${year}-${String(month).padStart(2, '0')}%`]);
      return rows;
    }

    case 'getHolidays': {
      const [branchId] = args;
      const [rows] = (branchId === 0)
        ? await pool.query('SELECT * FROM Holidays ORDER BY date ASC')
        : await pool.query('SELECT * FROM Holidays WHERE branchId = ? OR branchId IS NULL ORDER BY date ASC', [branchId || 1]);
      return rows;
    }
    case 'saveHoliday': {
      const [holiday] = args;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO Holidays (date, name, branchId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           updatedAt = VALUES(updatedAt)`,
        [
          holiday.date,
          holiday.name,
          holiday.branchId || null,
          now,
          now
        ]
      );
      return res.insertId || true;
    }
    case 'deleteHoliday': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Holidays WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }
    case 'getLeaveRequests': {
      const [branchId, userId] = args;
      let query = `
        SELECT l.*, u.name as employeeName, u.role as employeeRole
        FROM LeavePermissionRequests l
        JOIN Users u ON l.userId = u.id
      `;
      const params = [];
      const conditions = [];
      if (userId) {
        conditions.push('l.userId = ?');
        params.push(userId);
      }
      if (branchId && branchId !== 0) {
        conditions.push('(l.branchId = ? OR l.branchId IS NULL)');
        params.push(branchId);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY l.id DESC';
      const [rows] = await pool.query(query, params);
      return rows;
    }
    case 'saveLeaveRequest': {
      const [request] = args;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO LeavePermissionRequests (userId, requestType, leaveType, startDate, endDate, startTime, endTime, durationHours, reason, status, approvedBy, rejectReason, branchId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          request.userId,
          request.requestType,
          request.leaveType || null,
          request.startDate,
          request.endDate,
          request.startTime || null,
          request.endTime || null,
          request.durationHours || null,
          request.reason,
          request.status || 'pending',
          request.approvedBy || null,
          request.rejectReason || null,
          request.branchId || null,
          now,
          now
        ]
      );
      return res.insertId;
    }
    case 'updateLeaveRequestStatus': {
      const [id, status, approvedBy, rejectReason] = args;
      const now = new Date().toISOString();
      
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        
        await conn.query(
          `UPDATE LeavePermissionRequests 
           SET status = ?, approvedBy = ?, rejectReason = ?, updatedAt = ?
           WHERE id = ?`,
          [status, approvedBy, rejectReason || null, now, id]
        );
        
        if (status === 'approved') {
          // Fetch the request details to check if it's a leave
          const [requests] = await conn.query('SELECT * FROM LeavePermissionRequests WHERE id = ?', [id]);
          if (requests.length > 0) {
            const req = requests[0];
            if (req.requestType === 'leave') {
              // Generate dates list
              const dates = [];
              let current = new Date(req.startDate);
              const end = new Date(req.endDate);
              while (current <= end) {
                dates.push(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
              }
              
              // Insert/update Attendance records as 'leave'
              for (const d of dates) {
                await conn.query(
                  `INSERT INTO Attendance (userId, date, status, notes, branchId, createdAt, updatedAt)
                   VALUES (?, ?, 'leave', 'Approved Leave Request', ?, ?, ?)
                   ON DUPLICATE KEY UPDATE
                     status = 'leave',
                     notes = 'Approved Leave Request',
                     updatedAt = ?`,
                  [req.userId, d, req.branchId || 1, now, now, now]
                );
              }
            }
          }
        }
        
        await conn.commit();
        return true;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    case 'getCategories': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM Categories WHERE branchId = ? ORDER BY id ASC', [targetBranch]);
      return rows.map(r => ({
        ...r,
        customizationEnabled: !!r.customizationEnabled
      }));
    }
    case 'createCategory': {
      const [categoryData, branchId] = args;
      const targetBranch = branchId || 1;
      const [existing] = await pool.query('SELECT id FROM Categories WHERE LOWER(name) = LOWER(?) AND branchId = ?', [categoryData.name, targetBranch]);
      if (existing.length > 0) {
        return existing[0].id;
      }
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO Categories (name, description, customizationEnabled, returnWindowDays, createdAt, updatedAt, branchId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          categoryData.name,
          categoryData.description || '',
          categoryData.customizationEnabled ? 1 : 0,
          categoryData.returnWindowDays ?? null,
          now,
          now,
          targetBranch
        ]
      );
      return res.insertId;
    }
    case 'updateCategory': {
      const [id, updates] = args;
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'branchId') continue;
        fields.push(`\`${key}\` = ?`);
        values.push(val);
      }
      if (fields.length === 0) return true;
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(id);

      const [res] = await pool.query(`UPDATE Categories SET ${fields.join(', ')} WHERE id = ?`, values);
      return res.affectedRows > 0;
    }
    case 'deleteCategory': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Categories WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }

    case 'getCustomers': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM Customers WHERE branchId = ? ORDER BY id ASC', [targetBranch]);
      return rows.map(r => ({
        ...r,
        creditHistory: parseJsonField(r.creditHistory)
      }));
    }
    case 'createCustomer': {
      const [customerData, branchId] = args;
      const targetBranch = branchId || 1;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO Customers (name, phone, email, address, creditBalance, creditHistory, createdAt, updatedAt, gstNumber, type, branchId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerData.name,
          customerData.phone && customerData.phone.trim() !== '' ? customerData.phone.trim() : null,
          customerData.email || '',
          customerData.address || '',
          customerData.creditBalance || 0,
          JSON.stringify(customerData.creditHistory || []),
          now,
          now,
          customerData.gstNumber || '',
          customerData.type || 'standard',
          targetBranch
        ]
      );
      return res.insertId;
    }
    case 'updateCustomer': {
      const [id, updates] = args;
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;
        fields.push(`\`${key}\` = ?`);
        if (key === 'creditHistory') {
          values.push(JSON.stringify(val || []));
        } else if (key === 'phone') {
          values.push(val && val.trim() !== '' ? val.trim() : null);
        } else {
          values.push(val);
        }
      }
      if (fields.length === 0) return true;
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(id);

      const [res] = await pool.query(`UPDATE Customers SET ${fields.join(', ')} WHERE id = ?`, values);
      return res.affectedRows > 0;
    }
    case 'deleteCustomer': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Customers WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }

    case 'getParties': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM Parties WHERE branchId = ? ORDER BY id ASC', [targetBranch]);
      return rows;
    }
    case 'createParty': {
      const [partyData, branchId] = args;
      const targetBranch = branchId || 1;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO Parties (name, type, phone, email, address, openingBalance, notes, createdAt, updatedAt, branchId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partyData.name,
          partyData.type || '',
          partyData.phone || '',
          partyData.email || '',
          partyData.address || '',
          partyData.openingBalance || 0,
          partyData.notes || '',
          now,
          now,
          targetBranch
        ]
      );
      return res.insertId;
    }
    case 'updateParty': {
      const [id, updates] = args;
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'branchId') continue;
        fields.push(`\`${key}\` = ?`);
        values.push(val);
      }
      if (fields.length === 0) return true;
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(id);

      const [res] = await pool.query(`UPDATE Parties SET ${fields.join(', ')} WHERE id = ?`, values);
      return res.affectedRows > 0;
    }
    case 'deleteParty': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Parties WHERE id = ?', [id]);
      await pool.query('DELETE FROM PartyMovements WHERE partyId = ?', [id]);
      return res.affectedRows > 0;
    }

    case 'getPartyMovements': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM PartyMovements WHERE branchId = ? ORDER BY id ASC', [targetBranch]);
      return rows;
    }
    case 'createPartyMovement': {
      const [movementData, branchId] = args;
      const targetBranch = branchId || 1;
      const now = new Date().toISOString();

      const stockChangeMap = {
        purchase: 1,
        sale_return: 1,
        transfer_in: 1,
        return_in: 1,
        adjustment: 1,
        transfer_out: -1,
        return_out: -1,
      };
      const factor = stockChangeMap[movementData.movementType] || 0;
      const stockDelta = movementData.quantity * factor;

      await pool.query('UPDATE Products SET count = GREATEST(0, count + ?) WHERE id = ?', [stockDelta, movementData.productId]);

      const [res] = await pool.query(
        `INSERT INTO PartyMovements (partyId, productId, quantity, amount, movementType, referenceNo, notes, createdAt, branchId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementData.partyId,
          movementData.productId,
          movementData.quantity,
          movementData.amount || 0,
          movementData.movementType,
          movementData.referenceNo || '',
          movementData.notes || '',
          now,
          targetBranch
        ]
      );
      return res.insertId;
    }

    case 'getPartyPayments': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM PartyPayments WHERE branchId = ? ORDER BY id ASC', [targetBranch]);
      return rows;
    }
    case 'createPartyPayment': {
      const [paymentData, branchId] = args;
      const targetBranch = branchId || 1;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO PartyPayments (partyId, amount, method, referenceNo, notes, createdAt, branchId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentData.partyId,
          paymentData.amount || 0,
          paymentData.method,
          paymentData.referenceNo || '',
          paymentData.notes || '',
          now,
          targetBranch
        ]
      );
      return res.insertId;
    }

    case 'getBills': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [bills] = await pool.query('SELECT * FROM Bills WHERE branchId = ? ORDER BY createdAt DESC', [targetBranch]);
      const [items] = await pool.query('SELECT * FROM BillItems');
      const [allCustomers] = await pool.query('SELECT * FROM Customers WHERE branchId = ?', [targetBranch]);

      const customersMap = {};
      for (const c of allCustomers) {
        c.creditHistory = parseJsonField(c.creditHistory);
        customersMap[c.id] = c;
      }

      const itemsByBillId = {};
      for (const item of items) {
        if (!itemsByBillId[item.billId]) {
          itemsByBillId[item.billId] = [];
        }
        itemsByBillId[item.billId].push(item);
      }

      return bills.map(b => ({
        ...b,
        isGstBill: !!b.isGstBill,
        customer: customersMap[b.customerId],
        items: itemsByBillId[b.id] || []
      }));
    }
    case 'createBill': {
      const [newBill, branchId] = args;
      const targetBranch = branchId || 1;
      const nowIso = new Date().toISOString();

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [billRes] = await conn.query(
          `INSERT INTO Bills (billNumber, customerId, totalAmount, totalDiscount, totalGst, finalAmount, paymentMethod, status, createdAt, updatedAt, isGstBill, salesChannel, invoiceType, previousBalance, currentlyPaid, totalOutstanding, netBalance, shippingCharge, shippingGst, branchId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newBill.billNumber,
            newBill.customerId || null,
            newBill.totalAmount || 0,
            newBill.totalDiscount || 0,
            newBill.totalGst || 0,
            newBill.finalAmount || 0,
            newBill.paymentMethod,
            newBill.status || 'completed',
            newBill.createdAt || nowIso,
            nowIso,
            newBill.isGstBill !== false ? 1 : 0,
            newBill.salesChannel || 'pos',
            newBill.invoiceType || 'customer_bill',
            newBill.previousBalance ?? null,
            newBill.currentlyPaid ?? null,
            newBill.totalOutstanding ?? null,
            newBill.netBalance ?? null,
            newBill.shippingCharge || 0,
            newBill.shippingGst || 0,
            targetBranch
          ]
        );
        const billId = billRes.insertId;

        for (const item of newBill.items || []) {
          if (newBill.invoiceType !== 'seller_bill') {
            await conn.query('UPDATE Products SET count = GREATEST(0, count - ?) WHERE id = ?', [item.quantity, item.productId]);

            await conn.query(
              `INSERT INTO InventoryTransactions (productId, type, quantity, reason, billId, createdAt, branchId)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                item.productId,
                'out',
                item.quantity,
                newBill.salesChannel === 'ecommerce' ? 'e-commerce sale' : 'sale',
                billId,
                nowIso,
                targetBranch
              ]
            );
          }

          await conn.query(
            `INSERT INTO BillItems (billId, productId, quantity, unitPrice, discount, gst, totalPrice, productImage)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              billId,
              item.productId,
              item.quantity,
              item.unitPrice,
              item.discount || 0,
              item.gst || 0,
              item.totalPrice,
              item.productImage || ''
            ]
          );
        }

        await conn.commit();
        return billId;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }
    case 'updateBill': {
      const [billNumber, updates] = args;
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'items' || key === 'customer' || key === 'branchId') continue;
        fields.push(`\`${key}\` = ?`);
        values.push(val);
      }
      if (fields.length === 0) return true;
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(billNumber);

      const [res] = await pool.query(`UPDATE Bills SET ${fields.join(', ')} WHERE billNumber = ?`, values);
      return res.affectedRows > 0;
    }
    case 'getBillsByCustomer': {
      const [customerId, branchId] = args;
      const targetBranch = branchId || 1;
      const [bills] = await pool.query('SELECT * FROM Bills WHERE customerId = ? AND branchId = ? ORDER BY createdAt DESC', [customerId, targetBranch]);
      const [items] = await pool.query('SELECT * FROM BillItems');
      const itemsByBillId = {};
      for (const item of items) {
        if (!itemsByBillId[item.billId]) {
          itemsByBillId[item.billId] = [];
        }
        itemsByBillId[item.billId].push(item);
      }
      return bills.map(b => ({
        ...b,
        isGstBill: !!b.isGstBill,
        items: itemsByBillId[b.id] || []
      }));
    }

    case 'getTransactions': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM InventoryTransactions WHERE branchId = ? ORDER BY createdAt DESC', [targetBranch]);
      return rows;
    }

    case 'generateSqlDump': {
      let sql = '';

      const [products] = await pool.query('SELECT * FROM Products');
      sql += '-- Table: Products\n';
      products.forEach(p => {
        sql += `INSERT INTO Products VALUES (${p.id}, '${p.name.replace(/'/g, "''")}', '${(p.company || '').replace(/'/g, "''")}', '${(p.productCode || '').replace(/'/g, "''")}', ${p.count}, ${p.costPrice}, ${p.sellingPrice}, ${p.discount}, ${p.gst}, ${p.finalPrice}, '${(p.barcode || '').replace(/'/g, "''")}', '${p.createdAt}', '${p.updatedAt}', '${(p.hsnCode || '').replace(/'/g, "''")}', '${(p.skuCode || '').replace(/'/g, "''")}', '${(p.categoryName || '').replace(/'/g, "''")}', '${JSON.stringify(parseJsonField(p.images)).replace(/'/g, "''")}');\n`;
      });
      sql += '\n';

      const [categories] = await pool.query('SELECT * FROM Categories');
      sql += '-- Table: Categories\n';
      categories.forEach(c => {
        sql += `INSERT INTO Categories VALUES (${c.id}, '${c.name.replace(/'/g, "''")}', '${(c.description || '').replace(/'/g, "''")}', ${c.customizationEnabled ? 1 : 0}, ${c.returnWindowDays !== null ? c.returnWindowDays : 'NULL'}, '${c.createdAt}', '${c.updatedAt}');\n`;
      });
      sql += '\n';

      const [customers] = await pool.query('SELECT * FROM Customers');
      sql += '-- Table: Customers\n';
      customers.forEach(c => {
        sql += `INSERT INTO Customers VALUES (${c.id}, '${c.name.replace(/'/g, "''")}', '${c.phone.replace(/'/g, "''")}', '${(c.email || '').replace(/'/g, "''")}', '${(c.address || '').replace(/'/g, "''")}', ${c.creditBalance || 0}, '${JSON.stringify(parseJsonField(c.creditHistory)).replace(/'/g, "''")}', '${c.createdAt}', '${c.updatedAt}', '${(c.gstNumber || '').replace(/'/g, "''")}', '${c.type || 'standard'}');\n`;
      });
      sql += '\n';

      const [parties] = await pool.query('SELECT * FROM Parties');
      sql += '-- Table: Parties\n';
      parties.forEach(p => {
        sql += `INSERT INTO Parties VALUES (${p.id}, '${p.name.replace(/'/g, "''")}', '${p.type}', '${(p.phone || '').replace(/'/g, "''")}', '${(p.email || '').replace(/'/g, "''")}', '${(p.address || '').replace(/'/g, "''")}', ${p.openingBalance || 0}, '${(p.notes || '').replace(/'/g, "''")}', '${p.createdAt}', '${p.updatedAt}');\n`;
      });
      sql += '\n';

      const [movements] = await pool.query('SELECT * FROM PartyMovements');
      sql += '-- Table: PartyMovements\n';
      movements.forEach(m => {
        sql += `INSERT INTO PartyMovements VALUES (${m.id}, ${m.partyId}, ${m.productId}, ${m.quantity}, ${m.amount || 0}, '${m.movementType}', '${(m.referenceNo || '').replace(/'/g, "''")}', '${(m.notes || '').replace(/'/g, "''")}', '${m.createdAt}');\n`;
      });
      sql += '\n';

      const [payments] = await pool.query('SELECT * FROM PartyPayments');
      sql += '-- Table: PartyPayments\n';
      payments.forEach(p => {
        sql += `INSERT INTO PartyPayments VALUES (${p.id}, ${p.partyId}, ${p.amount || 0}, '${p.method}', '${(p.referenceNo || '').replace(/'/g, "''")}', '${(p.notes || '').replace(/'/g, "''")}', '${p.createdAt}');\n`;
      });
      sql += '\n';

      const [bills] = await pool.query('SELECT * FROM Bills');
      sql += '-- Table: Bills\n';
      bills.forEach(b => {
        sql += `INSERT INTO Bills VALUES (${b.id}, '${b.billNumber.replace(/'/g, "''")}', ${b.customerId || 'NULL'}, ${b.totalAmount || 0}, ${b.totalDiscount || 0}, ${b.totalGst || 0}, ${b.finalAmount || 0}, '${b.paymentMethod}', '${b.status}', '${b.createdAt}', '${b.updatedAt}', ${b.isGstBill ? 1 : 0}, '${b.salesChannel || 'pos'}', '${b.invoiceType || 'customer_bill'}', ${b.previousBalance ?? 'NULL'}, ${b.currentlyPaid ?? 'NULL'}, ${b.totalOutstanding ?? 'NULL'}, ${b.netBalance ?? 'NULL'}, ${b.shippingCharge || 0}, ${b.shippingGst || 0});\n`;
      });
      sql += '\n';

      const [billItems] = await pool.query('SELECT * FROM BillItems');
      sql += '-- Table: BillItems\n';
      billItems.forEach(item => {
        sql += `INSERT INTO BillItems VALUES (${Math.floor(item.id)}, ${item.billId}, ${item.productId}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.gst}, ${item.totalPrice}, '${(item.productImage || '').replace(/'/g, "''")}');\n`;
      });
      sql += '\n';

      const [transactions] = await pool.query('SELECT * FROM InventoryTransactions');
      sql += '-- Table: InventoryTransactions\n';
      transactions.forEach(t => {
        sql += `INSERT INTO InventoryTransactions VALUES (${t.id}, ${t.productId}, '${t.type}', ${t.quantity}, '${t.reason.replace(/'/g, "''")}', ${t.billId || 'NULL'}, '${t.createdAt}');\n`;
      });

      return sql;
    }
    case 'importSqlDump': {
      const [sql] = args;
      const lines = sql.split('\n');
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query('DELETE FROM BillItems');
        await conn.query('DELETE FROM Bills');
        await conn.query('DELETE FROM InventoryTransactions');
        await conn.query('DELETE FROM PartyPayments');
        await conn.query('DELETE FROM PartyMovements');
        await conn.query('DELETE FROM Parties');
        await conn.query('DELETE FROM Customers');
        await conn.query('DELETE FROM Products');
        await conn.query('DELETE FROM Categories');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('INSERT INTO')) {
            await conn.query(trimmed);
          }
        }

        await conn.commit();
        return true;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }
    case 'wipeDatabase': {
      await pool.query('DELETE FROM BillItems');
      await pool.query('DELETE FROM Bills');
      await pool.query('DELETE FROM InventoryTransactions');
      await pool.query('DELETE FROM PartyPayments');
      await pool.query('DELETE FROM PartyMovements');
      await pool.query('DELETE FROM Parties');
      await pool.query('DELETE FROM Customers');
      await pool.query('DELETE FROM Products');
      await pool.query('DELETE FROM Categories');
      await pool.query('DELETE FROM BikeServiceReminders');
      await pool.query('DELETE FROM Bikes');
      await pool.query('DELETE FROM Services');
      return true;
    }
    case 'login': {
      const [username, password] = args;
      const hashed = hashPassword(password);
      const [rows] = await pool.query('SELECT id, username, role, name, branchId FROM Users WHERE username = ? AND password = ?', [username, hashed]);
      if (rows.length === 0) {
        throw new Error('Invalid username or password.');
      }
      return rows[0];
    }
    case 'getUsers': {
      const [rows] = await pool.query('SELECT id, username, role, name, branchId, createdAt FROM Users ORDER BY id ASC');
      return rows;
    }
    case 'createUser': {
      const [userData] = args;
      const hashed = hashPassword(userData.password);
      const now = new Date().toISOString();
      const [res] = await pool.query(
        'INSERT INTO Users (username, password, role, name, branchId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userData.username, hashed, userData.role, userData.name || '', userData.branchId !== undefined ? userData.branchId : null, now, now]
      );
      return res.insertId;
    }
    case 'updateUser': {
      const [id, userData] = args;
      const fields = [];
      const values = [];

      for (const [key, val] of Object.entries(userData)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;
        if (key === 'password') {
          if (val) {
            fields.push('`password` = ?');
            values.push(hashPassword(val));
          }
        } else {
          fields.push(`\`${key}\` = ?`);
          values.push(val);
        }
      }

      if (fields.length === 0) return true;

      const now = new Date().toISOString();
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(id);

      const [res] = await pool.query(`UPDATE Users SET ${fields.join(', ')} WHERE id = ?`, values);
      return res.affectedRows > 0;
    }
    case 'deleteUser': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Users WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }
    case 'getRolePermissions': {
      const [role, branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT pageId FROM RolePermissions WHERE role = ? AND branchId = ?', [role, targetBranch]);
      if (rows.length === 0 && targetBranch !== 1) {
        const [fallbackRows] = await pool.query('SELECT pageId FROM RolePermissions WHERE role = ? AND branchId = 1', [role]);
        return fallbackRows.map(r => r.pageId);
      }
      return rows.map(r => r.pageId);
    }
    case 'updateRolePermissions': {
      const [role, branchId, pageIds] = args;
      const targetBranch = branchId || 1;
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM RolePermissions WHERE role = ? AND branchId = ?', [role, targetBranch]);
        if (pageIds && pageIds.length > 0) {
          const insertValues = pageIds.map(pId => [role, pId, targetBranch]);
          await conn.query('INSERT INTO RolePermissions (role, pageId, branchId) VALUES ?', [insertValues]);
        }
        await conn.commit();
        return true;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }
    case 'getUserPermissions': {
      const [username, branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT pageId FROM UserPermissions WHERE username = ? AND branchId = ?', [username, targetBranch]);
      return rows.map(r => r.pageId);
    }
    case 'updateUserPermissions': {
      const [username, branchId, pageIds] = args;
      const targetBranch = branchId || 1;
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM UserPermissions WHERE username = ? AND branchId = ?', [username, targetBranch]);
        if (pageIds && pageIds.length > 0) {
          const insertValues = pageIds.map(pId => [username, pId, targetBranch]);
          await conn.query('INSERT INTO UserPermissions (username, pageId, branchId) VALUES ?', [insertValues]);
        }
        await conn.commit();
        return true;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }
    case 'getBranches': {
      const [rows] = await pool.query('SELECT id, name, address, phone, gst, createdAt FROM Branches ORDER BY id ASC');
      return rows;
    }
    case 'createBranch': {
      const [branchData] = args;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        'INSERT INTO Branches (name, address, phone, gst, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [branchData.name, branchData.address || '', branchData.phone || '', branchData.gst || '', now, now]
      );
      return res.insertId;
    }
    case 'updateBranch': {
      const [id, branchData] = args;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        'UPDATE Branches SET name = ?, address = ?, phone = ?, gst = ?, updatedAt = ? WHERE id = ?',
        [branchData.name, branchData.address || '', branchData.phone || '', branchData.gst || '', now, id]
      );
      return res.affectedRows > 0;
    }
    case 'deleteBranch': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Branches WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }
    case 'getServices': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM Services WHERE branchId = ? ORDER BY id DESC', [targetBranch]);
      return rows;
    }
    case 'createService': {
      const [serviceData, branchId] = args;
      const targetBranch = branchId || 1;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO Services (customerId, vehicleName, vehicleNumber, serviceDate, description, estimatedCost, status, branchId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serviceData.customerId || null,
          serviceData.vehicleName || '',
          serviceData.vehicleNumber || '',
          serviceData.serviceDate || now,
          serviceData.description || '',
          serviceData.estimatedCost || 0.00,
          serviceData.status || 'pending',
          targetBranch,
          now,
          now
        ]
      );
      return res.insertId;
    }
    case 'updateService': {
      const [id, updates] = args;
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'branchId') continue;
        fields.push(`\`${key}\` = ?`);
        values.push(val);
      }
      if (fields.length === 0) return true;
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(id);

      const [res] = await pool.query(`UPDATE Services SET ${fields.join(', ')} WHERE id = ?`, values);
      return res.affectedRows > 0;
    }
    case 'deleteService': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Services WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }
    case 'getBikes': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM Bikes WHERE branchId = ? ORDER BY id DESC', [targetBranch]);
      return rows;
    }
    case 'createBike': {
      const [bikeData, branchId] = args;
      const targetBranch = branchId || 1;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO Bikes (brand, modelName, chassisNumber, engineNumber, color, price, costPrice, sellingPrice, discountPrice, discountPercentage, gstPercentage, showGstInBill, finalPrice, status, soldToCustomerId, saleDate, branchId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bikeData.brand,
          bikeData.modelName,
          bikeData.chassisNumber,
          bikeData.engineNumber,
          bikeData.color || '',
          bikeData.price || 0.00,
          bikeData.costPrice || 0.00,
          bikeData.sellingPrice || 0.00,
          bikeData.discountPrice || 0.00,
          bikeData.discountPercentage || 0.00,
          bikeData.gstPercentage || 0.00,
          bikeData.showGstInBill !== undefined ? bikeData.showGstInBill : true,
          bikeData.finalPrice || 0.00,
          bikeData.status || 'available',
          bikeData.soldToCustomerId || null,
          bikeData.saleDate || null,
          targetBranch,
          now,
          now
        ]
      );
      return res.insertId;
    }
    case 'updateBike': {
      const [id, updates] = args;
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'branchId') continue;
        fields.push(`\`${key}\` = ?`);
        values.push(val);
      }
      if (fields.length === 0) return true;
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(id);
      const [res] = await pool.query(`UPDATE Bikes SET ${fields.join(', ')} WHERE id = ?`, values);
      return res.affectedRows > 0;
    }
    case 'deleteBike': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM Bikes WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }
    case 'getBikeServiceReminders': {
      const [branchId] = args;
      const targetBranch = branchId || 1;
      const [rows] = await pool.query('SELECT * FROM BikeServiceReminders WHERE branchId = ? ORDER BY id DESC', [targetBranch]);
      return rows;
    }
    case 'createBikeServiceReminder': {
      const [reminderData, branchId] = args;
      const targetBranch = branchId || 1;
      const now = new Date().toISOString();
      const [res] = await pool.query(
        `INSERT INTO BikeServiceReminders (bikeId, customerId, serviceNo, scheduledDays, scheduledDate, reminderDate, actualVisitDate, status, notes, branchId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reminderData.bikeId,
          reminderData.customerId,
          reminderData.serviceNo,
          reminderData.scheduledDays,
          reminderData.scheduledDate,
          reminderData.reminderDate,
          reminderData.actualVisitDate || null,
          reminderData.status || 'pending',
          reminderData.notes || '',
          targetBranch,
          now,
          now
        ]
      );
      return res.insertId;
    }
    case 'updateBikeServiceReminder': {
      const [id, updates] = args;
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'branchId') continue;
        fields.push(`\`${key}\` = ?`);
        values.push(val);
      }
      if (fields.length === 0) return true;
      fields.push('`updatedAt` = ?');
      values.push(now);
      values.push(id);
      const [res] = await pool.query(`UPDATE BikeServiceReminders SET ${fields.join(', ')} WHERE id = ?`, values);
      return res.affectedRows > 0;
    }
    case 'deleteBikeServiceReminder': {
      const [id] = args;
      const [res] = await pool.query('DELETE FROM BikeServiceReminders WHERE id = ?', [id]);
      return res.affectedRows > 0;
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

// REST endpoints
app.post('/api/db-call', async (req, res) => {
  const { method, args } = req.body || {};
  try {
    const result = await executeDbCall(method, args);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Express DB call error:', error);
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

const PORT = process.env.PORT || 3001;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Standalone SAM-CRM Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection / initialization failed:', err);
    process.exit(1);
  });
