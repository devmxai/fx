import { createWriteStream, existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

const version = '1.14.0';
const scriptRoot = fileURLToPath(new URL('..', import.meta.url));
const installRoot = path.join(scriptRoot, '.local-tools', 'rhubarb');
const downloadsRoot = path.join(scriptRoot, '.local-tools', 'downloads');

const platformAssets = {
  darwin: {
    archive: `Rhubarb-Lip-Sync-${version}-macOS.zip`,
    binary: `Rhubarb-Lip-Sync-${version}-macOS/rhubarb`,
  },
  linux: {
    archive: `Rhubarb-Lip-Sync-${version}-Linux.zip`,
    binary: `Rhubarb-Lip-Sync-${version}-Linux/rhubarb`,
  },
  win32: {
    archive: `Rhubarb-Lip-Sync-${version}-Windows.zip`,
    binary: `Rhubarb-Lip-Sync-${version}-Windows/rhubarb.exe`,
  },
};

const platformInfo = platformAssets[process.platform];
if (!platformInfo) {
  console.error(`Unsupported platform for the bundled Rhubarb installer: ${process.platform}`);
  process.exit(1);
}

const binaryPath = path.join(installRoot, platformInfo.binary);
if (existsSync(binaryPath)) {
  console.log(`Rhubarb is already installed at ${binaryPath}`);
  process.exit(0);
}

await fs.mkdir(installRoot, { recursive: true });
await fs.mkdir(downloadsRoot, { recursive: true });

const archivePath = path.join(downloadsRoot, platformInfo.archive);
const archiveUrl = `https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v${version}/${platformInfo.archive}`;

console.log(`Downloading official Rhubarb ${version} from ${archiveUrl}`);
const response = await fetch(archiveUrl);
if (!response.ok || !response.body) {
  throw new Error(`Failed to download Rhubarb release: ${response.status} ${response.statusText}`);
}

await pipeline(Readable.fromWeb(response.body), createWriteStream(archivePath));

await new Promise((resolve, reject) => {
  const command = process.platform === 'win32' ? 'powershell' : 'unzip';
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-Command', `Expand-Archive -Force "${archivePath}" "${installRoot}"`]
    : ['-o', archivePath, '-d', installRoot];

  const child = spawn(command, args, {
    stdio: 'inherit',
  });

  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve(null);
      return;
    }
    reject(new Error(`Failed to unpack Rhubarb archive with exit code ${code}.`));
  });
});

if (process.platform !== 'win32') {
  await fs.chmod(binaryPath, 0o755);
}

console.log(`Rhubarb installed successfully at ${binaryPath}`);
