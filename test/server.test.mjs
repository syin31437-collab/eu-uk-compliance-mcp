import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  EU_COSING_ACTOR_ID,
  UK_MHRA_ACTOR_ID,
  normalizeActorId,
  runApifyActor,
  stripUndefined,
} from "../dist/apify.js";
import { createServer } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

test("server.json and package.json mcpName match Official MCP Registry requirements", () => {
  const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
  const serverJson = JSON.parse(readFileSync(resolve(rootDir, "server.json"), "utf8"));

  assert.equal(pkg.mcpName, serverJson.name);
  assert.match(pkg.mcpName, /^io\.github\.[a-zA-Z0-9-]+\/eu-uk-compliance-mcp$/);
  assert.equal(pkg.version, serverJson.version);
  assert.equal(serverJson.packages[0].registryType, "npm");
  assert.equal(serverJson.packages[0].identifier, pkg.name);
  assert.equal(serverJson.packages[0].transport.type, "stdio");
  assert.equal(serverJson.packages[0].environmentVariables[0].name, "APIFY_TOKEN");
});

test("normalizeActorId converts slash to tilde and rejects empty strings", () => {
  assert.equal(normalizeActorId(UK_MHRA_ACTOR_ID), "alexsyin~uk-mhra-ecig-compliance");
  assert.equal(normalizeActorId(EU_COSING_ACTOR_ID), "alexsyin~eu-flavour-cosing-compliance");
  assert.throws(() => normalizeActorId("   "), /non-empty/);
});

test("stripUndefined removes undefined fields while preserving false and 0", () => {
  assert.deepEqual(
    stripUndefined({ a: "x", b: undefined, c: false, d: 0 }),
    { a: "x", c: false, d: 0 },
  );
});

test("runApifyActor fails clearly when APIFY_TOKEN is missing", async () => {
  const prev = process.env.APIFY_TOKEN;
  delete process.env.APIFY_TOKEN;
  try {
    await assert.rejects(
      () => runApifyActor(UK_MHRA_ACTOR_ID, { productIds: ["01645-24-01407"] }, { token: "" }),
      /Missing APIFY_TOKEN/,
    );
  } finally {
    if (prev !== undefined) process.env.APIFY_TOKEN = prev;
  }
});

test("runApifyActor sends Bearer auth and handles HTTP 200 and 401", async () => {
  let capturedUrl = "";
  let capturedAuth = "";
  const mockFetchOk = async (url, init) => {
    capturedUrl = String(url);
    capturedAuth = init?.headers?.Authorization ?? "";
    return new Response(JSON.stringify([{ productId: "01645-24-01407", isNotified: true }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const items = await runApifyActor(
    UK_MHRA_ACTOR_ID,
    { productIds: ["01645-24-01407"], brand: undefined },
    { token: "test_token_123", fetchImpl: mockFetchOk },
  );
  assert.match(capturedUrl, /alexsyin~uk-mhra-ecig-compliance\/run-sync-get-dataset-items/);
  assert.equal(capturedAuth, "Bearer test_token_123");
  assert.equal(items.length, 1);
  assert.equal(items[0].isNotified, true);

  const mockFetch401 = async () => new Response("Unauthorized", { status: 401 });
  await assert.rejects(
    () =>
      runApifyActor(
        UK_MHRA_ACTOR_ID,
        { productIds: ["01645-24-01407"] },
        { token: "bad_token", fetchImpl: mockFetch401 },
      ),
    /authentication failed \(HTTP 401\)/,
  );
});

test("MCP server exposes both tools and returns structured compliance summaries", async () => {
  const calls = [];
  const server = createServer({
    runActor: async (actorId, input) => {
      calls.push({ actorId, input });
      if (actorId === UK_MHRA_ACTOR_ID) {
        return [
          { productId: "01645-24-01407", isNotified: true },
          { productId: "99999-00-00000", isNotified: false },
        ];
      }
      return [
        {
          query: "121-33-5",
          euFoodFlavouringAuthorized: true,
          euCosmeticProhibitedAnnexII: false,
          euCosmeticRestrictedAnnexIII: true,
        },
        {
          query: "50-00-0",
          euFoodFlavouringAuthorized: false,
          euCosmeticProhibitedAnnexII: true,
          euCosmeticRestrictedAnnexIII: false,
        },
      ];
    },
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name).sort();
  assert.deepEqual(toolNames, ["check_uk_mhra_ecig", "screen_eu_flavour_cosing"]);

  const ukRes = await client.callTool({
    name: "check_uk_mhra_ecig",
    arguments: { productIds: ["01645-24-01407", "99999-00-00000"] },
  });
  assert.equal(ukRes.isError, undefined);
  const ukPayload = JSON.parse(ukRes.content[0].text);
  assert.equal(ukPayload.summary.notifiedCount, 1);
  assert.equal(ukPayload.summary.unnotifiedCount, 1);

  const emptyUkRes = await client.callTool({
    name: "check_uk_mhra_ecig",
    arguments: {},
  });
  assert.equal(emptyUkRes.isError, true);

  const euRes = await client.callTool({
    name: "screen_eu_flavour_cosing",
    arguments: { queries: ["121-33-5", "50-00-0"] },
  });
  assert.equal(euRes.isError, undefined);
  const euPayload = JSON.parse(euRes.content[0].text);
  assert.equal(euPayload.summary.prohibitedAnnexIICount, 1);
  assert.equal(euPayload.summary.restrictedAnnexIIICount, 1);
  assert.equal(euPayload.summary.foodFlavouringAuthorizedCount, 1);

  assert.equal(calls.length, 2);
  await Promise.all([client.close(), server.close()]);
});
