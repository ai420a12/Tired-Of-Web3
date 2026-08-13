/**
 * Client-side signing for operator tools. Private keys never leave this tab.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseGwei,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";

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

function chainFor(variant: HoodRpcVariant) {
  return variant === "eth" ? mainnet : robinhoodChain;
}

function rpcFor(variant: HoodRpcVariant) {
  return variant === "eth"
    ? "https://ethereum.publicnode.com"
    : "https://rpc.mainnet.chain.robinhood.com";
}

export function explorerTx(variant: HoodRpcVariant, hash: string) {
  return variant === "eth"
    ? `https://etherscan.io/tx/${hash}`
    : `https://robinhoodchain.blockscout.com/tx/${hash}`;
}

export async function getNativeBalance(
  variant: HoodRpcVariant,
  address: Address,
): Promise<bigint> {
  const client = createPublicClient({
    chain: chainFor(variant),
    transport: http(rpcFor(variant)),
  });
  return client.getBalance({ address });
}

export async function broadcastSigned(
  apiBase: string,
  signedTx: Hex,
  variant: HoodRpcVariant,
): Promise<Hex> {
  const res = await fetch(`${apiBase}/broadcast`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signedTx, chain: variant }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    hash?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.hash) {
    throw new Error(data.error || "BROADCAST_FAILED");
  }
  return data.hash as Hex;
}

export async function sendEthFromKey(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  privateKey: Hex;
  to: Address;
  amountWei: bigint;
  nonce?: number;
}): Promise<{ hash: Hex; nonce: number }> {
  const account = privateKeyToAccount(opts.privateKey);
  const chain = chainFor(opts.variant);
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcFor(opts.variant)),
  });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcFor(opts.variant)),
  });

  const nonce =
    opts.nonce ??
    (await publicClient.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    }));

  const gas = await publicClient
    .estimateGas({
      account: account.address,
      to: opts.to,
      value: opts.amountWei,
    })
    .catch(() => BigInt(21000));

  const fees = await publicClient.estimateFeesPerGas().catch(() => null);
  const maxPriorityFeePerGas =
    fees?.maxPriorityFeePerGas ?? parseGwei("2");
  const maxFeePerGas =
    fees?.maxFeePerGas ?? parseGwei(opts.variant === "eth" ? "40" : "0.1");

  const signedTx = await walletClient.signTransaction({
    to: opts.to,
    value: opts.amountWei,
    nonce,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    chainId: chain.id,
  });
  const hash = await broadcastSigned(opts.apiBase, signedTx, opts.variant);
  return { hash, nonce };
}

export async function splitFromMaster(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  masterPk: Hex;
  recipients: Address[];
}): Promise<{ hashes: Hex[]; perWei: bigint }> {
  if (!opts.recipients.length) throw new Error("NO_RECIPIENTS");
  const account = privateKeyToAccount(opts.masterPk);
  const bal = await getNativeBalance(opts.variant, account.address);
  const n = BigInt(opts.recipients.length);
  const gasReserve = parseGwei(opts.variant === "eth" ? "80" : "1") * BigInt(25000) * n;
  if (bal <= gasReserve) throw new Error("INSUFFICIENT_MASTER");
  const perWei = (bal - gasReserve) / n;
  if (perWei <= BigInt(0)) throw new Error("INSUFFICIENT_MASTER");

  const publicClient = createPublicClient({
    chain: chainFor(opts.variant),
    transport: http(rpcFor(opts.variant)),
  });
  let nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });
  const hashes: Hex[] = [];
  for (const to of opts.recipients) {
    const { hash } = await sendEthFromKey({
      variant: opts.variant,
      apiBase: opts.apiBase,
      privateKey: opts.masterPk,
      to,
      amountWei: perWei,
      nonce,
    });
    hashes.push(hash);
    nonce += 1;
  }
  return { hashes, perWei };
}

/** Empty a wallet: send balance minus current base-fee, not a fat RPC quote. */
async function sweepAllEthFromKey(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  privateKey: Hex;
  to: Address;
}): Promise<Hex | null> {
  const account = privateKeyToAccount(opts.privateKey);
  if (account.address.toLowerCase() === opts.to.toLowerCase()) return null;

  const chain = chainFor(opts.variant);
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcFor(opts.variant)),
  });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcFor(opts.variant)),
  });

  const bal = await publicClient.getBalance({ address: account.address });
  const gas = BigInt(21000);
  if (bal <= gas) return null;

  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  const block = await publicClient.getBlock({ blockTag: "latest" });
  const gasPrice = await publicClient.getGasPrice().catch(() => parseGwei("1"));
  const baseFee = block.baseFeePerGas ?? gasPrice;
  const tip = parseGwei(opts.variant === "eth" ? "0.2" : "0.01");
  let maxFeePerGas = baseFee + (baseFee * BigInt(125)) / BigInt(1000) + tip;
  if (maxFeePerGas < tip + BigInt(1)) maxFeePerGas = tip + BigInt(1);

  const affordable = bal / gas;
  if (affordable < baseFee) {
    throw new Error(
      `leftover ${formatEth(bal)} ETH is below gas (${formatEth(gas * baseFee)} ETH)`,
    );
  }
  if (maxFeePerGas > affordable) maxFeePerGas = affordable;
  let priority = tip < maxFeePerGas ? tip : maxFeePerGas / BigInt(2);
  let value = bal - gas * maxFeePerGas;
  if (value <= BigInt(0)) return null;

  let lastErr = "SWEEP_FAILED";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const signedTx = await walletClient.signTransaction({
        to: opts.to,
        value,
        nonce,
        gas,
        maxFeePerGas,
        maxPriorityFeePerGas: priority,
        chainId: chain.id,
      });
      return await broadcastSigned(opts.apiBase, signedTx, opts.variant);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (/insufficient funds/i.test(lastErr)) {
        const cut = gas * parseGwei(opts.variant === "eth" ? "1" : "0.05");
        if (value <= cut) break;
        value -= cut;
        maxFeePerGas = (bal - value) / gas;
        if (priority >= maxFeePerGas) {
          priority = maxFeePerGas / BigInt(2);
        }
        continue;
      }
      if (/max fee per gas less than|underpriced|fee too low/i.test(lastErr)) {
        const bump = (maxFeePerGas * BigInt(20)) / BigInt(100) + parseGwei("0.5");
        maxFeePerGas += bump;
        if (maxFeePerGas > affordable) maxFeePerGas = affordable;
        value = bal - gas * maxFeePerGas;
        if (value <= BigInt(0)) break;
        if (priority >= maxFeePerGas) {
          priority = maxFeePerGas / BigInt(2);
        }
        continue;
      }
      throw err;
    }
  }
  throw new Error(lastErr);
}

export async function consolidateEth(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  keys: Hex[];
  to: Address;
}): Promise<Hex[]> {
  const hashes: Hex[] = [];
  const errors: string[] = [];
  for (const pk of opts.keys) {
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
    }
  }
  if (!hashes.length) {
    throw new Error(errors[0] || "NOTHING_TO_SEND");
  }
  return hashes;
}

export function formatEth(wei: bigint): string {
  const n = Number(formatEther(wei));
  return Number.isFinite(n) ? n.toFixed(4) : formatEther(wei);
}
