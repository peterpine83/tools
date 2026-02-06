# MDLinx Trends Agent

## Vision

An AI-powered editorial assistant for MDLinx that monitors trending medical/health misinformation topics, generates doctor-facing discussion guides with evidence-based talking points, and produces editorial briefs — all within a secure, medically-compliant chatbot interface deployed on AWS.

## Problem

- Medical misinformation spreads fast; editorial teams need to react quickly with accurate content
- Current process: manual Grok queries + NewsWhip (discontinued) → ad hoc topic selection
- No structured pipeline from "trending topic" → "publishable content"
- Doctors need ready-made talking points to address patient questions driven by misinformation

## Users

| User | Role | Need |
|------|------|------|
| Editorial Team | Content creators | Trending topics + editorial briefs with best practices |
| Product Team | Internal stakeholder | Oversight, analytics, topic pipeline visibility |
| Doctors (indirect) | End consumers | Discussion guides for patient conversations |

## Deliverables Per Topic

1. **Discussion Guide** — Doctor-facing document with:
   - Topic summary (what patients are hearing)
   - Evidence-based facts (cited to PubMed, CDC, FDA, journals)
   - Talking points for patient conversations
   - Common misconceptions and rebuttals
   - When to escalate / red flags

2. **Editorial Brief** — Staff-facing document with:
   - Trend analysis (why this is trending, velocity, sources)
   - Best practice framing for medical content
   - Suggested angles and headlines
   - Source bibliography
   - Audience context (if Snowflake integration available)

## Data Sources

### Existing
- 5-year-old RSS/journal web scraper (feeds + journals)
- Snowflake data warehouse (audience/engagement data — future integration)

### To Integrate
- **PubMed API** — peer-reviewed medical literature
- **CDC/FDA feeds** — official health advisories
- **Google Trends API** — search volume signals
- **Social monitoring** — Twitter/X, Reddit (r/health, r/medicine, r/science)
- **News APIs** — for mainstream coverage detection
- **WHO Disease Outbreak News** — global health signals

## Constraints

### Medical/Regulatory
- Zero tolerance for hallucinated medical claims
- All claims must be cited to verifiable sources
- Content is editorial support, not medical advice (clear disclaimers)
- No patient data in the system — ever
- Audit trail on all generated content

### Enterprise Security
- AWS deployment (VPS)
- Encryption at rest and in transit
- IAM-based access control
- Audit logging (who queried what, when, what was generated)
- SOC2-aligned architecture
- Secrets management (AWS Secrets Manager or Parameter Store)
- Network isolation (VPC, security groups)
- No public endpoints without auth

### Technical
- OpenClaw + Claude Code as the agent platform
- Separate instance from personal infrastructure
- Must be maintainable by MDLinx engineering team
- Cost-conscious (API calls, compute)

## Architecture (High-Level)

```
┌─────────────────────────────────────────────┐
│                  AWS VPC                     │
│                                              │
│  ┌──────────┐    ┌──────────────────────┐   │
│  │ OpenClaw │───▶│   Claude (Anthropic)  │   │
│  │ Instance │    └──────────────────────┘   │
│  └────┬─────┘                                │
│       │                                      │
│  ┌────▼─────────────────────────────────┐   │
│  │         Data Source Layer             │   │
│  │  PubMed │ CDC │ RSS │ Google Trends  │   │
│  │  Reddit │ Twitter │ News APIs        │   │
│  └────┬─────────────────────────────────┘   │
│       │                                      │
│  ┌────▼─────┐    ┌──────────────────┐       │
│  │ Trend    │───▶│ Content Generator │       │
│  │ Detector │    │ (Discussion Guide │       │
│  └──────────┘    │  + Editorial Brief)│       │
│                  └────────┬──────────┘       │
│                           │                  │
│  ┌────────────────────────▼──────────────┐  │
│  │         Chatbot Interface              │  │
│  │  (Internal — Editorial + Product)      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         Audit / Logging Layer          │  │
│  │  CloudWatch │ S3 (generated content)   │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         │
    ┌────▼─────┐
    │ Snowflake│ (future: audience signals)
    └──────────┘
```

## POC Context

**Goal:** Wow department leads. Social proof for AI adoption within MDLinx. ASAP timeline.
**Budget:** Few hundred dollars OK for POC. Existing Claude Max, OpenAI Pro, Grok API available.
**Politics:** AI + editorial is touchy. Need to demonstrate clear value without threatening anyone.
**Bigger picture:** If POC lands, the agent expands to more internal tasks (data viz, etc.)

## MDLinx Stack

- **Framework:** Next.js with microservices
- **CMS:** Contentful (all content lives here)
- **Data:** Snowflake
- **Comms:** Microsoft Teams (no Slack)
- **Cloud:** AWS (primary), GCP available
- **AI Access:** Claude Max, OpenAI Pro + API, Grok API

## Current Focus

**Phase 1: POC** — Build a demo-ready agent that surfaces trending medical misinformation topics and generates discussion guides + editorial briefs. Optimize for "wow factor" over production hardness.

## Open Questions

- [ ] Content style guide — Peter will try to get from editorial
- [ ] RSS scraper access — can Peter connect to it?
- [ ] Contentful API access — for pulling existing MDLinx content as context?
- [ ] Teams integration — or standalone Next.js chat UI for the demo?
