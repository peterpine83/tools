# HEARTBEAT.md — Periodic Checks

## Trend Monitoring (rotate through, 2-4x daily)

### Check 1: Google Trends Health
- Browse `https://trends.google.com/trending?geo=US&category=health`
- Note any new spikes related to medical misinformation
- Log findings to memory/YYYY-MM-DD.md

### Check 2: Reddit Health Communities
- Browse r/health, r/askdocs (sort by hot/rising)
- Look for posts about misinformation, viral health claims, "is X true?" questions
- Log notable threads

### Check 3: YouTube Health Content
- Check recent uploads from monitored channels (see TOOLS.md)
- Note any videos going viral (>100K views in <48h)
- Log topics and claims being made

### Check 4: CDC/FDA Alerts
- Check CDC MMWR and FDA safety alerts for new publications
- Cross-reference with trending topics

## State Tracking
Track check timestamps in `memory/heartbeat-state.json`

## Rules
- Late night (23:00-07:00 ET): HEARTBEAT_OK unless something urgent
- Log all findings, even if minor
- If a topic is trending across 2+ sources, flag it as high priority
