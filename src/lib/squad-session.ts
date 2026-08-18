import type { Address, Hex } from "viem";
import type { MutableRefObject } from "react";
import { emptyRow, type SquadWallet } from "@/lib/operator-wallets";

export type SquadSessionEntry = {
  id: number;
  address: Address;
  pk?: Hex;
};

let entries: SquadSessionEntry[] = [];
let masterPk: Hex | null = null;

export function listSquadSession(): SquadSessionEntry[] {
  return entries.map((e) => ({ ...e }));
}

export function replaceSquadSession(next: SquadSessionEntry[]) {
  entries = next.map((e) => ({ ...e }));
}

export function clearSquadSession() {
  entries = [];
  masterPk = null;
}

export function getSquadPk(id: number): Hex | undefined {
  return entries.find((e) => e.id === id)?.pk;
}

export function squadSessionKeys(): Hex[] {
  return entries.map((e) => e.pk).filter((pk): pk is Hex => Boolean(pk));
}

export function keyedSquadCount(): number {
  return squadSessionKeys().length;
}

export function setMasterSessionPk(pk: Hex | null) {
  masterPk = pk;
}

export function getMasterSessionPk(): Hex | null {
  return masterPk;
}

export function sessionRowsToSquad(): SquadWallet[] {
  return entries.map((e) =>
    emptyRow(
      e.id,
      e.address,
      `Wallet ${e.id}`,
      Boolean(e.pk),
      e.pk ? "Session key loaded" : "Address only — paste private key to sign",
    ),
  );
}

/** Keep the React ref in sync with the module store so remounts can recover. */
export function syncPkRef(pkById: MutableRefObject<Map<number, Hex>>) {
  pkById.current.clear();
  for (const e of entries) {
    if (e.pk) pkById.current.set(e.id, e.pk);
  }
}
