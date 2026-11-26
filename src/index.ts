#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  EU_COSING_ACTOR_ID,
  UK_MHRA_ACTOR_ID,
  runApifyActor,
  type RunActorOptions,
} from "./apify.js";

export type ActorRunner = <T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  options?: RunActorOptions,
) => Promise<T[]>;

export interface ServerDependencies {
  runActor?: ActorRunner;
}

const ukMhraInputSchema = {
  productIds: z
    .array(z.string().min(1))
    .optional()
    .describe(
      "Batch list of exact UK MHRA ECID/GBID codes (e.g. ['01645-24-01407', '99999-00-00000']). Returns one deterministic compliance record per ECID including isNotified: true/false.",
    ),
  productId: z
    .string()
    .optional()
    .describe("Single ECID/GBID or partial Product ID to search (e.g. '01645-24-01407')."),
  brand: z
    .string()
    .optional()
    .describe("Brand name filter (e.g. 'ELF', 'LOST MARY', 'RELX')."),
  subBrand: z
    .string()
    .optional()
    .describe("Sub-brand, flavour, or nicotine strength keyword (e.g. 'Apple Peach', '20 mg/mL')."),
  submitter: z
    .string()
    .optional()
    .describe("Notifying company / manufacturer / submitter name (e.g. 'HEAVEN GIFTS')."),
  productType: z
    .enum(["All", "1", "2", "3", "4", "5", "6", "7", "8", "9"])
    .optional()
    .describe(
      "Official MHRA TRPR product category: All, 1=Disposable, 2=Rechargeable fixed, 3=Rechargeable device, 4=Refillable fixed, 5=Refillable device, 6=Kit, 7=Refill container/cartridge, 8=Individual part, 9=Other.",
    ),
  sortBy: z
    .enum(["published_date", "product_id"])
    .optional()
    .describe("Field to sort search results by (default: published_date)."),
  sortOrder: z
    .enum(["desc", "asc"])
    .optional()
    .describe("Sort direction (default: desc)."),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Maximum number of notified product records to return in search mode (1-1000, default: 50)."),
};

const euCosIngInputSchema = {
  queries: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      "List of CAS numbers (e.g. '121-33-5', '89-78-1') and/or substance, flavouring, fragrance allergen, or INCI names (e.g. 'Vanillin', 'Menthol', 'Linalool'). Auto-detects CAS vs name.",
    ),
  databases: z
    .array(z.enum(["eu_fip", "eu_cosing"]))
    .min(1)
    .optional()
    .describe("Official European Commission databases to query (default: ['eu_fip', 'eu_cosing'])."),
  maxMatchesPerSource: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("Maximum matching regulatory records per database for each query (1-25, default: 10)."),
};

export function createServer(deps: ServerDependencies = {}): McpServer {
  const executeActor: ActorRunner = deps.runActor ?? runApifyActor;

  const server = new McpServer({
    name: "eu-uk-compliance-mcp",
    version: "1.0.0",
  });

  server.tool(
    "check_uk_mhra_ecig",
    "Search and batch-verify legally notified e-cigarettes, vapes, pods, and e-liquid refill containers against the official UK MHRA Great Britain ECIG database (TRPR 2016) via Apify Actor alexsyin/uk-mhra-ecig-compliance.",
    ukMhraInputSchema,
    async (args) => {
      const hasQuery =
        (args.productIds && args.productIds.length > 0) ||
        Boolean(args.productId?.trim()) ||
        Boolean(args.brand?.trim()) ||
        Boolean(args.subBrand?.trim()) ||
        Boolean(args.submitter?.trim());

      if (!hasQuery) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Provide at least one search filter: productIds, productId, brand, subBrand, or submitter.",
            },
          ],
        };
      }

      try {
        const items = await executeActor<Record<string, unknown>>(UK_MHRA_ACTOR_ID, args);
        const notifiedCount = items.filter((item) => item.isNotified === true).length;
        const unnotifiedCount = items.filter((item) => item.isNotified === false).length;

        const payload = {
          actor: UK_MHRA_ACTOR_ID,
          source: "UK MHRA Great Britain ECIG Public Database (TRPR 2016)",
          count: items.length,
          summary: {
            notifiedCount,
            unnotifiedCount,
          },
          results: items,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{ type: "text", text: `check_uk_mhra_ecig failed: ${message}` }],
        };
      }
    },
  );

  server.tool(
    "screen_eu_flavour_cosing",
    "Batch-screen CAS numbers, flavouring substances, fragrance allergens, and INCI names against official EU Food Flavourings (DG SANTE FIP, EC 1334/2008 & 1333/2008) and EU CosIng (DG GROW, EC 1223/2009 Annex II/III) via Apify Actor alexsyin/eu-flavour-cosing-compliance.",
    euCosIngInputSchema,
    async (args) => {
      try {
        const items = await executeActor<Record<string, unknown>>(EU_COSING_ACTOR_ID, args);
        const prohibitedAnnexIICount = items.filter(
          (item) => item.euCosmeticProhibitedAnnexII === true,
        ).length;
        const restrictedAnnexIIICount = items.filter(
          (item) => item.euCosmeticRestrictedAnnexIII === true,
        ).length;
        const foodFlavouringAuthorizedCount = items.filter(
          (item) => item.euFoodFlavouringAuthorized === true,
        ).length;

        const payload = {
          actor: EU_COSING_ACTOR_ID,
          source: "EU DG SANTE FIP (EC 1334/2008) & EU DG GROW CosIng (EC 1223/2009)",
          count: items.length,
          summary: {
            prohibitedAnnexIICount,
            restrictedAnnexIIICount,
            foodFlavouringAuthorizedCount,
          },
          results: items,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{ type: "text", text: `screen_eu_flavour_cosing failed: ${message}` }],
        };
      }
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main().catch((error) => {
    console.error("Fatal error in eu-uk-compliance-mcp:", error);
    process.exit(1);
  });
}
