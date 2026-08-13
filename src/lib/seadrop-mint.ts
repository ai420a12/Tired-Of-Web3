/**
 * Silent live mint — signs MintGo-prepared calldata in this tab.
 * Private keys never leave the browser.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseGwei,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { broadcastSigned, robinhoodChain } from "@/lib/operator-tx";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";

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

async function quoteMintGas(
  publicClient: ReturnType<typeof createPublicClient>,
  variant: HoodRpcVariant,
) {
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const fees = await publicClient.estimateFeesPerGas().catch(() => null);
  const baseFee =
    block.baseFeePerGas ??
    fees?.maxFeePerGas ??
    parseGwei(variant === "eth" ? "0.2" : "0.01");
  let tip = fees?.maxPriorityFeePerGas ?? parseGwei("0.01");
  const tipFloor = parseGwei(variant === "eth" ? "0.05" : "0.001");
  const tipCap = parseGwei(variant === "eth" ? "1.5" : "0.05");
  if (tip < tipFloor) tip = tipFloor;
  if (tip > tipCap) tip = tipCap;
  return {
    maxPriorityFeePerGas: tip,
    maxFeePerGas: (baseFee * BigInt(1250)) / BigInt(1000) + tip,
  };
}

export async function signAndBroadcastMint(opts: {
  variant: HoodRpcVariant;
  apiBase: string;
  privateKey: Hex;
  tx: PreparedTx;
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

  const fees = await quoteMintGas(publicClient, opts.variant);
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });
  const value = opts.tx.value ? BigInt(opts.tx.value) : BigInt(0);
  const gas = opts.tx.gas ? BigInt(opts.tx.gas) : BigInt(450000);

  const signedTx = await walletClient.signTransaction({
    to: opts.tx.to as Address,
    data: opts.tx.data as Hex,
    value,
    gas,
    nonce,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    chainId: chain.id,
  });
  return broadcastSigned(opts.apiBase, signedTx, opts.variant);
}

export function explorerMintTx(variant: HoodRpcVariant, hash: string) {
  return variant === "eth"
    ? `https://etherscan.io/tx/${hash}`
    : `https://robinhoodchain.blockscout.com/tx/${hash}`;
}
