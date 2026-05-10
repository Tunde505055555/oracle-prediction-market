import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

const STORAGE_KEY = "gl_wallet_address";

export function useWallet() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.startsWith("0x")) {
      // verify wallet still exposes it
      window.ethereum
        ?.request({ method: "eth_accounts" })
        .then((accs) => {
          const arr = accs as string[];
          if (arr && arr.includes(saved.toLowerCase())) {
            setAddress(saved as `0x${string}`);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        })
        .catch(() => {});
    }

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        const a = accounts[0] as `0x${string}`;
        setAddress(a);
        localStorage.setItem(STORAGE_KEY, a);
      }
    };
    window.ethereum?.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("No wallet detected. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      const accs = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accs && accs[0]) {
        const a = accs[0] as `0x${string}`;
        setAddress(a);
        localStorage.setItem(STORAGE_KEY, a);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { address, connect, disconnect, connecting, error };
}
