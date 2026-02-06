# MDLinx Trends Agent

AI-powered medical editorial assistant that monitors trending health misinformation, cross-references against peer-reviewed literature, and generates evidence-based content for doctors and editorial teams.

Built on [OpenClaw](https://openclaw.ai) + Claude.

## Quick Start

```bash
# One command to deploy everything:
./deploy.sh --key <your-ec2-keypair>

# Then SSH in and:
claude login                              # Auth with work Claude Max account
sudo systemctl enable --now openclaw      # Start the agent
openclaw chat                             # Talk to it
```

## What It Does

1. **Monitors trending medical topics** across Google Trends, Reddit, YouTube, podcasts, and social media
2. **Detects misinformation** by cross-referencing viral claims against PubMed, CDC, FDA, and WHO
3. **Generates Discussion Guides** — doctor-facing documents with evidence-based talking points for patient conversations
4. **Generates Editorial Briefs** — staff-facing documents with trend analysis, suggested angles, and citations

### Example Interaction

```
You: What medical misinformation topics are trending right now?

Agent: ## Trending Medical Topics — Feb 6, 2026

### 🔴 High Priority

1. **Seed Oils and Inflammation** — Trend velocity: Rising
   - Google Trends: +340% (7d)
   - Reddit: 12 posts in r/nutrition (top: 4.2K upvotes)
   - YouTube: Dr. Berg video "Why Seed Oils Are Destroying Your Health" (890K views, 3 days)
   - Evidence: Mixed — some inflammatory markers in high-dose animal studies,
     but no clinical evidence of harm at normal dietary levels
   
   → Generate discussion guide? Generate editorial brief?
```

## Architecture

```
AWS VPC (your DEV account)
└── EC2 (t3.small, Ubuntu 24.04)
    ├── OpenClaw Gateway          ← Agent orchestration
    ├── Claude Code               ← AI backbone (Claude Max)
    ├── Chromium (headless)       ← Web scraping (trends, Reddit, YouTube)
    └── Agent Workspace
        ├── Skills: PubMed, Trend Monitor, Content Generation
        ├── Templates: Discussion Guide, Editorial Brief
        └── Memory: Tracked topics, learnings
```

## Security

See [SECURITY.md](SECURITY.md) for the full CTO/IT-ready security document.

**TL;DR:** This is a read-only research agent with the same risk profile as giving an intern a PubMed account and a web browser. No patient data, no production access, no external publishing.

| Feature | Status |
|---------|--------|
| SSH restricted to admin IP | ✅ |
| IMDSv2 required | ✅ |
| EBS encrypted at rest | ✅ |
| Auto security updates | ✅ |
| Fail2ban | ✅ |
| SSH key-only (no passwords) | ✅ |
| Root login disabled | ✅ |
| UFW firewall | ✅ |
| Systemd hardened | ✅ |
| SSM emergency access | ✅ |

## Repository Structure

```
mdlinx-trends/
├── README.md                ← You are here
├── deploy.sh                ← One-command deploy script
├── PROJECT.md               ← Vision, constraints, architecture
├── BACKLOG.md               ← Prioritized tasks & hypotheses
├── LEARNINGS.md             ← Captured insights
├── SECURITY.md              ← CTO/IT security document
├── .gitignore
│
├── sst/                     ← Infrastructure as Code (SST v3)
│   ├── sst.config.ts        ← AWS resources (EC2, SG, IAM, EIP)
│   └── package.json
│
└── agent/                   ← Agent configuration & workspace
    ├── AGENTS.md            ← Deployment instructions (for AI agents)
    ├── _config/
    │   └── openclaw.json    ← OpenClaw configuration (browser, etc.)
    ├── setup-browser.sh     ← Chromium install script (standalone)
    └── workspace/           ← Copied to ~/.openclaw/workspace/ on VPS
        ├── AGENTS.md        ← Agent behavior rules
        ├── SOUL.md          ← Agent identity & medical guardrails
        ├── USER.md          ← User/team context
        ├── MEMORY.md        ← Long-term memory
        ├── TOOLS.md         ← Tool-specific notes (APIs, browser, etc.)
        ├── HEARTBEAT.md     ← Periodic monitoring tasks
        ├── templates/
        │   ├── discussion-guide.md
        │   └── editorial-brief.md
        └── skills/
            ├── pubmed/SKILL.md         ← PubMed search skill
            ├── trend-monitor/SKILL.md  ← Multi-source trend detection
            └── content-gen/SKILL.md    ← Guide & brief generation
```

## Costs

| Resource | Monthly |
|----------|---------|
| EC2 t3.small | ~$15 |
| 30GB EBS gp3 | ~$3 |
| Elastic IP | Free (attached) |
| **Infra total** | **~$18/mo** |
| Claude API (via Max) | Included in subscription |
| OpenAI API | Variable (~$10-30 for POC) |
| Grok API | Variable (~$5-15 for POC) |

## Commands

```bash
# Deploy everything
./deploy.sh --key <keypair>

# Update workspace files only (infra already running)
./deploy.sh --key <keypair> --skip-infra

# Deploy infra only (setup later)
./deploy.sh --key <keypair> --skip-setup

# Tear down
cd sst && npx sst remove --stage production

# Update SSH IP (if your IP changes)
cd sst && npx sst secret set AllowedIP $(curl -s ifconfig.me) && npx sst deploy --stage production
```

## Contributing

This is an internal POC for MDLinx. Contact Peter Pine for access.
