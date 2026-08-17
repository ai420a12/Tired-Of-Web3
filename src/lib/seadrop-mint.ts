/**
 * Silent live mint — signs MintGo-prepared calldata in this tab.
 * Private keys never leave the browser.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { broadcastSigned, robinhoodChain } from "@/lib/operator-tx";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import { quoteLiveGas, type GasSpeed } from "@/lib/live-gas";

export type SquadMintWallet = {
  pk: Hex;
  id: number;
  address: string;
};

type PreparedTx = {
  from?: string;
  to?: string;
  value?: string;
  data?: string;
  gas?: string;
};

function chainFor(variant: HoodRpcVariant) {
  return variant === "eth" ? mainnet : robinhoodChain;
}

function rpcFor(variant: HoodRpcVariant) {
  return variant === "eth"
    ? "https://ethereum.publicnode.com"
    : "https://rpc.mainnet.chain.robinhood.com";
}

export async function signAndBroadcastMint(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  privateKey: Hex;
  tx: PreparedTx;
  gasMode?: GasSpeed;
  manualGwei?: number;
}): Promise<Hex> {
  const account = privateKeyToAccount(opts.privateKey);
  if (
    opts.tx.from &&
    opts.tx.from.toLowerCase() !== account.address.toLowerCase()
  ) {
    throw new Error("MINT_WALLET_MISMATCH");
  }
  if (!opts.tx.to || !opts.tx.data) throw new Error("MINT_TX_INCOMPLETE");

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

  const fees = await quoteLiveGas({
    chain: opts.variant === "eth" ? "ethereum" : "robinhood",
    mode: opts.gasMode || "fast",
    manualGwei: opts.manualGwei,
  });
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });
  const value = opts.tx.value ? BigInt(opts.tx.value) : BigInt(0);
  let gas = opts.tx.gas ? BigInt(opts.tx.gas) : BigInt(500000);
  const gasFloor = BigInt(500000);
  const padded = (gas * BigInt(13)) / BigInt(10);
  if (padded > gas) gas = padded;
  if (gas < gasFloor) gas = gasFloor;

  let lastErr = "BROADCAST_FAILED";
  let maxFee = fees.maxFeePerGas;
  let tip = fees.maxPriorityFeePerGas;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      maxFee += (maxFee * BigInt(35)) / BigInt(100);
      tip += (tip * BigInt(25)) / BigInt(100);
      if (maxFee <= tip) maxFee = tip + tip;
    }
    try {
      const signedTx = await walletClient.signTransaction({
        to: opts.tx.to as Address,
        data: opts.tx.data as Hex,
        value,
        gas,
        nonce,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: tip,
        chainId: chain.id,
      });
      return await broadcastSigned(opts.apiBase, signedTx, opts.variant);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (
        /max fee per gas less than|underpriced|fee too low|replacement|nonce too low|timeout|429|502|503/i.test(
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

export function explorerMintTx(variant: HoodRpcVariant, hash: string) {
  return variant === "eth"
    ? `https://etherscan.io/tx/${hash}`
    : `https://robinhoodchain.blockscout.com/tx/${hash}`;
}
