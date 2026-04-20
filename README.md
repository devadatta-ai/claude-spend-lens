# claude-spend-lens

See exactly what each prompt costs the moment Claude finishes responding — spot expensive prompts and spend leaks before you hit the **"you have reached your usage limit"** wall.

```
[claude] ~/project  ctx 12/200k (6%)  | ₹1.24 | total ₹18.50
```

- **Left number** — cost of the current prompt (resets to zero after each response)
- **Right number** — cumulative spend since the session started
- Supports **INR** and **USD**

---

## Install

### INR (Indian Rupee)

```bash
npx claude-spend-lens --inr
```

Fetches the live USD → INR rate at install time. **Auto-refreshes every 30 days** — no manual updates needed. If the network is unavailable, it silently falls back to the last cached rate.

### USD

```bash
npx claude-spend-lens
```

No configuration needed.

### Final step (both)

**Restart Claude Code.** The status line updates immediately on your next session.

---

## Uninstall

```bash
npx claude-spend-lens --uninstall
```

Removes the installed scripts and undoes the `settings.json` changes. Your other Claude Code settings and hooks are untouched.

---

## How it works

- Installs two small Node.js scripts to `~/.claude/tools/claude-spend-lens/` and patches `~/.claude/settings.json`
- **No npm dependencies, no background processes**
- Network call happens only once every 30 days to refresh the INR rate
- Per-prompt delta: accumulates during the full turn (including tool calls), resets only after Claude finishes responding
- Session total: accumulates from session start, resets when you open a new session
- State stored at `~/.claude/state/claude-spend-lens/` — one small JSON file per session, safe to delete anytime

---

## Requirements

- [Node.js](https://nodejs.org) 18 or later
- [Claude Code](https://claude.ai/code) (any version)

---

## License

MIT — see [LICENSE](LICENSE)
