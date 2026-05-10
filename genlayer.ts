import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const GENLAYER_CHAIN = studionet;
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";

export function getReadClient() {
  return createClient({ chain: GENLAYER_CHAIN });
}

export function getWriteClient(address: `0x${string}`) {
  return createClient({
    chain: GENLAYER_CHAIN,
    account: address,
    provider:
      typeof window !== "undefined"
        ? (window as unknown as { ethereum?: unknown }).ethereum
        : undefined,
  });
}

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddress(addr: string) {
  return `${EXPLORER_URL}/contracts/${addr}`;
}
