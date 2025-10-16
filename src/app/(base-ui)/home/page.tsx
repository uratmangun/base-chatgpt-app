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
  const [subAddress, setSubAddress] = useState<string | null>(null);
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
        appName: "Base ChatGPT App",
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
      const existing = await instance.subAccount.get();
      setSubAddress(existing?.address ?? null);
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

      setSubAddress(result.address);
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
      const instance = initSdk();
      const sub = await instance.subAccount.get();
      setSubAddress(sub?.address ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to get sub account");
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
        {!isChatGptApp && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 w-full">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                  This app relies on data from a ChatGPT session.
                </p>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                  No{" "}
                  <a
                    href="https://developers.openai.com/apps-sdk/reference"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded"
                  >
                    window.openai
                  </a>{" "}
                  property detected
                </p>
              </div>
            </div>
          </div>
        )}
        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">
          base chatgpt app
        </h1>
        <div className="w-full max-w-md">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">MCP Server URL</p>
          <div className="flex gap-2 items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <code className="flex-1 text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {mcpUrl}
            </code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium rounded transition-colors"
              title="Copy to clipboard"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
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
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Sub Account</p>
            <code className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {subAddress ?? "None"}
            </code>
          </div>
        </div>
      </main>
    </div>
  );
}

