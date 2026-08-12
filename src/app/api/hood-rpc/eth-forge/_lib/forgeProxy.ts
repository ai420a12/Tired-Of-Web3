import { NextResponse } from "next/server";

function requireForgeBaseUrl() {
  const base = process.env.NFT_FORGE_BASE_URL || "";
  if (!base) {
    throw new Error(
      "Missing NFT_FORGE_BASE_URL. Set it to your running nft-forge FastAPI origin (e.g. http://127.0.0.1:8787).",
    );
  }
  return base.replace(/\/+$/, "");
}

function qualifyOutputUrl(urlOrPath: unknown) {
  if (typeof urlOrPath !== "string") return urlOrPath;
  if (!urlOrPath) return urlOrPath;
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;

  const base = requireForgeBaseUrl();
  if (urlOrPath.startsWith("/")) return `${base}${urlOrPath}`;
  return `${base}/${urlOrPath}`;
}

export function rewriteJobStatusPayload(j: unknown) {
  if (!j || typeof j !== "object") return j;
  const obj = j as {
    preview?: unknown[];
    zip_url?: unknown;
    folder?: unknown;
  };

  if (Array.isArray(obj.preview)) {
    obj.preview = obj.preview.map(qualifyOutputUrl);
  }
  if (obj.zip_url) obj.zip_url = qualifyOutputUrl(obj.zip_url);
  if (obj.folder) obj.folder = qualifyOutputUrl(obj.folder);
  return obj;
}

export function rewriteRefsPayload(j: unknown) {
  if (!j || typeof j !== "object") return j;
  const obj = j as { previews?: unknown[] };
  if (Array.isArray(obj.previews)) {
    obj.previews = obj.previews.map(qualifyOutputUrl);
  }
  return obj;
}

export async function proxyJson(
  path: string,
  init?: RequestInit,
): Promise<ReturnType<typeof NextResponse.json>> {
  const base = requireForgeBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Accept": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function proxyJsonRaw(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: unknown }> {
  const base = requireForgeBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Accept": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

