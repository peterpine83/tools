# MDLinx Trends Agent — Security & Risk Profile

*For CTO/IT review. Balances enterprise security with POC speed.*

## TL;DR

This is a **read-only research agent** that searches public medical literature and social media, then generates editorial content. It has **no access to patient data, internal databases, or production systems.** The risk profile is comparable to giving an intern a PubMed account and a web browser.

## Risk Assessment

### What the Agent CAN Do
- Search public APIs (PubMed, Google Trends, Reddit, YouTube)
- Call AI APIs (Anthropic Claude, OpenAI, Grok) — all SOC2-certified providers
- Generate text documents (discussion guides, editorial briefs)
- Read/write files within its own workspace directory

### What the Agent CANNOT Do
- ❌ Access patient data (PHI/PII) — no Snowflake connection in POC
- ❌ Access production systems or databases
- ❌ Publish content externally — all output requires human editorial review
- ❌ Send emails or messages autonomously
- ❌ Access internal MDLinx systems (Contentful, etc.) — POC is isolated

### Threat: Prompt Injection
**What it is:** Malicious content in web pages or social media posts that tries to trick the AI into taking unintended actions.

**Our mitigations:**
1. **Limited blast radius** — Even if the agent is tricked, it can only write files to its own workspace. It cannot access databases, send messages, or publish content.
2. **All external content is untrusted** — OpenClaw wraps external data in `EXTERNAL_UNTRUSTED_CONTENT` tags, and the agent is instructed to never treat fetched content as commands.
3. **Human-in-the-loop** — No generated content goes anywhere without editorial review. The agent proposes; humans approve.
4. **No secrets in prompts** — API keys are in AWS Secrets Manager, not in the agent's context.
5. **Systemd sandboxing** — The agent process runs with `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, restricted namespaces.

**Residual risk:** An attacker could craft a medical article or social media post that causes the agent to generate biased or misleading content. Mitigation: editorial review before any use.

### Threat: Data Exfiltration
**Mitigations:**
- Agent runs in isolated VPC with security group allowing only outbound HTTPS
- No access to internal databases or production systems
- No patient data in scope
- All API calls go to known endpoints (Anthropic, OpenAI, PubMed, etc.)

### Threat: Unauthorized Access
**Mitigations:**
- SSH restricted to single admin IP
- SSH key-only auth (no passwords)
- Fail2ban for brute-force protection
- IMDSv2 required (prevents SSRF)
- SSM Session Manager for emergency access
- UFW firewall with deny-all-ingress default

## Infrastructure Security (Already Implemented)

From `peterpine83/tools` SST setup:

| Control | Status | Notes |
|---------|--------|-------|
| SSH IP restriction | ✅ | Single IP allowlisted |
| IMDSv2 required | ✅ | SSRF protection |
| Encrypted EBS | ✅ | At-rest encryption |
| Auto security updates | ✅ | unattended-upgrades |
| Fail2ban | ✅ | SSH brute-force protection |
| SSH password auth disabled | ✅ | Key-only |
| Root login disabled | ✅ | No root SSH |
| UFW firewall | ✅ | Deny incoming by default |
| Systemd hardening | ✅ | NoNewPrivileges, ProtectSystem, etc. |
| SSM backup access | ✅ | Keyless emergency access |

## Additional Recommendations (Phase 2, Post-POC)

| Control | Priority | When |
|---------|----------|------|
| CloudWatch logging | Medium | Before expanding user base |
| S3 audit trail | Medium | Before expanding user base |
| VPC flow logs | Low | If compliance requires |
| Secrets Manager for API keys | Medium | Before adding more users |
| WAF (if adding web UI) | High | Before any web-facing surface |
| Snowflake VPC endpoint | High | Before connecting to Snowflake |
| SOC2 documentation | Low | If client-facing |

## POC Scope Boundaries

This POC is explicitly **NOT:**
- Connected to any patient data systems
- Connected to production infrastructure
- Accessible to external users
- Publishing content automatically

It **IS:**
- An isolated research tool on a dedicated EC2 instance
- Accessible only to 2-3 internal staff via SSH/terminal
- Generating draft content that requires human review
- Using only public data sources (PubMed, social media, news)

## Compliance Notes

- **HIPAA:** Not in scope — no PHI touches this system
- **SOC2:** AWS infrastructure aligned; full compliance is Phase 2
- **AI Provider Compliance:** Anthropic (SOC2 Type II), OpenAI (SOC2 Type II) — both enterprise-grade

---

*This document should satisfy CTO/IT concerns for a POC with 2-3 internal users. Production hardening (Phase 2) would add logging, audit trails, and formal access controls.*
