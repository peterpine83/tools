# Trend Monitor Skill

Monitor multiple sources for trending medical/health topics and misinformation.

## When to Use
- "What's trending in medical misinformation?"
- "What health topics are patients asking about?"
- Heartbeat periodic checks
- Building the weekly trending topics report

## Source Scanning Workflow

Run these in order. Each builds on the previous.

### 1. Google Trends — Health Category

```
browser → navigate to https://trends.google.com/trending?geo=US&category=health
browser → snapshot (get trending topics list)
```

Extract: Topic name, search volume, trend direction (rising/breakout).

### 2. Reddit — Health Communities

Scan these subreddits (sort by hot + rising):
```
browser → navigate to https://www.reddit.com/r/health/hot/
browser → snapshot

browser → navigate to https://www.reddit.com/r/askdocs/hot/
browser → snapshot

browser → navigate to https://www.reddit.com/r/nutrition/hot/
browser → snapshot
```

Extract: Post titles, upvotes, comment counts. Look for:
- "Is X true?" questions
- "My doctor said... but I read online..."
- Viral health claims
- Supplement/treatment discussions

### 3. YouTube — Health Channels

Check recent uploads from key channels:
```
browser → navigate to https://www.youtube.com/@hubaboratorylab/videos
browser → snapshot

browser → navigate to https://www.youtube.com/@DrEricBerg/videos  
browser → snapshot

browser → navigate to https://www.youtube.com/@Medcram/videos
browser → snapshot
```

Extract: Video titles, view counts, upload dates. Flag anything >100K views in <48h.

### 4. Cross-Reference with Grok

Use Grok API to validate and expand:
```bash
curl -s https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $GROK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-2",
    "messages": [
      {"role": "system", "content": "You are a medical trend analyst. Identify trending health misinformation topics based on current social media and news."},
      {"role": "user", "content": "What are the top 5 trending medical misinformation topics right now? Include where they are trending (platform, influencer, etc.)"}
    ]
  }' | jq -r '.choices[0].message.content'
```

### 5. Check Official Sources

```bash
# CDC MMWR recent reports
web_fetch → https://www.cdc.gov/mmwr/index.html

# FDA safety alerts
web_fetch → https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts

# WHO news
web_fetch → https://www.who.int/news
```

## Output Format

After scanning, compile into a ranked list:

```markdown
## Trending Medical Topics — [DATE]

### 🔴 High Priority (trending across 2+ sources)

1. **[Topic]** — Trend velocity: [Rising/Breakout]
   - Google Trends: [volume/direction]
   - Reddit: [post count, engagement]
   - YouTube: [video, views]
   - Origin: [who started it, when]
   - Evidence status: [Debunked / Misleading / Nuanced / Emerging]

### 🟡 Medium Priority (trending on 1 source, high engagement)

### 🟢 Watch List (emerging, not yet viral)
```

## Scoring

Rank topics by:
1. **Cross-platform presence** (2+ sources = high priority)
2. **Velocity** (how fast is it growing?)
3. **Patient impact** (will patients ask their doctor about this?)
4. **Misinformation risk** (how wrong/dangerous is the claim?)
5. **Content opportunity** (can MDLinx add unique value?)
