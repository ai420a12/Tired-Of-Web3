/**
 * Client-side signing for operator tools. Private keys never leave this tab.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  fallback,
  formatEther,
  http,
  parseGwei,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import { quoteLiveGas } from "@/lib/live-gas";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

const HTTP_OPTS = { timeout: 12_000 } as const;

function chainFor(variant: HoodRpcVariant) {
  return variant === "eth" ? mainnet : robinhoodChain;
}

function transportFor(variant: HoodRpcVariant) {
  if (variant === "eth") {
    return fallback([
      http("https://ethereum.publicnode.com", HTTP_OPTS),
      http("https://ethereum-rpc.publicnode.com", HTTP_OPTS),
      http("https://1rpc.io/eth", HTTP_OPTS),
      http("https://eth.drpc.org", HTTP_OPTS),
    ]);
  }
  return fallback([
    http("https://rpc.mainnet.chain.robinhood.com", HTTP_OPTS),
  ]);
}

export function explorerTx(variant: HoodRpcVariant, hash: string) {
  return variant === "eth"
    ? `https://etherscan.io/tx/${hash}`
    : `https://robinhoodchain.blockscout.com/tx/${hash}`;
}

function publicClient(variant: HoodRpcVariant) {
  return createPublicClient({
    chain: chainFor(variant),
    transport: transportFor(variant),
  });
}

function walletClient(variant: HoodRpcVariant, account: ReturnType<typeof privateKeyToAccount>) {
  return createWalletClient({
    account,
    chain: chainFor(variant),
    transport: transportFor(variant),
  });
}

async function quoteFees(variant: HoodRpcVariant, mode: "fast" | "hyper" = "fast") {
  const chain = variant === "eth" ? "ethereum" : "robinhood";
  try {
    const q = await quoteLiveGas({ chain, mode });
    let maxFee = q.maxFeePerGas;
    let tip = q.maxPriorityFeePerGas;
    if (tip >= maxFee) {
      maxFee = tip + (q.liveGwei ? parseGwei(String(Math.max(q.liveGwei, 0.001))) : BigInt(1));
    }
    return { maxFeePerGas: maxFee, maxPriorityFeePerGas: tip };
  } catch {
    const client = publicClient(variant);
    const block = await client.getBlock({ blockTag: "latest" });
    const gasPrice = await client.getGasPrice().catch(() => parseGwei(variant === "eth" ? "1" : "0.01"));
    const base = block.baseFeePerGas ?? gasPrice;
    const tip = variant === "eth" ? parseGwei("0.1") : parseGwei("0.002");
    const maxFee = base + (base * BigInt(125)) / BigInt(1000) + tip;
    return {
      maxFeePerGas: maxFee > tip ? maxFee : tip + base,
      maxPriorityFeePerGas: tip,
    };
  }
}

async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
) {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length || 1) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    },
  );
  await Promise.all(workers);
}

export async function getNativeBalance(
  variant: HoodRpcVariant,
  address: Address,
): Promise<bigint> {
  return publicClient(variant).getBalance({ address });
}

export async function broadcastSigned(
  apiBase: string,
  signedTx: Hex,
  variant: HoodRpcVariant,
): Promise<Hex> {
  let last = "BROADCAST_FAILED";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${apiBase}/broadcast`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedTx, chain: variant }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        hash?: string;
        error?: string;
      };
      if (res.ok && data.ok && data.hash) return data.hash as Hex;
      last = data.error || last;
      if (/nonce too low|already known|known transaction/i.test(last)) {
        const m = last.match(/0x[a-fA-F0-9]{64}/);
        if (m) return m[0] as Hex;
        if (/already known|known transaction/i.test(last)) {
          throw new Error(last);
        }
      }
      if (!/timeout|429|502|503|fetch|network/i.test(last) && res.status < 500) {
        throw new Error(last);
      }
    } catch (err) {
      last = err instanceof Error ? err.message : last;
      if (/nonce too low|insufficient funds|max fee/i.test(last)) throw err;
    }
    await new Promise((r) => setTimeout(r, 400 + attempt * 350));
  }
  throw new Error(last);
}

export async function sendEthFromKey(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  privateKey: Hex;
  to: Address;
  amountWei: bigint;
  nonce?: number;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}): Promise<{ hash: Hex; nonce: number; sent: bigint }> {
  const account = privateKeyToAccount(opts.privateKey);
  const chain = chainFor(opts.variant);
  const pub = publicClient(opts.variant);
  const wallet = walletClient(opts.variant, account);
  const gas = BigInt(21000);

  const nonce =
    opts.nonce ??
    (await pub.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    }));

  let fees =
    opts.maxFeePerGas && opts.maxPriorityFeePerGas
      ? {
          maxFeePerGas: opts.maxFeePerGas,
          maxPriorityFeePerGas: opts.maxPriorityFeePerGas,
        }
      : await quoteFees(opts.variant, "fast");
  if (fees.maxPriorityFeePerGas >= fees.maxFeePerGas) {
    fees = {
      maxFeePerGas: fees.maxPriorityFeePerGas + BigInt(1),
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    };
  }

  let value = opts.amountWei;
  const bal = await pub.getBalance({ address: account.address });
  const cost = gas * fees.maxFeePerGas;
  if (value + cost > bal) {
    value = bal > cost ? bal - cost : BigInt(0);
  }
  if (value <= BigInt(0)) throw new Error("INSUFFICIENT_FUNDS");

  let lastErr = "SEND_FAILED";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      fees = {
        maxFeePerGas:
          fees.maxFeePerGas + (fees.maxFeePerGas * BigInt(25)) / BigInt(100),
        maxPriorityFeePerGas:
          fees.maxPriorityFeePerGas +
          (fees.maxPriorityFeePerGas * BigInt(15)) / BigInt(100),
      };
      if (fees.maxPriorityFeePerGas >= fees.maxFeePerGas) {
        fees.maxFeePerGas = fees.maxPriorityFeePerGas + BigInt(1);
      }
      const live = await pub.getBalance({ address: account.address });
      const need = gas * fees.maxFeePerGas;
      if (value + need > live) {
        value = live > need ? live - need : BigInt(0);
      }
      if (value <= BigInt(0)) break;
    }
    try {
      const signedTx = await wallet.signTransaction({
        to: opts.to,
        value,
        nonce,
        gas,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        chainId: chain.id,
      });
      const hash = await broadcastSigned(opts.apiBase, signedTx, opts.variant);
      return { hash, nonce, sent: value };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (
        /insufficient funds|max fee per gas less than|underpriced|fee too low|timeout|429|502|503/i.test(
          lastErr,
        )
      ) {
        continue;
      }
      throw err instanceof Error ? err : new Error(lastErr);
    }
  }
  throw new Error(lastErr);
}

export async function splitFromMaster(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  masterPk: Hex;
  recipients: Address[];
  onProgress?: (text: string) => void;
}): Promise<{ hashes: Hex[]; perWei: bigint }> {
  if (!opts.recipients.length) throw new Error("NO_RECIPIENTS");
  const account = privateKeyToAccount(opts.masterPk);
  const pub = publicClient(opts.variant);
  const n = BigInt(opts.recipients.length);
  const fees = await quoteFees(opts.variant, "fast");
  const gas = BigInt(21000);
  const perTxCost = gas * fees.maxFeePerGas + (gas * fees.maxFeePerGas) / BigInt(8);
  const bal = await pub.getBalance({ address: account.address });
  if (bal <= perTxCost * n) throw new Error("INSUFFICIENT_MASTER");
  const perWei = (bal - perTxCost * n) / n;
  if (perWei <= BigInt(0)) throw new Error("INSUFFICIENT_MASTER");

  let nonce = await pub.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });
  const hashes: Hex[] = [];
  const errors: string[] = [];
  for (let i = 0; i < opts.recipients.length; i++) {
    const to = opts.recipients[i];
    opts.onProgress?.(
      `Split ${i + 1}/${opts.recipients.length} → ${to.slice(0, 6)}…`,
    );
    try {
      const { hash } = await sendEthFromKey({
        variant: opts.variant,
        apiBase: opts.apiBase,
        privateKey: opts.masterPk,
        to,
        amountWei: perWei,
        nonce,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      hashes.push(hash);
      nonce += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SPLIT_FAILED";
      errors.push(msg);
      nonce = await pub.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      });
    }
  }
  if (!hashes.length) {
    throw new Error(errors[0] || "SPLIT_FAILED");
  }
  return { hashes, perWei };
}

/** Empty a wallet: send balance minus live max-fee, keep only dust. */
async function sweepAllEthFromKey(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  privateKey: Hex;
  to: Address;
}): Promise<Hex | null> {
  const account = privateKeyToAccount(opts.privateKey);
  if (account.address.toLowerCase() === opts.to.toLowerCase()) return null;

  const chain = chainFor(opts.variant);
  const pub = publicClient(opts.variant);
  const wallet = walletClient(opts.variant, account);

  const bal = await pub.getBalance({ address: account.address });
  const gas = BigInt(21000);
  if (bal <= gas) return null;

  const nonce = await pub.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  let fees = await quoteFees(opts.variant, "fast");
  const affordable = bal / gas;
  if (affordable <= fees.maxPriorityFeePerGas) return null;
  if (fees.maxFeePerGas > affordable) fees.maxFeePerGas = affordable;
  if (fees.maxPriorityFeePerGas >= fees.maxFeePerGas) {
    fees.maxPriorityFeePerGas = fees.maxFeePerGas / BigInt(2) || BigInt(1);
  }

  let value = bal - gas * fees.maxFeePerGas;
  if (value <= BigInt(0)) return null;

  let lastErr = "SWEEP_FAILED";
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      if (/insufficient funds/i.test(lastErr)) {
        const cut = gas * (opts.variant === "eth" ? parseGwei("0.5") : parseGwei("0.02"));
        if (value <= cut) return null;
        value -= cut;
        fees.maxFeePerGas = (bal - value) / gas;
      } else {
        fees.maxFeePerGas += (fees.maxFeePerGas * BigInt(30)) / BigInt(100);
        if (fees.maxFeePerGas > affordable) fees.maxFeePerGas = affordable;
        value = bal - gas * fees.maxFeePerGas;
      }
      if (value <= BigInt(0)) return null;
      if (fees.maxPriorityFeePerGas >= fees.maxFeePerGas) {
        fees.maxPriorityFeePerGas = fees.maxFeePerGas / BigInt(2) || BigInt(1);
      }
    }
    try {
      const signedTx = await wallet.signTransaction({
        to: opts.to,
        value,
        nonce,
        gas,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        chainId: chain.id,
      });
      return await broadcastSigned(opts.apiBase, signedTx, opts.variant);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (
        /insufficient funds|max fee per gas less than|underpriced|fee too low|timeout|429|502|503/i.test(
          lastErr,
        )
      ) {
        continue;
      }
      throw err instanceof Error ? err : new Error(lastErr);
    }
  }
  throw new Error(lastErr);
}

export async function consolidateEth(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  keys: Hex[];
  to: Address;
  onProgress?: (text: string) => void;
}): Promise<Hex[]> {
  const hashes: Hex[] = [];
  const errors: string[] = [];
  let done = 0;
  await runPool(opts.keys, 6, async (pk) => {
    try {
      const hash = await sweepAllEthFromKey({
        variant: opts.variant,
        apiBase: opts.apiBase,
        privateKey: pk,
        to: opts.to,
      });
      if (hash) hashes.push(hash);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "SEND_FAILED");
    } finally {
      done += 1;
      opts.onProgress?.(`ETH sweep ${done}/${opts.keys.length}`);
    }
  });
  if (!hashes.length) {
    throw new Error(errors[0] || "NOTHING_TO_SEND");
  }
  return hashes;
}

export function formatEth(wei: bigint): string {
  const n = Number(formatEther(wei));
  return Number.isFinite(n) ? n.toFixed(4) : formatEther(wei);
}

type OwnedNft = {
  owner: string;
  contract: string;
  tokenId: string;
  tokenType: "ERC721" | "ERC1155";
  balance: string;
};

const ERC721_ABI = [
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const ERC1155_ABI = [
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

function nftCalldata(
  nft: OwnedNft,
  from: Address,
  to: Address,
  useSafe: boolean,
): Hex {
  const tokenId = BigInt(nft.tokenId);
  if (nft.tokenType === "ERC1155") {
    let amount = BigInt(1);
    try {
      amount = BigInt(nft.balance || "1");
      if (amount <= BigInt(0)) amount = BigInt(1);
    } catch {
      amount = BigInt(1);
    }
    return encodeFunctionData({
      abi: ERC1155_ABI,
      functionName: "safeTransferFrom",
      args: [from, to, tokenId, amount, "0x"],
    });
  }
  return encodeFunctionData({
    abi: ERC721_ABI,
    functionName: useSafe ? "safeTransferFrom" : "transferFrom",
    args: [from, to, tokenId],
  });
}

async function fetchOwnedNfts(
  apiBase: string,
  addresses: string[],
): Promise<OwnedNft[]> {
  const res = await fetch(`${apiBase}/owned-nfts`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ addresses }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    nfts?: OwnedNft[];
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "NFT_LOOKUP_FAILED");
  }
  return data.nfts || [];
}

export type NftSweepResult = {
  hashes: Hex[];
  sent: number;
  skipped: number;
  errors: string[];
};

export async function consolidateNfts(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  keys: Hex[];
  to: Address;
  onProgress?: (text: string) => void;
}): Promise<NftSweepResult> {
  const dest = opts.to.toLowerCase() as Address;
  const byOwner = new Map<string, Hex>();
  const addrs: Address[] = [];
  for (const pk of opts.keys) {
    const account = privateKeyToAccount(pk);
    const addr = account.address.toLowerCase() as Address;
    if (addr === dest) continue;
    byOwner.set(addr, pk);
    addrs.push(addr);
  }
  if (!addrs.length) throw new Error("NO_SQUAD_KEYS");

  opts.onProgress?.(`Scanning ${addrs.length} wallets for NFTs…`);
  const owned = await fetchOwnedNfts(opts.apiBase, addrs);
  if (!owned.length) throw new Error("NO_NFTS");

  const grouped = new Map<string, OwnedNft[]>();
  for (const nft of owned.slice(0, 120)) {
    const owner = nft.owner.toLowerCase();
    const list = grouped.get(owner) || [];
    list.push(nft);
    grouped.set(owner, list);
  }

  const pub = publicClient(opts.variant);
  const hashes: Hex[] = [];
  const errors: string[] = [];
  let skipped = 0;
  let sent = 0;
  const owners = [...grouped.entries()];

  await runPool(owners, 4, async ([owner, nfts]) => {
    const pk = byOwner.get(owner);
    if (!pk) {
      skipped += nfts.length;
      return;
    }
    let nonce = await pub.getTransactionCount({
      address: owner as Address,
      blockTag: "pending",
    });
    for (const nft of nfts) {
      try {
        const hash = await transferOneNft({
          variant: opts.variant,
          apiBase: opts.apiBase,
          publicClient: pub,
          walletClient: walletClient(opts.variant, privateKeyToAccount(pk)),
          privateKey: pk,
          nft,
          to: dest,
          nonce,
        });
        hashes.push(hash);
        nonce += 1;
        sent += 1;
        opts.onProgress?.(`NFT sweep ${sent} sent`);
      } catch (err) {
        skipped += 1;
        errors.push(err instanceof Error ? err.message : "NFT_SEND_FAILED");
        nonce = await pub.getTransactionCount({
          address: owner as Address,
          blockTag: "pending",
        });
      }
    }
  });

  if (!hashes.length) {
    throw new Error(errors[0] || "NO_NFTS_SENT");
  }
  return { hashes, sent: hashes.length, skipped, errors };
}

async function transferOneNft(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  publicClient: ReturnType<typeof publicClient>;
  walletClient: ReturnType<typeof walletClient>;
  privateKey: Hex;
  nft: OwnedNft;
  to: Address;
  nonce: number;
}): Promise<Hex> {
  const account = privateKeyToAccount(opts.privateKey);
  const from = account.address;
  let useSafe = true;
  let nonce = opts.nonce;

  let lastErr = "NFT_SEND_FAILED";
  for (let attempt = 0; attempt < 6; attempt++) {
    const data = nftCalldata(opts.nft, from, opts.to, useSafe);
    const to = opts.nft.contract as Address;
    const fees = await quoteFees(opts.variant, attempt > 1 ? "hyper" : "fast");
    let gas = opts.nft.tokenType === "ERC1155" ? BigInt(150000) : BigInt(120000);
    try {
      const est = await opts.publicClient.estimateGas({
        account: from,
        to,
        data,
      });
      const padded = (est * BigInt(13)) / BigInt(10);
      if (padded > gas) gas = padded;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (useSafe && opts.nft.tokenType === "ERC721") {
        useSafe = false;
        continue;
      }
      lastErr = msg || "GAS_ESTIMATE_FAILED";
    }

    let { maxFeePerGas, maxPriorityFeePerGas } = fees;
    if (maxPriorityFeePerGas >= maxFeePerGas) {
      maxFeePerGas = maxPriorityFeePerGas + BigInt(1);
    }
    const bal = await opts.publicClient.getBalance({ address: from });
    const need = gas * maxFeePerGas;
    if (bal < need) {
      throw new Error(
        `wallet needs ~${formatEth(need)} ETH gas to send NFT (has ${formatEth(bal)})`,
      );
    }

    try {
      const signedTx = await opts.walletClient.signTransaction({
        to,
        data,
        value: BigInt(0),
        nonce,
        gas,
        maxFeePerGas,
        maxPriorityFeePerGas,
        chainId: chainFor(opts.variant).id,
      });
      return await broadcastSigned(opts.apiBase, signedTx, opts.variant);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (/insufficient funds/i.test(lastErr)) {
        throw new Error(
          `wallet needs ETH for NFT gas (has ${formatEth(bal)})`,
        );
      }
      if (/nonce too low/i.test(lastErr)) {
        nonce = await opts.publicClient.getTransactionCount({
          address: from,
          blockTag: "pending",
        });
        continue;
      }
      if (
        /max fee per gas less than|underpriced|fee too low|replacement|timeout|429|502|503/i.test(
          lastErr,
        )
      ) {
        continue;
      }
      if (useSafe && opts.nft.tokenType === "ERC721") {
        useSafe = false;
        continue;
      }
    }
  }
  throw new Error(lastErr);
}
