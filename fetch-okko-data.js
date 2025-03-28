const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io-client');

// Use absolute paths based on the repository root
const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, 'data');

// Create data directory if it doesn't exist
console.log(`Creating data directory at: ${dataDir}`);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
  console.log('Data directory created successfully');
}

const dataFile = path.join(dataDir, 'okko-data.json');
console.log(`Data file will be saved at: ${dataFile}`);

// Initialize with empty data
let currentData = { progress: { total: 0 }, timestamp: new Date().toISOString() };
fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2));
console.log('Data file initialized');

// Connect to Socket.IO
console.log('Connecting to Socket.IO...');
const socket = socketIO('https://dronopad.okko.ua', {
  transports: ['websocket', 'polling'],
  timeout: 10000
});

let dataReceived = false;

socket.on('connect', () => {
  console.log('Connected to Socket.IO server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

// Listen for the 'total' event
socket.on('total', (data) => {
  console.log('Received total data:', JSON.stringify(data));
  dataReceived = true;
  const newData = {
    ...data,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(dataFile, JSON.stringify(newData, null, 2));
  console.log('Updated data file');
  socket.disconnect();
});

// Set a timeout to ensure the script doesn't run indefinitely
setTimeout(() => {
  console.log('Timeout reached, disconnecting');
  socket.disconnect();
  
  // If no new data was received, just update the timestamp
  if (!dataReceived) {
    console.log('No data received, updating timestamp only');
    if (fs.existsSync(dataFile)) {
      const existingData = JSON.parse(fs.readFileSync(dataFile));
      existingData.timestamp = new Date().toISOString();
      fs.writeFileSync(dataFile, JSON.stringify(existingData, null, 2));
    }
  }
  
  // Verify file exists before exiting
  if (fs.existsSync(dataFile)) {
    console.log(`Data file exists at: ${dataFile}`);
    console.log(`File contents: ${fs.readFileSync(dataFile, 'utf8')}`);
  } else {
    console.error(`ERROR: Data file does not exist at: ${dataFile}`);
  }
  
  console.log('Script completed successfully');
}, 30000); // 30 seconds timeout
