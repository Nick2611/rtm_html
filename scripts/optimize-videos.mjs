#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'background_hero',
  'proyectos_videos',
  'seccion_servicios',
];

const CRF = process.env.VIDEO_CRF || '32';
const PRESET = process.env.VIDEO_PRESET || 'medium';
const MAX_SIZE = Number(process.env.VIDEO_MAX_SIZE || 1280);

function hasFfmpeg() {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() ? [fullPath] : [];
  });
}

function optimize(filePath) {
  const stat = fs.statSync(filePath);
  const tmpPath = `${filePath}.tmp.mp4`;
  const filter = `scale='min(${MAX_SIZE},iw)':'min(${MAX_SIZE},ih)':force_original_aspect_ratio=decrease`;

  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  const result = spawnSync('ffmpeg', [
    '-y',
    '-i', filePath,
    '-an',
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', PRESET,
    '-crf', CRF,
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    tmpPath,
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    return {
      filePath,
      status: 'failed',
      error: (result.stderr || result.stdout || '').trim(),
    };
  }

  const nextStat = fs.statSync(tmpPath);
  if (nextStat.size >= stat.size) {
    fs.unlinkSync(tmpPath);
    return {
      filePath,
      status: 'skipped',
      before: stat.size,
      after: nextStat.size,
    };
  }

  fs.renameSync(tmpPath, filePath);
  return {
    filePath,
    status: 'optimized',
    before: stat.size,
    after: nextStat.size,
    saved: stat.size - nextStat.size,
  };
}

if (!hasFfmpeg()) {
  console.error('ffmpeg no esta disponible en PATH.');
  process.exit(1);
}

const videos = ROOTS.flatMap(walk)
  .filter(filePath => path.extname(filePath).toLowerCase() === '.mp4');

const results = videos.map(optimize);
const failed = results.filter(result => result.status === 'failed');
const optimized = results.filter(result => result.status === 'optimized');
const skipped = results.filter(result => result.status === 'skipped');
const before = results.reduce((sum, result) => sum + (result.before || 0), 0);
const after = results.reduce((sum, result) => sum + (result.status === 'optimized' ? result.after : result.before || 0), 0);

console.log(JSON.stringify({
  roots: ROOTS,
  crf: CRF,
  preset: PRESET,
  maxSize: MAX_SIZE,
  videos: videos.length,
  optimized: optimized.length,
  skipped: skipped.length,
  failed: failed.length,
  before,
  after,
  saved: before - after,
  results,
}, null, 2));

if (failed.length > 0) process.exit(1);
