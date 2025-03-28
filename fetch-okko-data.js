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

// Save HTML for debugging
function saveDebugHtml(html) {
  const debugFile = path.join(dataDir, 'debug-page.html');
  fs.writeFileSync(debugFile, html);
  console.log(`Debug HTML saved to ${debugFile}`);
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
    
    // Save HTML for debugging
    saveDebugHtml(html);
    
    // Looking for the counter div with class counter-content
    console.log('Looking for counter-content div...');
    
    // Method 1: Look for the exact div structure
    const counterDivRegex = /<div[^>]*class="counter-content"[^>]*>[\s\S]*?<span[^>]*>([\d\s]+)<\/span>/i;
    const counterMatch = html.match(counterDivRegex);
    
    if (counterMatch && counterMatch[1]) {
      const amountStr = counterMatch[1].replace(/\s+/g, '');
      const amount = parseInt(amountStr);
      console.log(`Found amount in counter div: ${amount}`);
      
      if (amount > 0) {
        currentData.progress = { total: amount };
        currentData.timestamp = new Date().toISOString();
        currentData.source = 'counter_div';
      }
    } else {
      console.log('Counter div not found, trying alternative method...');
      
      // Method 2: Look for text "ЗІБРАНО НА ОККО" and nearby numbers
      const okkoTextRegex = /ЗІБРАНО НА ОККО[\s\S]*?<span[^>]*>([\d\s]+)<\/span>/i;
      const okkoMatch = html.match(okkoTextRegex);
      
      if (okkoMatch && okkoMatch[1]) {
        const amountStr = okkoMatch[1].replace(/\s+/g, '');
        const amount = parseInt(amountStr);
        console.log(`Found amount near ЗІБРАНО НА ОККО text: ${amount}`);
        
        if (amount > 0) {
          currentData.progress = { total: amount };
          currentData.timestamp = new Date().toISOString();
          currentData.source = 'okko_text';
        }
      } else {
        console.log('Could not find amount near ЗІБРАНО НА ОККО text');
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
