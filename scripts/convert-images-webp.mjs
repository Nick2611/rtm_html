#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'imagenes_productos',
  'imagenes_productos_restantes',
  'proyectos_imagenes',
];

const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const QUALITY = process.env.WEBP_QUALITY || '78';
const MAX_SIZE = process.env.WEBP_MAX_SIZE || '1800x1800>';

function hasMagick() {
  const result = spawnSync('magick', ['-version'], { stdio: 'ignore' });
  return result.status === 0;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() ? [fullPath] : [];
  });
}

function toWebpPath(filePath) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.webp`);
}

function convert(filePath) {
  const outputPath = toWebpPath(filePath);
  const sourceStat = fs.statSync(filePath);

  if (fs.existsSync(outputPath) && fs.statSync(outputPath).mtimeMs >= sourceStat.mtimeMs) {
    return { filePath, outputPath, status: 'skipped' };
  }

  const result = spawnSync('magick', [
    filePath,
    '-auto-orient',
    '-strip',
    '-resize',
    MAX_SIZE,
    '-quality',
    QUALITY,
    outputPath,
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    return {
      filePath,
      outputPath,
      status: 'failed',
      error: (result.stderr || result.stdout || '').trim(),
    };
  }

  return { filePath, outputPath, status: 'converted' };
}

if (!hasMagick()) {
  console.error('ImageMagick `magick` no esta disponible en PATH.');
  process.exit(1);
}

const sources = ROOTS.flatMap(walk)
  .filter(filePath => SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase()));

const results = sources.map(convert);
const failed = results.filter(result => result.status === 'failed');
const converted = results.filter(result => result.status === 'converted').length;
const skipped = results.filter(result => result.status === 'skipped').length;

console.log(JSON.stringify({
  roots: ROOTS,
  quality: QUALITY,
  maxSize: MAX_SIZE,
  sources: sources.length,
  converted,
  skipped,
  failed,
}, null, 2));

if (failed.length > 0) process.exit(1);
