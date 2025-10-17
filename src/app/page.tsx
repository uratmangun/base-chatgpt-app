"use client";

import { useState } from "react";
import { createBaseAccountSDK, getCryptoKeyAccount } from "@base-org/account";
import {
  useWidgetProps,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
} from "@/app/hooks";

export default function Home() {
  const [copied, setCopied] = useState(false);
  const toolOutput = useWidgetProps<{
    name?: string;
    result?: { structuredContent?: { name?: string } };
  }>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const isChatGptApp = useIsChatGptApp();
  const [sdk, setSdk] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [universalAddress, setUniversalAddress] = useState<string | null>(null);
  const [subAccounts, setSubAccounts] = useState<Array<{ address: string }>>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = toolOutput?.result?.structuredContent?.name || toolOutput?.name;
  const mcpUrl = typeof window !== "undefined" ? `${window.innerBaseUrl}/mcp` : "http://localhost:3000/mcp";

  const handleCopy = () => {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initSdk = () => {
    if (!sdk) {
      const instance = createBaseAccountSDK({
        appName: "base sub account spend permission",
        appLogoUrl: "https://base.org/logo.png",
        appChainIds: [84532],
      });
      setSdk(instance);
      const prov = instance.getProvider();
      setProvider(prov);
      return instance;
    }
    return sdk;
  };

  const handleConnectWallet = async () => {
    setError(null);
    setLoading("connect");
    try {
      const instance = initSdk();
      const prov = provider ?? instance.getProvider();
      if (!provider) setProvider(prov);
      const accounts = await prov.request({ method: "eth_requestAccounts" });
      const ua = Array.isArray(accounts) ? accounts[0] : accounts;
      setUniversalAddress(ua as string);
      
      // Get all sub accounts for this domain
      const response = await prov.request({
        method: "wallet_getSubAccounts",
        params: [{
          account: ua,
          domain: window.location.origin,
        }]
      });
      setSubAccounts(response?.subAccounts ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to connect");
    } finally {
      setLoading(null);
    }
  };

  const handleCreateSubAccount = async () => {
    setError(null);
    setLoading("create");
    try {
      const instance = initSdk();
      const prov = provider ?? instance.getProvider();
      if (!provider) setProvider(prov);

      // Try to use a P-256 passkey public key if available and type is WebAuthn
      let params: any = [{ account: { type: "create" as const } }];
      try {
        const cryptoAccount = await getCryptoKeyAccount();
        const acctType = cryptoAccount?.account?.type;
        const publicKey = cryptoAccount?.account?.publicKey;
        if (acctType === "webAuthn" && publicKey) {
          params = [
            {
              account: {
                type: "create",
                keys: [
                  {
                    type: "p256",
                    publicKey,
                  },
                ],
              },
            },
          ];
        }
      } catch (_) {
        // Fallback to no keys; wallet may prompt to create a passkey
      }

      const result = (await prov.request({
        method: "wallet_addSubAccount",
        params,
      })) as { address: `0x${string}` };

      // Add the new sub account to the list
      setSubAccounts(prev => [...prev, { address: result.address }]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create sub account");
    } finally {
      setLoading(null);
    }
  };

  const handleGetSubAccount = async () => {
    setError(null);
    setLoading("get");
    try {
      if (!universalAddress || !provider) {
        setError("Please connect wallet first");
        return;
      }

      // Get all sub accounts for this domain
      const response = await provider.request({
        method: "wallet_getSubAccounts",
        params: [{
          account: universalAddress,
          domain: window.location.origin,
        }]
      });
      
      setSubAccounts(response?.subAccounts ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to get sub accounts");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20"
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : undefined,
      }}
    >
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">
          base sub account spend permission
        </h1>
        <div className="w-full max-w-md flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              onClick={handleConnectWallet}
              className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded transition-colors"
              disabled={loading === "connect"}
            >
              {loading === "connect" ? "Connecting..." : "Connect Smart Wallet"}
            </button>
            <button
              onClick={handleCreateSubAccount}
              className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-60"
              disabled={!universalAddress || loading === "create"}
            >
              {loading === "create" ? "Creating..." : "Create Sub Account"}
            </button>
            <button
              onClick={handleGetSubAccount}
              className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-60"
              disabled={!universalAddress || loading === "get"}
            >
              {loading === "get" ? "Fetching..." : "Get Sub Account"}
            </button>
          </div>
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Universal Account</p>
            <code className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {universalAddress ?? "Not connected"}
            </code>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Sub Accounts ({subAccounts.length})
            </p>
            {subAccounts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No sub accounts found</p>
            ) : (
              <div className="flex flex-col gap-2">
                {subAccounts.map((subAccount, index) => (
                  <div key={subAccount.address} className="bg-white dark:bg-slate-900 rounded p-2 border border-slate-200 dark:border-slate-600">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sub Account #{index + 1}</p>
                    <code className="text-xs font-mono text-slate-900 dark:text-slate-100 break-all">
                      {subAccount.address}
                    </code>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

