const fs = require('fs');
const zlib = require('zlib');
const { createReadStream, createWriteStream } = fs;
const path = require('path');

try {
  const zipPath = './ABAB.zip';
  const extractDir = './ABAB_extracted';
  
  if (!fs.existsSync(extractDir)) {
    fs.mkdirSync(extractDir, { recursive: true });
  }
  
  // Read the zip file as a buffer
  const zipBuffer = fs.readFileSync(zipPath);
  console.log('ABAB.zip file size:', zipBuffer.length, 'bytes');
  console.log('First 10 bytes:', zipBuffer.slice(0, 10));
  
  // Try to find content within the zip (brute force search for readable text)
  const hexStr = zipBuffer.toString('hex');
  console.log('\nFirst 200 hex chars:', hexStr.substring(0, 200));
  
  // Search for common XML/text markers within the file
  const utf8Str = zipBuffer.toString('utf8', 0, Math.min(5000, zipBuffer.length));
  console.log('\nSearching for text patterns...');
  
  if (utf8Str.includes('<?xml')) {
    console.log('Found XML marker');
  }
  if (utf8Str.includes('{')) {
    console.log('Found JSON marker');
  }
  if (utf8Str.includes('bible') || utf8Str.includes('BIBLE')) {
    console.log('Found bible text');
  }
  
  // Try to extract using unzip command if available (Windows)
  const { spawnSync } = require('child_process');
  const result = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${path.resolve(zipPath)}' -DestinationPath '${path.resolve(extractDir)}' -Force`], { encoding: 'utf8' });
  
  if (result.status === 0) {
    console.log('\nPowerShell extraction succeeded');
    const files = fs.readdirSync(extractDir);
    console.log('Extracted files:', files);
    
    if (files.length > 0) {
      const firstFile = path.join(extractDir, files[0]);
      const content = fs.readFileSync(firstFile, 'utf8');
      console.log(`\nFirst 2000 chars of ${files[0]}:`);
      console.log(content.substring(0, 2000));
    }
  } else {
    console.log('PowerShell failed:', result.error?.message || result.stderr);
  }
} catch(e) {
  console.error('Error:', e.message);
}
