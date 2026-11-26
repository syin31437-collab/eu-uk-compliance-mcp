# PR Draft for `punkpeye/awesome-mcp-servers`

## Target Section

Add under **Compliance / Legal / Regulatory** (or **Data Platforms** / **Search** if no Compliance subsection exists—check `README.md` in `punkpeye/awesome-mcp-servers` right before opening the PR).

## Standard One-Line Entry

> Update `syin31437-collab` below if you publish under a different GitHub username.

```markdown
- [eu-uk-compliance-mcp](https://github.com/syin31437-collab/eu-uk-compliance-mcp) 📇 ☁️ - Verify UK MHRA notified e-cigarettes (ECIG/TRPR 2016) and batch-screen CAS numbers, flavourings, and INCI ingredients against official EU FIP (EC 1334/2008) and EU CosIng (EC 1223/2009 Annex II/III) regulatory databases.
```

*(Legend used by `punkpeye/awesome-mcp-servers`: `📇` = TypeScript, `☁️` = Cloud API / remote service)*

---

## PR Title

```text
Add eu-uk-compliance-mcp (UK MHRA ECIG & EU FIP/CosIng Regulatory Compliance)
```

## PR Description

```markdown
## Summary

Adds **[eu-uk-compliance-mcp](https://github.com/syin31437-collab/eu-uk-compliance-mcp)**, an open-source TypeScript MCP server (MIT licensed, Official MCP Registry `server.json` ready) for live UK and EU regulatory compliance screening.

### Tools Included
1. `check_uk_mhra_ecig` — Search and batch-verify UK MHRA Great Britain notified e-cigarettes, pods, and e-liquid refill containers (ECIG / TRPR 2016) with deterministic `isNotified: true | false` records.
2. `screen_eu_flavour_cosing` — Batch-screen CAS numbers, flavouring substances, fragrance allergens, and INCI names against official European Commission databases: DG SANTE FIP (EC 1334/2008 & 1333/2008) and DG GROW CosIng (EC 1223/2009 Annex II/III/IV–VI).

### Checklist
- [x] Open-source repository with MIT license and full setup documentation
- [x] Includes Claude Desktop, Cursor, and n8n configuration examples
- [x] Follows `awesome-mcp-servers` formatting and emoji conventions
- [x] No credentials or secrets committed
```
