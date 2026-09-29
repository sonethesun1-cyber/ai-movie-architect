#!/usr/bin/env node
/**
 * One-click launcher for AI Movie Architect.
 *
 * This is what the double-click files (start-mac.command / start-windows.bat /
 * start-linux.sh) run. It exists so a non-technical user never has to type an
 * npm command: it installs dependencies on first run, makes sure a .env file
 * exists (the API key itself is now set inside the app, not by hand-editing
 * this file), starts the server, and opens the app in the default browser.
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function ensureDependenciesInstalled() {
  const nodeModulesPath = path.join(ROOT, 'node_modules');
  const markerPath = path.join(nodeModulesPath, '.install-complete');
  if (fs.existsSync(markerPath)) return;

  console.log('First run: installing dependencies (this happens once)...');
  execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  fs.writeFileSync(markerPath, new Date().toISOString());
}

function ensureEnvFileExists() {
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('Created .env — you can paste your Anthropic API key right in the app once it opens.');
  }
}

function openInBrowser(url) {
  const platform = process.platform;
  const command =
    platform === 'darwin' ? `open "${url}"` :
    platform === 'win32' ? `start "" "${url}"` :
    `xdg-open "${url}"`;
  exec(command, (err) => {
    if (err) {
      console.log(`Could not open a browser automatically. Please open ${url} yourself.`);
    }
  });
}

try {
  ensureDependenciesInstalled();
} catch (err) {
  console.error('\nFailed to install dependencies automatically.');
  console.error('Make sure Node.js and npm are installed, then run "npm install" manually in this folder.');
  console.error(err.message);
  process.exit(1);
}

ensureEnvFileExists();

// Starting server.js also calls app.listen() and logs its own status lines.
require('./server.js');

const PORT = process.env.PORT || 3000;
setTimeout(() => {
  console.log('\nOpening AI Movie Architect in your browser...');
  openInBrowser(`http://localhost:${PORT}`);
}, 700);
