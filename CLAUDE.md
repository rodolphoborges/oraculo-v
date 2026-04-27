# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Oraculo-V is the **Service Provider** of the Valorant tactical ecosystem. It performs math-based performance analysis, runs an adversarial LLM tribunal, and manages an async job queue. Written in Node.js (ES Modules).

## Commands

```bash
npm start              # Express API + auto-start Worker (server.js, port 3001)
npm run worker         # Worker standalone (without API)
npm test               # E2E test (node tests/run_e2e_test.js)
npm run test:jest      # Jest tests (set NODE_ENV=test)
npm run queue          # Check queue status
npm run recover        # Recover stuck queue jobs
npm run check          # Verify database tables
npm run trends         # Backfill trend data
```

### Direct analysis (bypass queue)
```bash
node analyze_match.js "Nick#Tag" "match-uuid"
```

### Maintenance scripts (`scripts/`)
There are 50+ scripts for queue management, data repair, and diagnostics. Common ones:
```bash
node scripts/check_queue_status.js    # Queue health
node scripts/recover_queue.js         # Recover failed/stuck jobs
node scripts/clear_queue.js           # Clear entire queue
node scripts/force_pending.js         # Force jobs back to pending
node scripts/reset_failed.js          # Reset failed jobs
```

## Module System

**ES Modules** — uses `import`/`export`. The `package.json` has `"type": "module"`. Do not use `require()`.

## Architecture

### Processing Pipeline (5 steps)
1. **Holt-Winters state** — Fetch last 3 matches from `match_stats` for trend baseline
2. **Math engine** — `analyze_match.js` → `lib/analyze_valorant.js` computes Performance Index
3. **Tribunal Engine** — `lib/tribunal_engine.js` runs 3 LLM personas (Allied/Rival/Mentor)
4. **Persist** — Upsert results to `match_stats` table
5. **Webhook callback** — POST results to Protocolo-V's `/api/insights/callback`

If webhook fails, fallback: direct write to Protocolo-V's Supabase (via `PROTOCOL_SUPABASE_URL`).

### Key Files
- `server.js` — Express API (6 endpoints) + calls `startWorker()` on boot
- `worker.js` — Infinite loop polling `match_analysis_queue` for pending jobs. Sequential processing. 5s poll interval when idle.
- `analyze_match.js` — Orchestrator: scrapes tracker.gg via Puppeteer, runs math engine, saves JSON cache
- `lib/analyze_valorant.js` — **Core math engine**: Performance Index (role-aware weights), Holt-Winters smoothing
- `lib/tribunal_engine.js` — LLM adversarial system: 3 personas with Groq→OpenRouter→Ollama fallback chain
- `lib/openrouter_engine.js` — OpenRouter API client + anti-hallucination validation
- `lib/tactical_knowledge.js` — Static tactical database (agents, maps, abilities, valid sites per map)
- `lib/supabase.js` — Supabase client (Oraculo's own sovereign database)
- `lib/tracker_api.js` — Tracker.gg API/scraping layer
- `lib/meta_loader.js` — Meta data loading
- `lib/ranking_service.js` — Ranking calculations

### API Endpoints
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/queue` | `x-api-key` | Enqueue analysis job (returns 202) |
| POST | `/api/analyze` | `x-api-key` | Synchronous analysis (debug only) |
| GET | `/api/status/:matchId` | Public | Check job status/result |
| POST | `/api/chat` | `x-api-key` | Direct K.A.I.O. chat via local LLM |
| GET | `/api/ping` | Public | Health check |
| GET | `/api/health` | Public | DB + queue status |

### Auth Middleware
`adminAuth` validates `x-api-key` header against `ADMIN_API_KEY`. Localhost requests bypass auth (no key required).

## Performance Index

Role-aware weighted formula in `lib/analyze_valorant.js`:
- **Duelist**: 45% KD + 55% ADR + 0% KAST (ADR baseline: 150)
- **Initiator**: 20% KD + 30% ADR + 50% KAST (ADR baseline: 100)
- **Controller**: 15% KD + 20% ADR + 65% KAST (ADR baseline: 85)
- **Sentinel**: 15% KD + 20% ADR + 65% KAST (ADR baseline: 88)

Score = 100 means on-target. >=115 = Alpha, 95-114 = Omega, <95 = Deposito de Torreta.

## Tribunal Engine (LLM)

Three personas analyze each match from different angles. Each generates text independently, then Mentor K.A.I.O. synthesizes.

**Fallback chain per persona**: Groq (`llama-3.3-70b-versatile`) → OpenRouter (`gemini-2.0-flash-exp:free`) → Ollama local.

**Anti-hallucination**: Validates outputs — rejects non-Latin characters, banned terms, and invalid geographic references (e.g., "Site C" on a 2-site map). Implemented in `lib/openrouter_engine.js`.

## Queue Lifecycle

- Jobs enter `match_analysis_queue` as `pending`
- Worker picks up and sets `processing`
- On success: job is **deleted** (not marked completed)
- On failure: job stays with `status: 'failed'` and `error_message`
- Global timeout: 5 minutes (300,000ms) per job

## Database (Supabase)

Tables: `match_analysis_queue`, `match_stats`, `ai_insights`.

`match_stats` uses composite unique key `(match_id, player_id)` for upserts.

## File Cache

- `matches/` — Raw match JSON files (`{match_id}.json`) from tracker.gg scraping
- `analyses/` — Completed analysis reports (`match_{id}_{player}.json`)

The Tribunal Engine checks `matches/{match_id}.json` for local cache before attempting scraping.

## Environment

Copy `.env.example` to `.env`. Critical vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PROTOCOL_API_URL`, `ADMIN_API_KEY`. LLM keys (`GROQ_API_KEY`, `OPENROUTER_API_KEY`) are optional but needed for Tribunal Engine.
