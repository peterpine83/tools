# Content Generation Skill

Generate discussion guides and editorial briefs for trending medical topics.

## When to Use
- "Generate a discussion guide for [topic]"
- "Write an editorial brief on [topic]"
- After trend monitoring identifies a high-priority topic

## Templates

- **Discussion Guide:** `templates/discussion-guide.md` — Doctor-facing, for patient conversations
- **Editorial Brief:** `templates/editorial-brief.md` — Staff-facing, for content planning

## Generation Workflow

### Discussion Guide

1. **Deep PubMed Search**
   - Run 3-5 different search queries on the topic
   - Prioritize: systematic reviews > RCTs > observational > expert opinion
   - Collect 5-10 key citations with PMIDs

2. **Official Positions**
   - Check CDC.gov for position/guidelines on the topic
   - Check FDA.gov for any safety communications
   - Check WHO for fact sheets or statements

3. **Map Misinformation Sources**
   - Where are patients encountering this? (specific podcasts, videos, posts)
   - What exactly is being claimed?
   - Why is it believable/appealing?

4. **Generate Using Template**
   - Follow `templates/discussion-guide.md` structure exactly
   - Fill every section
   - Include all citations with PMIDs/DOIs
   - Write talking points in patient-friendly language

5. **Self-Verify**
   - Are all PMIDs real? (fetch each one to confirm)
   - Are claims accurately representing the cited studies?
   - Is the confidence level appropriate?
   - Would a doctor find this useful in a 10-minute appointment?

### Editorial Brief

1. **Trend Analysis**
   - Use trend-monitor skill data for velocity/source mapping
   - Quantify: search volume, social engagement, timeframe

2. **Evidence Summary**
   - Shorter than discussion guide — editorial needs the gist
   - Focus on what's true vs what's being claimed

3. **Editorial Angles**
   - What unique angle can MDLinx take?
   - Which specialty audience cares most?
   - Suggested headlines (3 options)
   - Content format recommendations

4. **Generate Using Template**
   - Follow `templates/editorial-brief.md` structure
   - Include competitive landscape (who else covered this?)

## Citation Verification

**CRITICAL:** Before finalizing any document, verify every citation:

```bash
# For each PMID referenced:
curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=PMID&rettype=abstract&retmode=text"
```

If a PMID doesn't resolve, REMOVE the citation. Never include unverifiable citations.

## Quality Checklist

Before delivering any generated content:
- [ ] All citations verified (real PMIDs/DOIs)
- [ ] Confidence level stated
- [ ] Date generated and sources-checked date included
- [ ] Misinformation sources specifically identified (not generic)
- [ ] Patient-friendly language in talking points
- [ ] No medical advice (editorial support only)
- [ ] Template structure followed completely
- [ ] Disclaimers present
