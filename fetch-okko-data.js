// .github/scripts/fetch-okko-data.js
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io-client');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dataFile = path.join(dataDir, 'okko-data.json');

// Initialize with current data if available
let currentData = { progress: { total: 0 }, timestamp: new Date().toISOString() };
if (fs.existsSync(dataFile)) {
  currentData = JSON.parse(fs.readFileSync(dataFile));
}

// Connect to Socket.IO
const socket = socketIO('https://dronopad.okko.ua');

// Listen for the 'total' event with a timeout
socket.on('total', (data) => {
  console.log('Received total data:', data);
  const newData = {
    ...data,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(dataFile, JSON.stringify(newData, null, 2));
  socket.disconnect();
});

// Set a timeout to ensure the script doesn't run indefinitely
setTimeout(() => {
  console.log('Timeout reached, disconnecting');
  socket.disconnect();
  // If no new data was received, update the timestamp
  if (fs.existsSync(dataFile)) {
    const existingData = JSON.parse(fs.readFileSync(dataFile));
    existingData.timestamp = new Date().toISOString();
    fs.writeFileSync(dataFile, JSON.stringify(existingData, null, 2));
  }
  process.exit(0);
}, 30000); // 30 seconds timeout
