const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'deploy-log.txt');
const frontendDir = path.join(__dirname, 'frontend');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  try { console.log(line.trim()); } catch(e) {}
}

log('=== Deploy script started ===');

// Step 1: Build
log('Step 1: Building H5 test...');
try {
  const nodeBin = '/usr/local/bin/node';
  const uniBin = path.join(frontendDir, 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js');
  
  const stdout = execFileSync(nodeBin, [uniBin, 'build', '-p', 'h5'], {
    cwd: frontendDir,
    encoding: 'utf-8',
    timeout: 180000,
    env: {
      PATH: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin',
      HOME: '/Users/yanqian',
      NODE_ENV: 'production',
      UNI_PLATFORM: 'h5',
    }
  });
  log('Build stdout: ' + stdout.substring(0, 2000));
  log('Step 1: Build completed successfully');
} catch (err) {
  log('Step 1 FAILED: ' + err.message);
  if (err.stdout) log('stdout: ' + err.stdout.substring(0, 1000));
  if (err.stderr) log('stderr: ' + err.stderr.substring(0, 1000));
  process.exit(1);
}

// Step 2: Check build output
log('Step 2: Checking build output...');
const h5Dir = path.join(frontendDir, 'dist/build/h5');
if (fs.existsSync(h5Dir)) {
  const files = fs.readdirSync(h5Dir);
  log('Build output files: ' + files.join(', '));
} else {
  log('Step 2 FAILED: Build output directory does not exist');
  process.exit(1);
}

// Step 3: Deploy via rsync
log('Step 3: Deploying to server...');
try {
  const rsyncBin = '/usr/bin/rsync';
  const stdout = execFileSync(rsyncBin, [
    '-avz', '--delete',
    h5Dir + '/',
    'root@39.96.67.113:/var/www/fit-h5-test/'
  ], {
    encoding: 'utf-8',
    timeout: 120000,
    env: {
      PATH: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin',
      HOME: '/Users/yanqian',
    }
  });
  log('Rsync stdout: ' + stdout.substring(0, 2000));
  log('Step 3: Deploy completed successfully');
} catch (err) {
  log('Step 3 FAILED: ' + err.message);
  if (err.stdout) log('stdout: ' + err.stdout.substring(0, 1000));
  if (err.stderr) log('stderr: ' + err.stderr.substring(0, 1000));
  
  // Try scp as fallback
  log('Trying scp as fallback...');
  try {
    const scpBin = '/usr/bin/scp';
    execFileSync(scpBin, ['-r', h5Dir + '/*', 'root@39.96.67.113:/var/www/fit-h5-test/'], {
      encoding: 'utf-8',
      timeout: 120000,
      env: {
        PATH: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin',
        HOME: '/Users/yanqian',
      }
    });
    log('SCP fallback completed');
  } catch (scpErr) {
    log('SCP fallback also failed: ' + scpErr.message);
    process.exit(1);
  }
}

log('=== Deploy script finished ===');