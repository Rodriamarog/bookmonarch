// Simple Node.js script to test Flask API connection
const https = require('http');

const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5000';

console.log('Testing Flask API connection...');
console.log('Flask URL:', FLASK_URL);

// Test health endpoint
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/health',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Flask API Response:', response);
      
      if (response.status === 'healthy') {
        console.log('🎉 Flask API is working correctly!');
      } else {
        console.log('⚠️ Flask API responded but status is not healthy');
      }
    } catch (error) {
      console.log('❌ Invalid JSON response:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Connection failed:', error.message);
  console.log('Make sure Flask server is running on http://localhost:5000');
});

req.end();