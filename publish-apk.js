const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

require('dotenv').config();

const GH_TOKEN = process.env.GH_TOKEN;
const REPO_OWNER = 'kiruba1304';
const REPO_NAME = 'velu-bill';

if (!GH_TOKEN) {
  console.error('Error: GH_TOKEN is not defined in your .env file.');
  process.exit(1);
}

// 1. Read current version from package.json
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('Error: package.json not found in root directory.');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const tagName = `android-v${version}`;
const releaseName = `Android Release v${version}`;

console.log(`Preparing to compile and publish APK for version: ${version}`);
console.log(`Tag Name: ${tagName}`);

// 2. Build the Android Release APK
try {
  console.log('Compiling signed release APK via Gradle...');
  const assembleCmd = process.platform === 'win32' 
    ? 'cd android && gradlew.bat assembleRelease' 
    : 'cd android && ./gradlew assembleRelease';
  
  execSync(assembleCmd, { stdio: 'inherit' });
  console.log('Gradle compilation completed successfully.');
} catch (error) {
  console.error('Error: Gradle compilation failed.');
  process.exit(1);
}

// 3. Locate compiled APK file
const apkPath = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(apkPath)) {
  console.error(`Error: APK file not found at expected path: ${apkPath}`);
  process.exit(1);
}

console.log(`Found compiled APK at: ${apkPath}`);

// Helper function to make HTTP requests using Node's native https module
function makeRequest(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Node-Build-Script',
        'Authorization': `token ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`Request to ${url} failed (Status ${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function run() {
  try {
    // 4. Create GitHub Release
    console.log(`Creating GitHub Release for tag: ${tagName}...`);
    const createReleaseUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
    const releaseBody = {
      tag_name: tagName,
      target_commitish: 'main',
      name: releaseName,
      body: `Automated Android APK release for version ${version}.`,
      draft: false,
      prerelease: false
    };

    const releaseResponse = await makeRequest(createReleaseUrl, { method: 'POST' }, releaseBody);
    const releaseId = releaseResponse.id;
    console.log(`GitHub Release created successfully! ID: ${releaseId}`);

    // 5. Upload APK Asset
    console.log('Uploading app-release.apk asset to release...');
    const fileStats = fs.statSync(apkPath);
    const fileBuffer = fs.readFileSync(apkPath);
    
    // GitHub asset upload endpoint is on uploads.github.com
    const uploadUrl = `https://uploads.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets?name=app-release.apk`;

    const uploadHeaders = {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': fileStats.size
    };

    const uploadResponse = await makeRequest(uploadUrl, { 
      method: 'POST', 
      headers: uploadHeaders 
    }, fileBuffer);

    console.log('APK Asset uploaded successfully!');
    console.log(`Asset Name: ${uploadResponse.name}`);
    console.log(`Download URL: ${uploadResponse.browser_download_url}`);
    console.log('\nSUCCESS: Android APK build and publish complete!');
  } catch (error) {
    console.error('Publishing failed:', error.message);
    process.exit(1);
  }
}

run();
