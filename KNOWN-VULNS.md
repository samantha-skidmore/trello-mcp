# Known npm vulnerabilities — won't-fix decision

**Last evaluated:** May 19, 2026 (QuickOrder Part 216)
**Server version:** trello-mcp v1.2.0
**Decision:** Won't-fix while STDIO transport is in active use.
**Re-evaluate:** Quarterly via Outlook recurring event; or any time HTTP transport is adopted, or `git pull` brings upstream changes.

---

## Summary

`npm audit` reports 7 vulnerabilities (4 moderate, 3 high) in transitive dependencies. All 7 are in packages used **only by `dist/remote.js`** (HTTP transport mode). The active transport for this server is **STDIO** (`dist/index.js`), which does not load any of these packages at runtime.

The exploit surface for all 7 vulnerabilities assumes "untrusted network caller against a public HTTP endpoint." Neither condition applies on a single-user, single-machine, localhost-only install with STDIO transport.

**Conclusion:** The vulnerabilities are dead code in our execution path. Fixing them via `npm audit fix` carries non-trivial breakage risk (transitive dep version bumps across 7 packages) for zero security gain on our actual use case.

---

## The 7 vulnerabilities

All present in packages pulled in by the HTTP transport stack:

| Package | Severity | Vuln summary |
|---|---|---|
| `@hono/node-server` <1.19.13 | Moderate | Middleware bypass via repeated slashes in `serveStatic` |
| `fast-uri` <=3.1.1 | High | Path traversal via percent-encoded dot segments + host confusion |
| `hono` <=4.12.17 | Moderate | Prototype pollution, cookie handling, path traversal, JSX XSS, IP matching, JWT validation, cache leakage, bodyLimit bypass (12 advisories) |
| `ip-address` <=10.1.0 | Moderate | XSS in `Address6` HTML-emitting methods (used by `express-rate-limit`) |
| `path-to-regexp` 8.0.0-8.3.0 | High | ReDoS via sequential optional groups + multiple wildcards |
| `picomatch` 4.0.0-4.0.3 | High | Method injection in POSIX character classes + ReDoS via extglob quantifiers |
| `express-rate-limit` 8.0.1-8.5.0 | (transitive) | Inherits vulnerable `ip-address` |

All `fix available via npm audit fix`. We are not applying the fix; see rationale above.

---

## Threat model walk-through

| Vulnerability class | What it defends against | Why it doesn't apply to us |
|---|---|---|
| Path traversal in `serveStatic` | Attacker requests `/../etc/passwd` | We don't serve static files |
| Prototype pollution via JSON body | Attacker sends `__proto__` keys | Only caller is Claude Code on same machine, sending trusted MCP protocol |
| Cookie name validation bypass | Cross-site cookie injection | MCP doesn't use cookies |
| JWT NumericDate validation | Forged JWT tokens | MCP doesn't use JWTs |
| Cache middleware cross-user leakage | Multi-user cache poisoning | Single-user install |
| ReDoS in `path-to-regexp` / `picomatch` | DoS the public HTTP endpoint | DoS against my own localhost? By my own Claude Code? Self-DoS at worst. |
| XSS in IP HTML methods | Browser-rendered attack | Nothing renders HTML in MCP transport |

---

## When this decision needs to be revisited

This won't-fix is **conditional** on STDIO transport being in use. The decision changes if:

1. **You ever switch to HTTP transport** (`dist/remote.js` instead of `dist/index.js`). Then the 7 vulns become live risk. Run `npm audit fix` carefully (one package at a time, smoke test between each) or wait for upstream fixes.

2. **`git pull` brings new upstream changes from Gabriel Ramirez.** Run `npm audit` again — the vulnerability picture may have changed (new vulns, severity changes, or fixes upstream).

3. **Quarterly check** (Outlook recurring event starting Aug 19, 2026). Even if nothing has changed externally, re-run `npm audit` to confirm the picture is the same.

---

## How to check current transport mode

```powershell
claude mcp list
```

Look for the `trello` entry. The command shown identifies the transport:

- `node .../dist/index.js` = **STDIO** (won't-fix applies)
- `node .../dist/remote.js` or `http://localhost:PORT` = **HTTP** (won't-fix DOES NOT apply, re-evaluate)

---

## Re-evaluation steps

1. `cd C:\projects\tools\trello-mcp`
2. `git status` (confirm clean working tree)
3. `git pull` (pick up upstream)
4. If pull brought changes: `npm install` then `npm run build` then `node dist/index.js` (smoke test — expect "running on stdio (credentials configured)" then Ctrl+C)
5. `npm audit`
6. Compare output to the 7 vulns above
7. Check transport via `claude mcp list`

Decision tree:
- No upstream changes, same audit output, still STDIO → won't-fix still holds.
- Upstream changes pulled, smoke test passes, audit unchanged, still STDIO → won't-fix still holds; close the quarterly event.
- Audit changed → re-evaluate each new/changed vuln against the threat model above.
- Transport switched to HTTP → won't-fix no longer applies; act on vulns.

---

## Cross-references

- **QuickOrder Trello Card #27:** `Resolve npm vulnerabilities in local Trello MCP server` — closed as won't-fix Part 216 (May 19, 2026)
- **CARD-STATUS-LOG.md:** Card #27 row reflects this decision
- **QuickOrder backlog file:** `QUICKORDER-VISIBLE-OPEN-ITEMS.md` has a T3 review row pointing here
- **Outlook calendar:** Recurring quarterly event "Trello MCP — npm audit re-check" starting Aug 19, 2026

---

## Response truncation on get_board_cards (informational)

**Behavior:** Calls to `mcp__trello__get_board_cards` return ~588K–614K 
characters for the QuickOrder board (~190+ cards). This exceeds 
Claude Code's maximum-allowed inline token output, triggering CC's 
tool-result file dump pattern. CC saves the full response to 
`~/.claude/projects/.../tool-results/mcp-trello-get_board_cards-<ts>.txt` 
and emits a truncation warning.

**Impact:** No functional impact — CC reads the dump file via `jq` 
queries and proceeds normally. Adds ~3–5 seconds per 
`get_board_cards` call vs an inline-fit response (file write + 
jq read overhead). Routine and expected; not a bug.

**Mitigation candidates** (not pursued, low priority):
- Source-edit the MCP server to support pagination on `get_board_cards`
- Source-edit to add a `fields` parameter that filters the response 
  to only requested fields (reducing payload size)
- Either edit would require regenerating `dist/index.js` and 
  re-registering the MCP server with Claude Code

**Status:** Accept the overhead. Captured as known behavior so 
future debugging doesn't chase it.

**Discovered:** Trello Ops Part 5 (May 30, 2026) — routine across 
every multi-card session since then.
