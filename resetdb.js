// Node.js script to reset MySQL database tables using mysql2 dependency
const mysql = require('mysql2/promise');

const config = {
  host: 'mysql-env-wxixfkg1yk.ap-south-1a.lb.nimbuz.tech',
  port: 31885,
  user: 'root',
  password: 'visH325',
  database: 'samdb',
  connectTimeout: 10000
};

const tables = [
  'Categories',
  'Products',
  'Customers',
  'Bills',
  'BillItems',
  'InventoryTransactions',
  'Parties',
  'PartyMovements',
  'PartyPayments',
  'Users',
  'RolePermissions',
  'UserPermissions',
  'Attendance',
  'AttendanceRules',
  'Holidays',
  'LeavePermissionRequests',
  'Branches',
  'Services',
  'Bikes',
  'BikeServiceReminders',
  'MonthlyAccounts',
  'Expenses'
];

async function resetDatabase() {
  let connection;
  try {
    console.log('Connecting to database server...');
    connection = await mysql.createConnection(config);
  } catch (error) {
    console.log('Primary connection failed. Trying fallback database password...');
    try {
      config.password = 'visH$325';
      connection = await mysql.createConnection(config);
    } catch (fallbackError) {
      console.error('All connection attempts failed:', fallbackError.message);
      process.exit(1);
    }
  }

  console.log('Connected successfully. Commencing database tables truncate...');

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      try {
        await connection.query(`TRUNCATE TABLE \`${table}\``);
        console.log(`- Truncated table: ${table}`);
      } catch (err) {
        console.warn(`- Could not truncate table: ${table} (it might not exist yet). Error: ${err.message}`);
      }
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nSUCCESS: Database tables truncated and auto-increment IDs reset successfully!');
  } catch (err) {
    console.error('An error occurred during truncate operations:', err.message);
  } finally {
    await connection.end();
  }
}

// Ask for a simple confirmation prompt before running
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('WARNING: This will delete ALL database records and reset IDs. Are you sure you want to proceed? (yes/no): ', (answer) => {
  readline.close();
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    resetDatabase();
  } else {
    console.log('Operation cancelled.');
  }
});
