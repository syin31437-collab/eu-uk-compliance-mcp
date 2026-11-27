# EU & UK Regulatory Compliance MCP Server (`eu-uk-compliance-mcp`)

[![syin31437-collab/eu-uk-compliance-mcp MCP server](https://glama.ai/mcp/servers/syin31437-collab/eu-uk-compliance-mcp/badges/score.svg)](https://glama.ai/mcp/servers/syin31437-collab/eu-uk-compliance-mcp)

An open-source **Model Context Protocol (MCP)** server giving AI agents, compliance teams, and workflow tools live, deterministic access to official **UK MHRA** and **European Commission (DG SANTE FIP & DG GROW CosIng)** regulatory databases.

Powered by production Apify Actors:
- **UK MHRA E-Cigarette & Vape Compliance Checker**: https://apify.com/alexsyin/uk-mhra-ecig-compliance
- **EU Flavourings (FIP) & Cosmetics / Fragrance (CosIng) Compliance Checker**: https://apify.com/alexsyin/eu-flavour-cosing-compliance

> Need an Apify account? Sign up here to get free monthly credits and your API token: https://console.apify.com/sign-up

---

## Why Use This MCP Server?

LLMs routinely hallucinate ECID notification numbers, CAS numbers, and EU CosIng Annex II/III restrictions. This MCP server wraps two specialized, browser-free Apify Actors so Claude, Cursor, Windsurf, and n8n agents can query **live official government records** directly.

## Exposed MCP Tools

### 1. `check_uk_mhra_ecig`
Queries the official **UK MHRA Great Britain ECIG database** (TRPR 2016) via `alexsyin/uk-mhra-ecig-compliance`.
- **Batch ECID verification**: Pass `productIds: ["01645-24-01407", "99999-00-00000"]` to receive deterministic `isNotified: true | false` compliance records.
- **Catalog search**: Filter by `brand`, `subBrand`, `submitter`, `productType` (`"1"`–`"9"` or `"All"`), `sortBy`, `sortOrder`, and `maxResults`.

### 2. `screen_eu_flavour_cosing`
Batch-screens CAS numbers, flavouring substances, fragrance allergens, and INCI names against official **EU Food Flavourings (DG SANTE FIP, EC 1334/2008 & 1333/2008)** and **EU CosIng (DG GROW, EC 1223/2009 Annex II/III/IV–VI)** via `alexsyin/eu-flavour-cosing-compliance`.
- **Auto-detects CAS vs substance/INCI name**: Pass mixed lists like `["121-33-5", "Menthol", "Linalool"]`.
- **Deterministic flags**: Returns `euFoodFlavouringAuthorized`, `euCosmeticProhibitedAnnexII`, `euCosmeticRestrictedAnnexIII`, `cosingAnnexes`, and `cosingRestrictions`.

---

## Prerequisites

1. **Node.js 18+**
2. An **Apify API Token** (`APIFY_TOKEN`) from [Apify Console → Integrations](https://console.apify.com/account/integrations) (new accounts: https://console.apify.com/sign-up).

---

## Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "eu-uk-compliance": {
      "command": "npx",
      "args": ["-y", "eu-uk-compliance-mcp"],
      "env": {
        "APIFY_TOKEN": "apify_api_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (project-level) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "eu-uk-compliance": {
      "command": "npx",
      "args": ["-y", "eu-uk-compliance-mcp"],
      "env": {
        "APIFY_TOKEN": "apify_api_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### n8n

You have two ways to integrate in n8n:
1. **n8n AI Agent + MCP Client Tool** (via `mcp-client` community node or native MCP Client Tool pointed at `npx -y eu-uk-compliance-mcp` with `APIFY_TOKEN` in env).
2. **Direct HTTP Request / Ready-to-Import n8n Templates**: Import the pre-built workflows in `../n8n-templates/` (`uk-mhra-vape-compliance-monitor.json` and `eu-flavour-cosing-formulation-screener.json`) which call the same Apify Actors directly over HTTPS with zero server hosting required.

---

## Example Prompts

- *"Batch-verify whether UK ECIDs `01645-24-01407` and `99999-00-00000` are legally notified in the UK MHRA database."*
- *"Screen this e-liquid / fragrance formula for EU compliance: `121-33-5` (Vanillin), `89-78-1` (Menthol), `78-70-6` (Linalool), and `50-00-0` (Formaldehyde). Flag any EU CosIng Annex II prohibited or Annex III restricted ingredients."*

---

## Local Development & Verification

```bash
npm install
npm run build
npm test
```

## Publishing to npm & Official MCP Registry

1. Publish the package to npm:
   ```bash
   npm publish --access public
   ```
2. Publish metadata (`server.json`) to the Official MCP Registry using `mcp-publisher`:
   ```bash
   mcp-publisher login github
   mcp-publisher publish
   ```
   > Note: `package.json`'s `"mcpName"` and `server.json`'s `"name"` must match your GitHub namespace (`io.github.<github-username>/eu-uk-compliance-mcp`).

## Disclaimer

Data is retrieved live from public UK MHRA and European Commission endpoints for informational and compliance-screening purposes. Always verify final regulatory submissions against official UK MHRA guidance and the Official Journal of the European Union.

## License

MIT © 2026 Shilin (Alex) Yin
