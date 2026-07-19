const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'samdb'
  });

  const [products] = await connection.query('SELECT id, name, branchId, barcode FROM Products');
  console.log('--- PRODUCTS IN DATABASE ---');
  console.log(products);

  const [users] = await connection.query('SELECT id, username, role, branchId FROM Users');
  console.log('--- USERS IN DATABASE ---');
  console.log(users);

  await connection.end();
}

check().catch(console.error);
