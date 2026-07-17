-- SQL script to reset database: truncates all tables and resets auto-increment IDs
-- WARNING: This will delete ALL data (Products, Customers, Bills, Branches, Users, etc.)!

SET FOREIGN_KEY_CHECKS = 0;

-- Core pos tables
TRUNCATE TABLE Categories;
TRUNCATE TABLE Products;
TRUNCATE TABLE Customers;
TRUNCATE TABLE Bills;
TRUNCATE TABLE BillItems;
TRUNCATE TABLE InventoryTransactions;

-- Parties & Movements
TRUNCATE TABLE Parties;
TRUNCATE TABLE PartyMovements;
TRUNCATE TABLE PartyPayments;

-- Users & Permissions
TRUNCATE TABLE Users;
TRUNCATE TABLE RolePermissions;
TRUNCATE TABLE UserPermissions;

-- Attendance & Leave management
TRUNCATE TABLE Attendance;
TRUNCATE TABLE AttendanceRules;
TRUNCATE TABLE Holidays;
TRUNCATE TABLE LeavePermissionRequests;

-- Service cards, Branches & Vehicles
TRUNCATE TABLE Branches;
TRUNCATE TABLE Services;
TRUNCATE TABLE Bikes;
TRUNCATE TABLE BikeServiceReminders;

-- Accounts & Expenses
TRUNCATE TABLE MonthlyAccounts;
TRUNCATE TABLE Expenses;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Database reset queries successfully completed!' AS Message;
