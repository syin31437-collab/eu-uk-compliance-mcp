export const UK_MHRA_ACTOR_ID = "alexsyin/uk-mhra-ecig-compliance";
export const EU_COSING_ACTOR_ID = "alexsyin/eu-flavour-cosing-compliance";

const APIFY_API_BASE = "https://api.apify.com/v2";
const DEFAULT_TIMEOUT_SECS = 120;

export interface RunActorOptions {
  token?: string;
  timeoutSecs?: number;
  fetchImpl?: typeof fetch;
}

export function normalizeActorId(actorId: string): string {
  const trimmed = actorId.trim();
  if (!trimmed) {
    throw new Error("Apify actorId must be a non-empty string.");
  }
  return trimmed.replace("/", "~");
}

export function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function runApifyActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  options: RunActorOptions = {},
): Promise<T[]> {
  const token = (options.token ?? process.env.APIFY_TOKEN ?? "").trim();
  if (!token) {
    throw new Error(
      "Missing APIFY_TOKEN environment variable. Get your Apify API token at https://console.apify.com/account/integrations and set APIFY_TOKEN in your MCP client config.",
    );
  }

  const timeoutSecs = options.timeoutSecs ?? DEFAULT_TIMEOUT_SECS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const normalizedId = normalizeActorId(actorId);
  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(normalizedId)}/run-sync-get-dataset-items?timeout=${timeoutSecs}`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "eu-uk-compliance-mcp/1.0.0",
    },
    body: JSON.stringify(stripUndefined(input)),
    signal: AbortSignal.timeout((timeoutSecs + 15) * 1000),
  });

  if (!response.ok) {
    const bodyText = (await response.text().catch(() => "")).slice(0, 400);
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Apify authentication failed (HTTP ${response.status}). Check that your APIFY_TOKEN is valid and has access to ${actorId}.`,
      );
    }
    if (response.status === 402) {
      throw new Error(
        `Apify account quota exceeded or Actor subscription required (HTTP 402) for ${actorId}. Check https://console.apify.com/billing`,
      );
    }
    if (response.status === 404) {
      throw new Error(`Apify Actor not found (HTTP 404): ${actorId}.`);
    }
    if (response.status === 429) {
      throw new Error(`Apify API rate limit reached (HTTP 429) for ${actorId}. Retry shortly.`);
    }
    throw new Error(
      `Apify API error (HTTP ${response.status}) while running ${actorId}${bodyText ? `: ${bodyText}` : ""}`,
    );
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected response from Apify Actor ${actorId}: expected JSON array of dataset items.`);
  }
  return data as T[];
}
