# MDLinx Trends — Learnings

*Captured insights from iterations. Updated as we learn.*

---

## Phase 0: Discovery (2026-02-05)

### L1: Current State
- Editorial currently uses Grok for trending topic queries — no structured pipeline
- NewsWhip was previously used (discontinued?)
- Existing RSS scraper (5 years old) pulls feeds + journals — potential asset
- Data lives in Snowflake but not yet leveraged for this use case
- Process is nascent — opportunity to define it right from the start

### L1.5: Existing Infrastructure (peterpine83/tools)
- Peter already has `work-openclaw-setup/` with SST v3 IaC (not Pulumi — SST!)
- Security hardening already solid: IMDSv2, fail2ban, UFW, SSH hardening, encrypted EBS, systemd sandboxing, SSM backup access
- Using t3.small (~$17/mo) — sufficient for POC
- Setup script handles OpenClaw + Claude Code install automatically
- **Decision: Use Peter's existing SST setup, not the Pulumi stack I created** — his is more complete and already uses SST which is what he's familiar with

### L2: Organizational Context
- AI + editorial is politically sensitive — POC needs to demonstrate value without threatening jobs
- Peter is pushing AI adoption internally — needs a win to build credibility
- CTO is supportive (budget-flexible for POC)
- Stack is Next.js + Contentful + Snowflake + AWS — all modern, no blockers
- Teams for comms (no Slack)
- Peter is a strong agentic coder — he can build fast, we're designing + architecting together

### L3: Medical Content Constraints
- Can't hallucinate. Period. Every claim needs a real citation.
- This is editorial support, not medical advice — but still needs to be accurate
- Discussion guides for doctors are the highest-value output
- Two-document approach (Doctor Guide + Editorial Brief) gives us clear separation of concerns
