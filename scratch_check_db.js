const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection({
    host: 'mysql-env-wxixfkg1yk.ap-south-1a.lb.nimbuz.tech',
    port: 31885,
    user: 'root',
    password: 'visH325',
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
