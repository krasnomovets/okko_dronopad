const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

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
  // Remove Accept-Encoding to prevent compression
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
      console.log('Content-Type:', headers['content-type']);
      console.log('Content-Encoding:', headers['content-encoding']);
      
      // Handle redirects
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        console.log(`Redirecting to: ${headers.location}`);
        return fetchPage(headers.location).then(resolve).catch(reject);
      }
      
      // Check if successful
      if (statusCode !== 200) {
        return reject(new Error(`Status code: ${statusCode}`));
      }
      
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        
        // Handle different content encodings
        try {
          let content;
          if (headers['content-encoding'] === 'br') {
            console.log('Content is Brotli compressed, but Node.js might not support decompression');
            // Just store the raw buffer for now
            content = buffer.toString();
          } else if (headers['content-encoding'] === 'gzip') {
            console.log('Content is gzip compressed, decompressing');
            content = zlib.gunzipSync(buffer).toString();
          } else if (headers['content-encoding'] === 'deflate') {
            console.log('Content is deflate compressed, decompressing');
            content = zlib.inflateSync(buffer).toString();
          } else {
            console.log('Content is not compressed');
            content = buffer.toString();
          }
          resolve(content);
        } catch (error) {
          console.error('Error processing response:', error);
          // Return the raw buffer as a fallback
          resolve(buffer.toString());
        }
      });
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

// Alternative approach: fetch directly from Okko
function fetchOkkoData() {
  return new Promise((resolve, reject) => {
    const okkoUrl = 'https://dronopad.okko.ua/';
    const req = https.get(okkoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json',
        'Origin': 'https://savelife.in.ua',
        'Referer': 'https://savelife.in.ua/'
      }
    }, (res) => {
      console.log(`Okko API Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          console.log('Failed to parse JSON, trying to extract from HTML');
          resolve(data);
        }
      });
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
    // Try the direct Okko approach first
    console.log('Fetching data directly from Okko...');
    const okkoData = await fetchOkkoData();
    console.log('Okko response:', typeof okkoData === 'string' ? 'HTML/Text' : 'JSON');
    
    if (typeof okkoData === 'object' && okkoData.progress && okkoData.progress.total) {
      console.log(`Found total in Okko API: ${okkoData.progress.total}`);
      currentData.progress = okkoData.progress;
      currentData.timestamp = new Date().toISOString();
      currentData.source = 'okko_api';
    } else {
      // Fallback to fetching the page
      console.log('Fetching the Dronopad page...');
      
      // Change the URL to use Google's cache as a workaround for Brotli compression
      const html = await fetchPage('https://webcache.googleusercontent.com/search?q=cache:https://savelife.in.ua/dronopad/');
      console.log(`Received HTML (${html.length} characters)`);
      
      // Save HTML for debugging
      saveDebugHtml(html);
      
      // Extract the amount using regular expressions
      console.log('Looking for amount in HTML...');
      
      // Try several patterns that might match the amount
      const patterns = [
        /<div[^>]*class="counter-content"[^>]*>[\s\S]*?<span[^>]*>([\d\s]+)<\/span>/i,
        /ЗІБРАНО НА ОККО[\s\S]*?<span[^>]*>([\d\s]+)<\/span>/i,
        /₴\s*<span[^>]*>([\d\s]+)<\/span>/i,
        /<span[^>]*>([\d\s]{7,})<\/span>/g  // Look for any span with a number-like content
      ];
      
      for (const pattern of patterns) {
        let match;
        if (pattern.global) {
          // For global patterns, test each match
          while ((match = pattern.exec(html)) !== null) {
            const amountStr = match[1].replace(/\s+/g, '');
            if (/^\d+$/.test(amountStr)) {
              const amount = parseInt(amountStr);
              console.log(`Found potential amount: ${amount}`);
              
              if (amount > 1000000) {  // Must be over a million to be valid
                currentData.progress = { total: amount };
                currentData.timestamp = new Date().toISOString();
                currentData.source = 'html_pattern';
                break;
              }
            }
          }
        } else {
          // For non-global patterns
          match = html.match(pattern);
          if (match && match[1]) {
            const amountStr = match[1].replace(/\s+/g, '');
            if (/^\d+$/.test(amountStr)) {
              const amount = parseInt(amountStr);
              console.log(`Found amount: ${amount}`);
              
              if (amount > 1000000) {  // Must be over a million to be valid
                currentData.progress = { total: amount };
                currentData.timestamp = new Date().toISOString();
                currentData.source = 'html_pattern';
                break;
              }
            }
          }
        }
      }
    }
    
    console.log('Final data to save:', currentData);
    
  } catch (error) {
    console.error('Error fetching or processing data:', error);
  }
  
  // Save data file, even if we couldn't update it (to preserve timestamp)
  fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2));
  console.log('Data file saved');
}

main().catch(console.error);
