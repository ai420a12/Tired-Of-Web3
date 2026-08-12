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

export async function fetchMintgoUpcoming(
  chain: MintgoChain,
): Promise<MintgoRadarItem[]> {
  const load = async (cookie: string) =>
    fetch(`${MINTGO_ORIGIN}/api/seadrop-radar?chain=${chain}`, {
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
  if (!res.ok) {
    throw new Error(`MintGo radar ${chain} ${res.status}`);
  }
  const data = (await res.json()) as RadarResponse;
  return Array.isArray(data.items) ? data.items : [];
}
