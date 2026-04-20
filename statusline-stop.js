#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const STATE_DIR = path.join(process.env.HOME || '', '.claude/state/claude-spend-lens');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch {}

let input = {};
try { input = JSON.parse(raw); } catch {}

const sessionId = input.session_id || 'unknown';
const stateFile = path.join(STATE_DIR, `${sessionId}.json`);

try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const state    = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : {};
  const totalUsd = Number(input.cost?.total_cost_usd || state.last_seen_usd || 0);
  fs.writeFileSync(stateFile, JSON.stringify({
    prompt_baseline_usd: totalUsd,
    last_seen_usd: totalUsd,
    updated: new Date().toISOString()
  }));
} catch {}

process.exit(0);
