const MINTGO_ORIGIN = "https://mintgo.fun";
const MINTGO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export type MintgoChain = "ethereum" | "robinhood";

export type MintgoRadarItem = {
  chain?: string;
  contractAddress?: string;
  displayName?: string;
  imageUrl?: string | null;
  openSeaSlug?: string | null;
  openseaUrl?: string | null;
  priceEth?: string | number | null;
  startTime?: string | null;
  startAt?: number | null;
  status?: string | null;
  soldOut?: boolean;
  supply?: { minted?: number | null; max?: number | null } | null;
};

type RadarResponse = {
  chain?: string;
  items?: MintgoRadarItem[];
  error?: string;
};

let sessionCookie = "";
let sessionExpiresAt = 0;
let sessionInflight: Promise<string> | null = null;

function cookieHeaderFromResponse(res: Response): string {
  const lines =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") || ""];
  return lines
    .map((line) => line.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function mintgoSession(force = false): Promise<string> {
  if (!force && sessionCookie && Date.now() < sessionExpiresAt - 60_000) {
    return sessionCookie;
  }
  if (sessionInflight) return sessionInflight;

  sessionInflight = (async () => {
    const res = await fetch(`${MINTGO_ORIGIN}/api/session`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: MINTGO_ORIGIN,
        referer: `${MINTGO_ORIGIN}/`,
        "user-agent": MINTGO_UA,
      },
      body: "{}",
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      expiresAt?: number;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `MintGo session ${res.status}`);
    }
    const cookie = cookieHeaderFromResponse(res);
    if (!cookie) throw new Error("MintGo session cookie missing");
    sessionCookie = cookie;
    sessionExpiresAt = Number(data.expiresAt || Date.now() + 30 * 60_000);
    return sessionCookie;
  })().finally(() => {
    sessionInflight = null;
  });

  return sessionInflight;
}

async function mintgoFetch(path: string): Promise<Response> {
  const load = async (cookie: string) =>
    fetch(`${MINTGO_ORIGIN}${path}`, {
      headers: {
        accept: "application/json",
        origin: MINTGO_ORIGIN,
        referer: `${MINTGO_ORIGIN}/`,
        "user-agent": MINTGO_UA,
        cookie,
      },
      cache: "no-store",
    });

  let cookie = await mintgoSession();
  let res = await load(cookie);
  if (res.status === 401) {
    cookie = await mintgoSession(true);
    res = await load(cookie);
  }
  return res;
}

async function mintgoJson<T>(path: string, label: string): Promise<T> {
  const res = await mintgoFetch(path);
  if (!res.ok) throw new Error(`${label} ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchMintgoUpcoming(
  chain: MintgoChain,
): Promise<MintgoRadarItem[]> {
  const data = await mintgoJson<RadarResponse>(
    `/api/seadrop-radar?chain=${chain}`,
    `MintGo radar ${chain}`,
  );
  return Array.isArray(data.items) ? data.items : [];
}

export type MintgoWindow = "1m" | "5m" | "15m" | "1h" | "1d";

export type MintgoMintAnalysis = {
  status?: string;
  ready?: boolean;
  reason?: string;
  mode?: string;
  maxPerWallet?: number;
  maxBatch?: number;
  unitPriceWei?: string;
  unitPriceEth?: number;
  functionLabel?: string;
  mintTarget?: string;
  requiresHelper?: boolean;
  helperConfigured?: boolean;
  nativeSymbol?: string;
  serviceFeePerMintWei?: string;
};

export type MintgoPreparedTx = {
  from?: string;
  to?: string;
  value?: string;
  data?: string;
  gas?: string;
  unifiedQuantityPerChild?: number;
  serviceFeeTotalWei?: string;
  serviceFeeTotalEth?: number;
  serviceFeePerMintWei?: string;
};

type MintgoBootstrap = {
  mints?: Record<string, unknown>[];
  trending?: Record<string, unknown>[];
  runners?: Record<string, unknown>[];
};

export async function fetchMintgoBootstrap(
  chain: MintgoChain,
  window: MintgoWindow,
): Promise<MintgoBootstrap> {
  return mintgoJson<MintgoBootstrap>(
    `/api/bootstrap?window=${window}&chain=${chain}`,
    `MintGo bootstrap ${chain}`,
  );
}

export async function fetchMintgoAllBootstrap(
  window: MintgoWindow,
): Promise<Partial<Record<MintgoChain, MintgoBootstrap>>> {
  const data = await mintgoJson<{
    chains?: Partial<Record<MintgoChain, MintgoBootstrap>>;
  }>(`/api/all/bootstrap?window=${window}`, "MintGo all bootstrap");
  return data.chains || {};
}

export async function fetchMintgoCollection(
  chain: MintgoChain,
  contract: string,
): Promise<Record<string, unknown>> {
  return mintgoJson<Record<string, unknown>>(
    `/api/collection/${contract}?chain=${chain}`,
    `MintGo collection ${chain}`,
  );
}

export async function fetchMintgoMintTx(opts: {
  chain: MintgoChain;
  contract: string;
  quantity: number;
  from: string;
  allowPaid: boolean;
}): Promise<{
  ok?: boolean;
  error?: string;
  reason?: string;
  analysis?: MintgoMintAnalysis;
  tx?: MintgoPreparedTx;
  gasValidated?: boolean;
}> {
  const allow = opts.allowPaid ? "1" : "0";
  return mintgoJson(
    `/api/mint-tx/${opts.contract}?quantity=${opts.quantity}&from=${opts.from}&allowPaid=${allow}&chain=${opts.chain}`,
    `MintGo mint-tx ${opts.chain}`,
  );
}
