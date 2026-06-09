#!/usr/bin/env node
/**
 * Tiny dependency-free dev orchestrator: runs the web app and the channel
 * simulator side by side with prefixed, colourised output. Replaces a heavier
 * dev dependency and keeps `npm audit` clean.
 *
 * Ctrl-C tears both down; if either exits, the other is stopped too.
 */
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const targets = [
  { name: 'web', color: '\x1b[36m', args: ['run', 'dev', '-w', '@cadence/web'] },
  { name: 'channel', color: '\x1b[35m', args: ['run', 'dev', '-w', '@cadence/channel-sim'] },
];

const RESET = '\x1b[0m';
const children = [];
let shuttingDown = false;

function prefixStream(stream, name, color) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      process.stdout.write(`${color}[${name}]${RESET} ${line}\n`);
    }
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

for (const { name, color, args } of targets) {
  const child = spawn(npm, args, { shell: process.platform === 'win32' });
  children.push(child);
  prefixStream(child.stdout, name, color);
  prefixStream(child.stderr, name, color);
  child.on('exit', (code) => {
    process.stdout.write(`${color}[${name}]${RESET} exited with code ${code}\n`);
    shutdown(code ?? 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
