# PubMed Search Skill

Search PubMed (NCBI) for peer-reviewed medical literature.

## When to Use
- Verifying medical claims
- Finding citations for discussion guides
- Researching a trending health topic
- Building evidence summaries

## How to Search

### Basic Search (exec)
```bash
# Search for articles
curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=10&sort=relevance&term=QUERY" | jq .

# Fetch article details by PMID
curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=PMID1,PMID2&retmode=xml" 

# Fetch abstract as text
curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=PMID&rettype=abstract&retmode=text"
```

### Search Tips
- Use MeSH terms for precise results: `"vaccines"[MeSH] AND "misinformation"[MeSH]`
- Filter by date: `&mindate=2024/01/01&maxdate=2026/12/31&datetype=pdat`
- Filter by article type: `AND "systematic review"[pt]` or `AND "meta-analysis"[pt]`
- Combine terms: `(term1 OR term2) AND term3`

### Citation Format
Always format citations as:
```
Author(s). Title. Journal. Year;Volume(Issue):Pages. PMID: XXXXXXXX. DOI: XX.XXXX/XXXXX
```

## Workflow for Verifying a Claim

1. **Search broadly** — `curl esearch` with the topic
2. **Get top 10 PMIDs** — parse from JSON response
3. **Fetch abstracts** — `curl efetch` for each PMID
4. **Check for systematic reviews** — these are highest evidence
5. **Summarize findings** — with proper citations
6. **Rate confidence** — based on evidence quality and consensus

## Rate Limits
- Without API key: 3 requests/second
- With API key: 10 requests/second
- Add `&api_key=YOUR_KEY` if registered

## Common Searches for Misinformation Topics

```bash
# Vaccine misinformation
"vaccines"[MeSH] AND ("misinformation" OR "disinformation") AND "2024"[pdat]:"2026"[pdat]

# Supplement claims
"dietary supplements"[MeSH] AND "efficacy" AND "systematic review"[pt]

# Ivermectin for COVID (classic misinformation topic)
"ivermectin"[MeSH] AND "COVID-19"[MeSH] AND "systematic review"[pt]

# Seed oils
"vegetable oils"[MeSH] AND "health" AND "inflammation"
```
