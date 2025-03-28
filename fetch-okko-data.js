const fs = require('fs');
const path = require('path');
const https = require('https');

// Create data directory and file paths
const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
const dataFile = path.join(dataDir, 'okko-data.json');

// Full browser-like headers
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Referer': 'https://savelife.in.ua/',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: browserHeaders
    }, (res) => {
      const { statusCode, headers } = res;
      console.log(`Status Code: ${statusCode}`);
      console.log('Headers:', headers);
      
      // Handle redirects
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        console.log(`Redirecting to: ${headers.location}`);
        return fetchPage(headers.location).then(resolve).catch(reject);
      }
      
      // Check if successful
      if (statusCode !== 200) {
        return reject(new Error(`Status code: ${statusCode}`));
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Initialize with empty or existing data
  let currentData = { progress: { total: 0 }, timestamp: new Date().toISOString() };
  if (fs.existsSync(dataFile)) {
    try {
      currentData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch (e) {}
  }
  
  try {
    console.log('Fetching the Dronopad page...');
    const html = await fetchPage('https://savelife.in.ua/dronopad/');
    console.log(`Received HTML (${html.length} characters)`);
    
    // Try different ways to extract the Okko total amount
    
    // Method 1: Look for data-okko-total-amount attribute
    let dataMatch = html.match(/data-okko-total-amount[^>]*>([0-9 ]+)</);
    if (dataMatch && dataMatch[1]) {
      const totalAmount = parseInt(dataMatch[1].replace(/\s+/g, ''));
      console.log('Method 1 - Found total amount:', totalAmount);
      
      if (totalAmount > 0) {
        currentData.progress = { total: totalAmount };
        currentData.timestamp = new Date().toISOString();
        currentData.source = 'html_scrape_method1';
      }
    }
    
    // Method 2: Look for JavaScript initialization with the value
    if (currentData.progress.total === 0) {
      dataMatch = html.match(/socket\.on\('total'[\s\S]*?total\s*=\s*([0-9]+)/);
      if (dataMatch && dataMatch[1]) {
        const totalAmount = parseInt(dataMatch[1]);
        console.log('Method 2 - Found total amount:', totalAmount);
        
        if (totalAmount > 0) {
          currentData.progress = { total: totalAmount };
          currentData.timestamp = new Date().toISOString();
          currentData.source = 'html_scrape_method2';
        }
      }
    }
    
    // Method 3: Look for a JSON structure with the data
    if (currentData.progress.total === 0) {
      dataMatch = html.match(/progress["'\s]*:[\s]*{[^}]*total["'\s]*:[\s]*([0-9]+)/);
      if (dataMatch && dataMatch[1]) {
        const totalAmount = parseInt(dataMatch[1]);
        console.log('Method 3 - Found total amount:', totalAmount);
        
        if (totalAmount > 0) {
          currentData.progress = { total: totalAmount };
          currentData.timestamp = new Date().toISOString();
          currentData.source = 'html_scrape_method3';
        }
      }
    }
    
    console.log('Final data to save:', currentData);
    
  } catch (error) {
    console.error('Error fetching or processing the page:', error);
  }
  
  // Save data file, even if we couldn't update it (to preserve timestamp)
  fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2));
  console.log('Data file saved');
}

main().catch(console.error);
