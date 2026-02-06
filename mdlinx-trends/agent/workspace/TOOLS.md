# TOOLS.md — Agent Tool Notes

## Browser
- Profile: `openclaw` (headless Chromium)
- Use for: Google Trends, Reddit, YouTube, TikTok, podcast charts, news sites
- Always use `profile="openclaw"` in browser tool calls

## PubMed API (NCBI E-utilities)
- Base URL: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`
- No API key required (rate limit: 3 req/sec without key, 10/sec with key)
- Optional: Register for API key at https://www.ncbi.nlm.nih.gov/account/settings/
- Key endpoints:
  - `esearch.fcgi` — search for PMIDs
  - `efetch.fcgi` — fetch article details
  - `elink.fcgi` — find related articles

## Google Trends
- No API — use browser to scrape trends.google.com
- Useful URLs:
  - `https://trends.google.com/trending?geo=US&category=health` — trending health topics
  - `https://trends.google.com/trends/explore?q=<topic>&cat=45` — specific topic (cat 45 = health)

## Reddit
- Use browser to scrape (API is rate-limited/paywalled)
- Key subreddits: r/health, r/medicine, r/askdocs, r/nutrition, r/supplements, r/science
- Sort by: hot, top (week), rising

## YouTube
- Use browser for trending health content
- Key channels to monitor:
  - Huberman Lab
  - Dr. Eric Berg
  - MedCram
  - ZDoggMD
  - Doctor Mike
  - Pick Up Limes (nutrition)
- Check trending tab filtered to science/health

## Grok API (xAI)
- Key stored in environment variable `GROK_API_KEY`
- Endpoint: https://api.x.ai/v1/chat/completions
- Model: `grok-2`
- **Primary use:** Real-time trending topic detection (has live X/Twitter access)
- **Role:** Signal source — Grok finds what's trending, you verify with PubMed/CDC
- **The editorial team already uses and trusts Grok** — lean into this
- See `skills/grok-search/SKILL.md` for detailed usage

## Multi-LLM Architecture
This agent uses multiple LLMs with different roles:

| Model | Role | How |
|-------|------|-----|
| **Claude** (primary) | Orchestrator, reasoning, content generation | OpenClaw primary model |
| **Grok** | Real-time trending, X/Twitter search | Called via API (`curl`) |
| **OpenAI GPT-4o** | Fallback if Claude is unavailable | OpenClaw fallback model |

Claude is the brain. Grok is the eyes and ears. OpenAI is the backup.

**Important:** Grok output is a SIGNAL source, not a CITATION source. Always verify Grok's claims via PubMed before citing.

## CDC/FDA/WHO
- Use `web_fetch` for official pages
- CDC MMWR: https://www.cdc.gov/mmwr/
- FDA Safety: https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts
- WHO: https://www.who.int/news
