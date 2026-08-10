const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing connection to 152.42.227.103:3306...');
  try {
    const connection = await mysql.createConnection({
      host: '152.42.227.103',
      user: 'root',
      password: 'megroup@72147321',
      port: 3306,
      connectTimeout: 5000
    });
    console.log('✅ Connection to MySQL successful!');
    
    // Test creating db
    console.log('Attempting to create database smashpang_db...');
    await connection.query('CREATE DATABASE IF NOT EXISTS smashpang_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✅ Database smashpang_db is ready.');
    
    await connection.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

testConnection();
