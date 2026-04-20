#!/usr/bin/env node
/**
 * setup.js — one-shot installer for claude-spend-lens
 *
 * Usage:
 *   npx claude-spend-lens           # USD (default)
 *   npx claude-spend-lens --inr     # INR, fetches live rate automatically
 *   npx claude-spend-lens --uninstall
 */

const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const https = require('https');

const HOME        = os.homedir();
const SCRIPTS_DIR = __dirname;
const INSTALL_DIR = path.join(HOME, '.claude', 'tools', 'claude-spend-lens');
const SETTINGS    = path.join(HOME, '.claude', 'settings.json');
const STATE_DIR   = path.join(HOME, '.claude', 'state', 'claude-spend-lens');
const CONFIG_FILE = path.join(STATE_DIR, 'config.json');

const MAIN_SCRIPT = path.join(INSTALL_DIR, 'statusline.js');
const STOP_SCRIPT = path.join(INSTALL_DIR, 'statusline-stop.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetchINRRate() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://open.er-api.com/v6/latest/USD', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rate = JSON.parse(data).rates?.INR;
          if (rate) resolve(Number(rate));
          else reject(new Error('INR rate missing from response'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(6000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch {}
  return {};
}

function writeSettings(obj) {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(obj, null, 2) + '\n');
}

function isOurStopHook(hook) {
  return typeof hook?.command === 'string' && hook.command.includes('claude-spend-lens');
}

// ── Install ───────────────────────────────────────────────────────────────────

async function install(currency) {
  // 1. Copy scripts from package into ~/.claude/tools/claude-spend-lens/
  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  fs.copyFileSync(path.join(SCRIPTS_DIR, 'statusline.js'), MAIN_SCRIPT);
  fs.copyFileSync(path.join(SCRIPTS_DIR, 'statusline-stop.js'), STOP_SCRIPT);
  fs.chmodSync(MAIN_SCRIPT, 0o755);
  fs.chmodSync(STOP_SCRIPT, 0o755);
  console.log(`✓ Scripts installed to ${INSTALL_DIR}`);

  // 2. Write config (fetch live rate for INR)
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (currency === 'INR') {
    process.stdout.write('  Fetching live USD → INR rate... ');
    try {
      const rate   = await fetchINRRate();
      const config = {
        currency: 'INR',
        inr_rate: rate,
        rate_updated: new Date().toISOString().slice(0, 10)
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log(`₹${rate.toFixed(2)} per USD`);
      console.log('  (auto-refreshes every 30 days)');
    } catch (e) {
      console.log('failed — will retry on first session start');
      console.log(`  Error: ${e.message}`);
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ currency: 'INR' }, null, 2));
    }
  } else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ currency: 'USD' }, null, 2));
  }
  console.log(`✓ Config written to ${CONFIG_FILE}`);

  // 3. Patch settings.json
  const cfg          = readSettings();
  cfg.statusLine     = { type: 'command', command: `node "${MAIN_SCRIPT}"` };
  cfg.hooks          = cfg.hooks || {};
  cfg.hooks.Stop     = cfg.hooks.Stop || [];
  const alreadyWired = cfg.hooks.Stop.some(
    e => Array.isArray(e?.hooks) && e.hooks.some(isOurStopHook)
  );
  if (!alreadyWired) {
    cfg.hooks.Stop.push({ hooks: [{ type: 'command', command: `node "${STOP_SCRIPT}"` }] });
  }
  writeSettings(cfg);
  console.log('✓ ~/.claude/settings.json patched');

  console.log('');
  if (currency === 'INR') {
    console.log('Done. Restart Claude Code and you\'ll see:');
    console.log('  | ₹1.24 | total ₹18.50');
  } else {
    console.log('Done. Restart Claude Code and you\'ll see:');
    console.log('  | $0.0015 | total $0.0183');
  }
}

// ── Uninstall ─────────────────────────────────────────────────────────────────

function uninstall() {
  const cfg = readSettings();

  if (cfg.statusLine?.command?.includes('claude-spend-lens')) {
    delete cfg.statusLine;
    console.log('✓ Removed statusLine from settings.json');
  }
  if (Array.isArray(cfg.hooks?.Stop)) {
    const before    = cfg.hooks.Stop.length;
    cfg.hooks.Stop  = cfg.hooks.Stop.filter(
      e => !(Array.isArray(e?.hooks) && e.hooks.some(isOurStopHook))
    );
    if (cfg.hooks.Stop.length < before)
      console.log('✓ Removed Stop hook from settings.json');
  }
  writeSettings(cfg);

  try { fs.rmSync(INSTALL_DIR, { recursive: true, force: true }); } catch {}
  console.log(`✓ Deleted ${INSTALL_DIR}`);
  console.log('');
  console.log(`Session history kept at: ${STATE_DIR}`);
  console.log('Delete that folder manually if you want a full clean slate.');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--uninstall')) return uninstall();
  const currency = args.includes('--inr') ? 'INR' : 'USD';
  await install(currency);
}

main().catch(e => { console.error(e.message); process.exit(1); });
