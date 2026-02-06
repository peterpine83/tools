# MDLinx Trends — Backlog

## Hypotheses

### H1: Trend Detection
**"We can reliably detect trending medical misinformation topics by combining social signals (Twitter, Reddit, Google Trends) with medical literature (PubMed, CDC/FDA)."**
- Status: 🔴 Untested
- Risk: High — this is the core value prop
- Priority: 1

### H2: Cited Content Generation
**"Claude can generate medically accurate discussion guides and editorial briefs with proper citations to real, verifiable sources — without hallucination."**
- Status: 🔴 Untested
- Risk: High — medical accuracy is non-negotiable
- Priority: 1

### H3: Editorial Workflow Fit
**"A chatbot interface is the right UX for editorial to discover topics and generate content."**
- Status: 🔴 Untested
- Risk: Medium — might need scheduled reports instead of/alongside chat
- Priority: 2

### H4: Snowflake Integration Value
**"Audience engagement data from Snowflake can meaningfully improve topic prioritization."**
- Status: 🔴 Untested
- Risk: Low — nice-to-have, not core
- Priority: 3

---

## Tasks

### Phase 1: Foundation

#### T1: Data Source Spike — Trend Detection ⬜
**Hypothesis:** H1
**Goal:** Prove we can pull meaningful trending health topic signals from 2-3 sources
**Tasks:**
- [ ] Set up PubMed API access (free, NCBI E-utilities)
- [ ] Set up Google Trends API or scraping approach
- [ ] Set up Reddit API (r/health, r/medicine, r/askdocs)
- [ ] Build a simple aggregator that cross-references signals
**Verify:** Can identify at least 3 currently-trending health topics that match what Grok would surface
**Estimate:** 2-4 hours

#### T2: Content Generation Spike — Discussion Guide ⬜
**Hypothesis:** H2
**Goal:** Prove Claude can generate a medically accurate, cited discussion guide
**Tasks:**
- [ ] Design discussion guide template/schema
- [ ] Build prompt chain: topic → PubMed search → synthesize → generate guide
- [ ] Test with 3 known misinformation topics (e.g., vaccine myths, ivermectin, seed oils)
- [ ] Manual verification: are citations real? Are claims accurate?
**Verify:** 3 generated guides with 100% real citations, reviewed for accuracy
**Estimate:** 2-4 hours

#### T3: Content Generation Spike — Editorial Brief ⬜
**Hypothesis:** H2
**Goal:** Prove Claude can generate useful editorial briefs
**Tasks:**
- [ ] Design editorial brief template
- [ ] Build prompt chain: topic + trend data → editorial brief
- [ ] Test with same 3 topics from T2
**Verify:** Editorial team finds briefs useful (qualitative)
**Estimate:** 1-2 hours

#### T4: AWS Infrastructure Setup ⬜
**Hypothesis:** N/A (foundation)
**Goal:** Secure AWS environment for the agent
**Tasks:**
- [ ] Provision EC2 instance (or ECS) in VPC
- [ ] Set up security groups (minimal ingress)
- [ ] Configure IAM roles (least privilege)
- [ ] Set up AWS Secrets Manager for API keys
- [ ] Install OpenClaw + Claude Code
- [ ] Configure CloudWatch logging
- [ ] Set up S3 bucket for generated content audit trail
**Verify:** OpenClaw responds to a test query from within VPC
**Estimate:** 3-5 hours

#### T5: Chatbot Interface Prototype ⬜
**Hypothesis:** H3
**Goal:** Simple internal chat interface for editorial to interact with the agent
**Tasks:**
- [ ] Evaluate options: Slack bot, Discord, web UI, or OpenClaw's built-in channels
- [ ] Build MVP interface (likely Slack given enterprise context)
- [ ] Implement basic commands: "what's trending?", "generate guide for [topic]"
**Verify:** Editorial user can ask a question and get a useful response
**Estimate:** 2-3 hours

### Phase 2: Integration & Polish

#### T6: RSS Scraper Integration ⬜
- [ ] Assess existing scraper (can we reuse or need to rebuild?)
- [ ] Connect journal/RSS data as a signal source

#### T7: Snowflake Connection ⬜
- [ ] Set up Snowflake connector
- [ ] Query audience engagement data
- [ ] Use as signal for topic prioritization

#### T8: Scheduled Reports ⬜
- [ ] Daily/weekly trending topics digest (cron job)
- [ ] Auto-generate top 5 discussion guides
- [ ] Email or Slack delivery to editorial

#### T9: Content Review Workflow ⬜
- [ ] Editorial approval flow before publish
- [ ] Version tracking on generated content
- [ ] Feedback loop (editorial rates quality → improves prompts)
