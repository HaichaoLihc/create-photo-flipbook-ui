#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { PinterestEngine, findChrome, loadPuppeteer, imageUrl } from './engine.mjs';
import { searchToFiles, readManifest, atomicWrite } from './storage.mjs';

const HELP = `Pinterest references — standalone photo flipbook helper

  node cli.mjs doctor
  node cli.mjs search --query "coastal photobook spreads" --limit 12 --output ./references
  node cli.mjs download --manifest /path/to/manifest.json --indices 2,5 --output ./selected
  node cli.mjs info --url https://i.pinimg.com/...

Search options: --json-only, --headed
Each search fetches current results and writes a numbered JPEG contact sheet and manifest under OUTPUT/SEARCH_ID/.
--json-only skips preview generation. Limits: 1–40 pins, at most 16 sheet tiles.
Download uses the saved manifest; selections work across separate runs.
Environment: PINTEREST_CHROME_PATH.
Setup: npm ci --omit=dev in ${path.dirname(fileURLToPath(import.meta.url))}
Requires Node.js 22.12+ and installed Chrome/Chromium. No MCP setup is needed.
`;

export function parseCommand(args) {
  if (!args.length || args[0] === '--help' || args[0] === '-h') return { command: 'help', values: {} };
  const [command, ...rest] = args;
  const fields = {
    doctor: {},
    search: { query: { type: 'string' }, limit: { type: 'string' }, output: { type: 'string' }, 'json-only': { type: 'boolean' }, headed: { type: 'boolean' } },
    download: { manifest: { type: 'string' }, indices: { type: 'string' }, output: { type: 'string' } },
    info: { url: { type: 'string' } },
  };
  if (!Object.hasOwn(fields, command)) throw new Error(`Unknown command: ${command}. Use --help.`);
  const { values } = parseArgs({ args: rest, options: { ...fields[command], help: { type: 'boolean', short: 'h' } }, strict: true, allowPositionals: false });
  return { command: values.help ? 'help' : command, values };
}

function required(values, key) {
  if (!values[key]?.trim()) throw new Error(`--${key} is required.`);
  return values[key];
}

export async function main(args = process.argv.slice(2)) {
  const { command, values } = parseCommand(args);
  if (command === 'help') { process.stdout.write(HELP); return; }
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node.js 22.12 or newer is required.');
  if (command === 'doctor') {
    const checks = await Promise.allSettled([loadPuppeteer(), findChrome()]);
    const errors = checks.filter(item => item.status === 'rejected').map(item => item.reason.message);
    process.stdout.write(JSON.stringify({ ready: !errors.length, node: process.version, dependency: checks[0].status === 'fulfilled', chrome_path: checks[1].status === 'fulfilled' ? checks[1].value : null, errors }, null, 2) + '\n');
    if (errors.length) process.exitCode = 1;
    return;
  }
  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Interrupted.'));
  process.once('SIGINT', abort); process.once('SIGTERM', abort);
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]);
  const engine = new PinterestEngine();
  try {
    let result;
    if (command === 'search') {
      result = await searchToFiles(engine, { query: required(values, 'query'), limit: values.limit === undefined ? 12 : Number(values.limit), output: required(values, 'output'), jsonOnly: values['json-only'], headless: !values.headed }, signal);
    } else if (command === 'download') {
      const manifest = await readManifest(required(values, 'manifest'));
      const input = required(values, 'indices');
      if (!/^\d+(,\d+)*$/.test(input)) throw new Error('--indices must be comma-separated numbers, for example 2,5.');
      result = await engine.downloadSelected(manifest, input.split(',').map(Number), required(values, 'output'), signal);
      const report = path.resolve(values.output, manifest.search_id, 'downloads.json');
      result.report_path = report;
      await atomicWrite(report, JSON.stringify(result, null, 2) + '\n');
      if (result.failed.length) process.exitCode = 1;
    } else {
      result = await engine.imageInfo(imageUrl(required(values, 'url')), signal);
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally {
    await engine.close();
    process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(JSON.stringify({ error: error.message }) + '\n');
    process.exitCode = 1;
  });
}
