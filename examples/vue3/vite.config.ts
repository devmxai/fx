import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { existsSync, promises as fs } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import Busboy from 'busboy';

type RhubarbRecognizer = 'phonetic' | 'pocketSphinx';

const exampleRoot = fileURLToPath(new URL('.', import.meta.url));
const rhubarbVersion = '1.14.0';
const localRhubarbDir = path.resolve(exampleRoot, '.local-tools', 'rhubarb');

function isPrivateIPv4(address: string) {
  return /^10\./.test(address)
    || /^192\.168\./.test(address)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

function resolveCanonicalHost() {
  if (process.env.WEBCUT_CANONICAL_HOST) {
    return process.env.WEBCUT_CANONICAL_HOST;
  }

  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const networkEntries of Object.values(interfaces)) {
    for (const entry of networkEntries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4') {
        continue;
      }
      candidates.push(entry.address);
    }
  }

  return candidates.find(isPrivateIPv4) || candidates[0] || null;
}

const canonicalHost = resolveCanonicalHost();

function getLocalRhubarbBinaryPath() {
  const platformAssetMap = {
    darwin: `Rhubarb-Lip-Sync-${rhubarbVersion}-macOS`,
    linux: `Rhubarb-Lip-Sync-${rhubarbVersion}-Linux`,
    win32: `Rhubarb-Lip-Sync-${rhubarbVersion}-Windows`,
  } as const;
  const assetName = platformAssetMap[process.platform as keyof typeof platformAssetMap];
  if (!assetName) {
    return null;
  }
  const binaryName = process.platform === 'win32' ? 'rhubarb.exe' : 'rhubarb';
  return path.join(localRhubarbDir, assetName, binaryName);
}

function resolveRhubarbBinary() {
  const envBinary = process.env.RHUBARB_BIN;
  if (envBinary) {
    return envBinary;
  }

  const localBinary = getLocalRhubarbBinaryPath();
  if (localBinary && existsSync(localBinary)) {
    return localBinary;
  }

  const locator = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(locator, ['rhubarb'], { encoding: 'utf8' });
  if (result.status === 0) {
    const commandPath = result.stdout.split(/\r?\n/).map(item => item.trim()).find(Boolean);
    if (commandPath) {
      return commandPath;
    }
  }

  return null;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendBinary(res: ServerResponse, statusCode: number, contentType: string, payload: Buffer) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(payload.byteLength));
  res.end(payload);
}

async function parseMultipartForm(req: IncomingMessage) {
  return await new Promise<{
    fields: Record<string, string>;
    files: Record<string, { filename: string; mimeType: string; buffer: Buffer }>;
  }>((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: Record<string, { filename: string; mimeType: string; buffer: Buffer }> = {};
    const busboy = Busboy({
      headers: req.headers,
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      const chunks: Buffer[] = [];
      file.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      file.on('end', () => {
        files[name] = {
          filename: info.filename,
          mimeType: info.mimeType,
          buffer: Buffer.concat(chunks),
        };
      });
      file.on('error', reject);
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      resolve({ fields, files });
    });

    req.pipe(busboy);
  });
}

async function writeUploadedFile(file: { buffer: Buffer }, outputPath: string) {
  await fs.writeFile(outputPath, file.buffer);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, `'\\''`);
}

function runProcess(command: string, args: string[], options: { cwd?: string } = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function normalizeAudioInput(inputPath: string, workDir: string) {
  const ext = path.extname(inputPath).toLowerCase();
  if (['.wav', '.ogg'].includes(ext)) {
    return inputPath;
  }

  const outputPath = path.join(workDir, 'audio-input.wav');
  const result = await runProcess('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    outputPath,
  ]);

  if (result.code !== 0) {
    throw new Error('Unable to normalize the uploaded audio for Rhubarb analysis.');
  }

  return outputPath;
}

function parseMachineReadableEvents(stderr: string) {
  return stderr
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      }
      catch (_error) {
        return null;
      }
    })
    .filter(Boolean) as Array<Record<string, any>>;
}

type ParsedRhubarbAnalysis = {
  metadata?: {
    duration?: number;
    [key: string]: unknown;
  };
  mouthCues: Array<{
    start: number;
    end: number;
    value: string;
  }>;
};

async function runRhubarbAnalysis(options: {
  audioPath: string;
  dialogText?: string;
  recognizer: RhubarbRecognizer;
  extendedShapes: string;
  workDir: string;
}) {
  const rhubarbBinary = resolveRhubarbBinary();
  if (!rhubarbBinary) {
    throw new Error('Rhubarb CLI was not found. Install the official v1.14.0 release first by running `npm run install:rhubarb` inside examples/vue3, or set RHUBARB_BIN.');
  }

  const args = [
    '-f', 'json',
    '--machineReadable',
    '--extendedShapes', options.extendedShapes,
    '-r', options.recognizer,
  ];

  if (options.dialogText) {
    const dialogPath = path.join(options.workDir, 'dialog.txt');
    await fs.writeFile(dialogPath, options.dialogText, 'utf8');
    args.push('-d', dialogPath);
  }

  args.push(options.audioPath);

  const result = await runProcess(rhubarbBinary, args, { cwd: options.workDir });
  const events = parseMachineReadableEvents(result.stderr);
  const failureEvent = events.find(event => event.type === 'failure');

  if (result.code !== 0 || failureEvent) {
    const reason = failureEvent?.reason || result.stderr || 'Rhubarb analysis failed.';
    throw new Error(reason);
  }

  try {
    return JSON.parse(result.stdout) as ParsedRhubarbAnalysis;
  }
  catch (_error) {
    throw new Error('Rhubarb returned an invalid JSON payload.');
  }
}

async function renderLipSyncOverlayGif(options: {
  mouthCues: ParsedRhubarbAnalysis['mouthCues'];
  shapePaths: Record<string, string>;
  workDir: string;
}) {
  if (!options.mouthCues.length) {
    throw new Error('No mouth cues were provided for overlay rendering.');
  }

  const concatLines: string[] = [];
  let lastFramePath = '';

  for (const cue of options.mouthCues) {
    const framePath = options.shapePaths[cue.value] || options.shapePaths.X || options.shapePaths.A;
    if (!framePath) {
      continue;
    }

    const frameDuration = Math.max(0.02, cue.end - cue.start);
    concatLines.push(`file '${escapeConcatPath(framePath)}'`);
    concatLines.push(`duration ${frameDuration.toFixed(6)}`);
    lastFramePath = framePath;
  }

  if (!lastFramePath) {
    throw new Error('Unable to match Rhubarb mouth cues to the uploaded PNG shapes.');
  }

  concatLines.push(`file '${escapeConcatPath(lastFramePath)}'`);

  const concatPath = path.join(options.workDir, 'overlay-frames.txt');
  const overlayPath = path.join(options.workDir, 'lipsync-overlay.gif');
  await fs.writeFile(concatPath, `${concatLines.join('\n')}\n`, 'utf8');

  const filterGraph = [
    'split[s0][s1]',
    '[s0]palettegen=reserve_transparent=1[p]',
    '[s1][p]paletteuse=alpha_threshold=1',
  ].join(';');

  const result = await runProcess('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatPath,
    '-vf', filterGraph,
    overlayPath,
  ], { cwd: options.workDir });

  if (result.code !== 0) {
    throw new Error(`Unable to render the transparent lip sync overlay. ${result.stderr || ''}`.trim());
  }

  return await fs.readFile(overlayPath);
}

async function handleRhubarbAnalyze(req: IncomingMessage, res: ServerResponse) {
  const workDir = path.join(os.tmpdir(), `webcut-rhubarb-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const { fields, files } = await parseMultipartForm(req);
    const audioFile = files.audio;
    const dialogText = String(fields.dialogText || '').trim();
    const recognizer = String(fields.recognizer || 'phonetic') as RhubarbRecognizer;
    const extendedShapes = String(fields.extendedShapes || '');

    if (!audioFile) {
      sendJson(res, 400, { error: 'Audio upload is required.' });
      return;
    }

    const sanitizedAudioName = audioFile.filename || 'audio-upload';
    const audioPath = path.join(workDir, sanitizedAudioName);
    await writeUploadedFile(audioFile, audioPath);
    const normalizedAudioPath = await normalizeAudioInput(audioPath, workDir);
    const analysis = await runRhubarbAnalysis({
      audioPath: normalizedAudioPath,
      dialogText,
      recognizer,
      extendedShapes,
      workDir,
    });

    sendJson(res, 200, {
      recognizer,
      extendedShapes,
      metadata: analysis.metadata,
      mouthCues: analysis.mouthCues,
    });
  }
  catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unexpected Rhubarb integration error.',
    });
  }
  finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function handleRhubarbRenderOverlay(req: IncomingMessage, res: ServerResponse) {
  const workDir = path.join(os.tmpdir(), `webcut-rhubarb-overlay-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const { fields, files } = await parseMultipartForm(req);
    const mouthCues = JSON.parse(String(fields.mouthCues || '[]')) as ParsedRhubarbAnalysis['mouthCues'];

    if (!Array.isArray(mouthCues) || mouthCues.length === 0) {
      sendJson(res, 400, { error: 'Mouth cues are required to render the overlay clip.' });
      return;
    }

    const shapePaths: Record<string, string> = {};
    for (const [fieldName, file] of Object.entries(files)) {
      if (!fieldName.startsWith('shape_')) {
        continue;
      }
      const shapeKey = fieldName.replace('shape_', '');
      const outputPath = path.join(workDir, `${shapeKey}-${sanitizeFileName(file.filename || `${shapeKey}.png`)}`);
      await writeUploadedFile(file, outputPath);
      shapePaths[shapeKey] = outputPath;
    }

    const overlayBuffer = await renderLipSyncOverlayGif({
      mouthCues,
      shapePaths,
      workDir,
    });

    sendBinary(res, 200, 'image/gif', overlayBuffer);
  }
  catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unexpected lip sync overlay rendering error.',
    });
  }
  finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export default defineConfig({
  server: {
    host: canonicalHost || '0.0.0.0',
    port: 4273,
    strictPort: true,
    allowedHosts: true,
  },
  plugins: [
    vue(),
    {
      name: 'webcut-rhubarb-lip-sync',
      configureServer(server) {
        server.middlewares.use('/api/rhubarb-lip-sync/analyze', async (req, res, next) => {
          if (req.method !== 'POST') {
            next();
            return;
          }

          await handleRhubarbAnalyze(req, res);
        });
        server.middlewares.use('/api/rhubarb-lip-sync/render-overlay', async (req, res, next) => {
          if (req.method !== 'POST') {
            next();
            return;
          }

          await handleRhubarbRenderOverlay(req, res);
        });
      },
    },
  ],
});
