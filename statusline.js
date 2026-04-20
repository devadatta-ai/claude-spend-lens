#!/usr/bin/env node
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const STATE_DIR   = path.join(process.env.HOME || '', '.claude/state/claude-spend-lens');
const CONFIG_FILE = path.join(STATE_DIR, 'config.json');
const BASE_STATUS = path.join(process.env.HOME || '', '.claude/hooks/statusline-context.js');
const REFRESH_DAYS = 30;

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch {}

function fetchINRRate() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://open.er-api.com/v6/latest/USD', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rate = JSON.parse(data).rates?.INR;
          if (rate) resolve(Number(rate));
          else reject(new Error('INR rate missing'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getConfig() {
  let config = { currency: 'USD' };
  try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
  if (config.currency !== 'INR') return config;

  const daysSince = config.rate_updated
    ? (Date.now() - new Date(config.rate_updated).getTime()) / 86400000
    : Infinity;

  if (daysSince > REFRESH_DAYS || !config.inr_rate) {
    try {
      config.inr_rate     = await fetchINRRate();
      config.rate_updated = new Date().toISOString().slice(0, 10);
      fs.mkdirSync(STATE_DIR, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch {}
  }
  return config;
}

(async () => {
  let baseOut = '';
  if (fs.existsSync(BASE_STATUS)) {
    const base = spawnSync('node', [BASE_STATUS], { input: raw, encoding: 'utf8' });
    baseOut = (base.stdout || '').replace(/\n+$/, '');
  }

  let input = {};
  try { input = JSON.parse(raw); } catch {}

  const sessionId = input.session_id || 'unknown';
  const totalUsd  = Number(input.cost?.total_cost_usd || 0);

  let state = {};
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const stateFile = path.join(STATE_DIR, `${sessionId}.json`);
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
    fs.writeFileSync(stateFile, JSON.stringify({
      prompt_baseline_usd: state.prompt_baseline_usd || 0,
      last_seen_usd: totalUsd,
      updated: new Date().toISOString()
    }));
  } catch {}

  const config    = await getConfig();
  const isInr     = config.currency === 'INR';
  const rate      = isInr ? (config.inr_rate || 84) : 1;
  const symbol    = isInr ? '₹' : '$';
  const decimals  = isInr ? 2 : 4;

  const deltaUsd   = Math.max(0, totalUsd - (state.prompt_baseline_usd || 0));
  const deltaLocal = deltaUsd * rate;
  const totalLocal = totalUsd * rate;

  const dim   = '\x1b[2m';
  const cyan  = '\x1b[36m';
  const reset = '\x1b[0m';
  const fmt   = (n) => `${symbol}${n.toFixed(decimals)}`;

  const prefix = baseOut ? `${baseOut}  ` : '';
  process.stdout.write(
    `${prefix}${dim}|${reset} ${cyan}${fmt(deltaLocal)}${reset} ${dim}|${reset} ${dim}total${reset} ${cyan}${fmt(totalLocal)}${reset}`
  );
})();
