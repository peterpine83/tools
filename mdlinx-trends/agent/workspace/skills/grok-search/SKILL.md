# Grok Search Skill

Use Grok (xAI) for real-time trending topic discovery and X/Twitter-aware search.

## When to Use
- "What's trending?" — Grok has real-time X/Twitter access
- Cross-referencing topics found on other platforms
- Getting a quick pulse on what's viral right now
- The editorial/content team is familiar with Grok and trusts its output

## How to Call

### Basic Trending Topics Query
```bash
curl -s https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $GROK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-2",
    "messages": [
      {
        "role": "system",
        "content": "You are a medical trend analyst. Focus on health and medical topics trending on social media, particularly misinformation or claims that doctors should be aware of. Include specific sources (tweets, accounts, posts) when possible."
      },
      {
        "role": "user",
        "content": "What are the top 5-10 trending medical or health misinformation topics right now? For each, include: the claim, where it is trending, estimated reach, and whether it is supported by medical evidence."
      }
    ]
  }' | jq -r '.choices[0].message.content'
```

### Deep Dive on a Specific Topic
```bash
curl -s https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $GROK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-2",
    "messages": [
      {
        "role": "system",
        "content": "You are a medical trend analyst with access to real-time social media data."
      },
      {
        "role": "user",
        "content": "Deep dive on [TOPIC]: Who is promoting this claim? What specific posts/tweets/videos are driving it? How fast is it spreading? What are the counter-arguments being made?"
      }
    ]
  }' | jq -r '.choices[0].message.content'
```

### Search for Specific Health Claims on X
```bash
curl -s https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $GROK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-2",
    "messages": [
      {
        "role": "system",
        "content": "Search X/Twitter for recent posts about the given health topic. Report: top posts by engagement, key influencers discussing it, and the general sentiment."
      },
      {
        "role": "user",
        "content": "Search X for recent discussion about: [TOPIC]"
      }
    ]
  }' | jq -r '.choices[0].message.content'
```

## Role in the Pipeline

```
Grok (real-time search) ──→ Topic candidates
         │
         ▼
Claude (orchestrator) ──→ Cross-reference with PubMed, CDC, browser sources
         │
         ▼
Claude (content gen) ──→ Discussion guide + editorial brief
```

1. **Grok goes first** — fast real-time pulse on what's trending
2. **Claude validates** — searches PubMed, checks official sources
3. **Claude generates** — produces the actual documents with citations

## Why Grok + Claude Together

| Capability | Grok | Claude |
|-----------|------|--------|
| Real-time X/Twitter data | ✅ Best | ❌ No access |
| Trending topic detection | ✅ Strong | 🟡 Via browser only |
| Medical accuracy | 🟡 Decent | ✅ Best (with citations) |
| Long-form content generation | 🟡 OK | ✅ Best |
| Citation verification | ❌ May hallucinate | ✅ Can verify via PubMed API |
| Template following | 🟡 OK | ✅ Excellent |

## Rate Limits & Cost
- Grok API pricing: check https://docs.x.ai/docs
- For POC: ~10-20 calls/day is typical ($5-15/month estimate)
- Environment variable: `GROK_API_KEY`

## Important Notes
- Grok output is a **signal source**, not a **citation source**
- Always verify Grok's claims via PubMed/CDC before including in guides
- Grok may have biases from X/Twitter data — cross-reference everything
- The editorial team likes Grok — frame it as "Grok finds topics, the agent makes them actionable"
