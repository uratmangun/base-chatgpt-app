"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createBaseAccountSDK, getCryptoKeyAccount } from "@base-org/account";
import {
  useWidgetProps,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
} from "@/app/hooks";

type ServerWalletAccount = {
  id: number;
  baseAccountAddress: string;
  subAccountAddress: string | null;
  serverWalletAddress: string;
  name: string | null;
  chainId: number | null;
  policyIds: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

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
  const [selectedChainId, setSelectedChainId] = useState<number>(84532); // Base Sepolia by default
  const [sdk, setSdk] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [universalAddress, setUniversalAddress] = useState<string | null>(null);
  const [universalBalance, setUniversalBalance] = useState<string | null>(null);
  const [subAccount, setSubAccount] = useState<{ address: string } | null>(
    null,
  );
  const [subAccountBalance, setSubAccountBalance] = useState<string | null>(
    null,
  );
  const [selectedToken, setSelectedToken] = useState<
    "eth" | "usdc" | "eurc" | "cbbtc"
  >("eth");
  const [faucetTarget, setFaucetTarget] = useState<"universal" | "sub">(
    "universal",
  );
  const [sendAmount, setSendAmount] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);
  const [serverWallets, setServerWallets] = useState<ServerWalletAccount[]>([]);
  const [serverWalletsLoading, setServerWalletsLoading] = useState(false);
  const [serverWalletsError, setServerWalletsError] = useState<string | null>(
    null,
  );
  const [serverWalletName, setServerWalletName] = useState<string>("");

  const name = toolOutput?.result?.structuredContent?.name || toolOutput?.name;
  const mcpUrl =
    typeof window !== "undefined"
      ? `${window.innerBaseUrl}/mcp`
      : "http://localhost:3000/mcp";

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
        appChainIds: [selectedChainId],
      });
      setSdk(instance);
      const prov = instance.getProvider();
      setProvider(prov);
      return instance;
    }
    return sdk;
  };

  const fetchBalance = async (address: string): Promise<string> => {
    if (!provider) return "0";
    try {
      const balance = await provider.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      });
      // Convert from wei to ETH using BigInt for accurate large number handling
      const weiBalance = BigInt(balance);
      const ethBalance = Number(weiBalance) / 1e18;
      return ethBalance.toFixed(6);
    } catch (e) {
      console.error("Failed to fetch balance:", e);
      return "0";
    }
  };

  const loadServerWallets = useCallback(
    async (baseAccount?: string | null) => {
      const targetBaseAccount = baseAccount ?? universalAddress ?? undefined;

      if (!targetBaseAccount) {
        setServerWallets([]);
        setServerWalletsError(null);
        return;
      }

      const normalizedBaseAccount = targetBaseAccount.trim().toLowerCase();
      if (!normalizedBaseAccount) {
        setServerWallets([]);
        setServerWalletsError(null);
        return;
      }

      setServerWalletsLoading(true);
      setServerWalletsError(null);

      try {
        const response = await fetch(
          `/api/server-wallets?baseAccount=${encodeURIComponent(
            normalizedBaseAccount,
          )}`,
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load server wallets");
        }

        setServerWallets(Array.isArray(data?.records) ? data.records : []);
      } catch (error) {
        let message = "Failed to load server wallets";
        if (typeof error === "string") {
          message = error;
        } else if (error instanceof Error) {
          message = error.message || message;
        }
        setServerWalletsError(message);
        toast.error(message);
      } finally {
        setServerWalletsLoading(false);
      }
    },
    [universalAddress],
  );

  useEffect(() => {
    if (!universalAddress) {
      setServerWallets([]);
      setServerWalletsError(null);
      return;
    }

    void loadServerWallets();
  }, [loadServerWallets, universalAddress]);

  const handleRefreshServerWallets = () => {
    if (!universalAddress) {
      return;
    }
    void loadServerWallets(universalAddress);
  };

  const handleNetworkChange = (chainId: number) => {
    if (universalAddress) {
      toast.error("Please disconnect wallet before changing network");
      return;
    }
    setSelectedChainId(chainId);
    // Reset SDK to reinitialize with new chain
    setSdk(null);
    setProvider(null);
  };

  const handleConnectWallet = async () => {
    setSendAmount("");
    setRecipientAddress("");
    setLoading("connect");
    try {
      const instance = initSdk();
      const prov = provider ?? instance.getProvider();
      if (!provider) setProvider(prov);

      // Use wallet_connect for Base Account smart wallet connection
      const { accounts } = await prov.request({
        method: "wallet_connect",
        params: [
          {
            version: "1",
          },
        ],
      });

      const { address } = accounts[0];
      if (!address) {
        throw new Error("No account returned from wallet connection");
      }

      setUniversalAddress(address as string);

      // Fetch universal account balance
      const uBalance = await fetchBalance(address);
      setUniversalBalance(uBalance);

      // Get sub account for this domain (only one per domain)
      const response = await prov.request({
        method: "wallet_getSubAccounts",
        params: [
          {
            account: address,
            domain: window.location.origin,
          },
        ],
      });
      const existingSubAccount = response?.subAccounts?.[0];
      setSubAccount(existingSubAccount ?? null);

      // Fetch sub account balance if exists
      if (existingSubAccount) {
        const sBalance = await fetchBalance(existingSubAccount.address);
        setSubAccountBalance(sBalance);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to connect");
    } finally {
      setLoading(null);
    }
  };

  const handleCreateSubAccount = async () => {
    setSendAmount("");
    setRecipientAddress("");
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

      // Set the sub account (only one allowed per domain)
      setSubAccount({ address: result.address });

      // Fetch balance for the newly created sub account
      const sBalance = await fetchBalance(result.address);
      setSubAccountBalance(sBalance);
      toast.success("Sub account created successfully!");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create sub account");
    } finally {
      setLoading(null);
    }
  };

  const handleCreateServerWallet = async () => {
    if (!universalAddress) {
      toast.error("Connect your Base Account before creating a Server Wallet");
      return;
    }

    setLoading("create-server");

    try {
      const fallbackName = `srv-${universalAddress.slice(2, 8)}-${Date.now().toString(36)}`;
      const name = serverWalletName.trim() || fallbackName;

      const response = await fetch("/api/server-wallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          baseAccountAddress: universalAddress,
          subAccountAddress: subAccount?.address ?? null,
          chainId: selectedChainId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create server wallet");
      }

      toast.success("Server wallet created successfully!");
      setServerWalletName("");

      if (data?.record) {
        setServerWallets((previous) => {
          const withoutDuplicate = previous.filter(
            (wallet) =>
              wallet.serverWalletAddress !== data.record.serverWalletAddress,
          );
          return [data.record, ...withoutDuplicate];
        });
      } else {
        await loadServerWallets(universalAddress);
      }
    } catch (error) {
      const message =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Failed to create server wallet";
      toast.error(message || "Failed to create server wallet");
    } finally {
      setLoading(null);
    }
  };

  const handleRequestFaucet = async () => {
    setLoading("faucet");

    try {
      // Only available for Base Sepolia
      if (selectedChainId !== 84532) {
        toast.error("Faucet is only available for Base Sepolia testnet");
        return;
      }

      const targetAddress =
        faucetTarget === "universal" ? universalAddress : subAccount?.address;

      if (!targetAddress) {
        toast.error("Please connect wallet and select a valid target account");
        return;
      }

      // Call the faucet API route
      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: targetAddress,
          network: "base-sepolia",
          token: selectedToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Faucet request failed");
      }

      toast.success(
        `Successfully requested ${selectedToken.toUpperCase()} faucet! TX: ${data.transactionHash.slice(0, 10)}...`,
      );

      // Refresh balances after a short delay
      setTimeout(async () => {
        if (universalAddress) {
          const uBalance = await fetchBalance(universalAddress);
          setUniversalBalance(uBalance);
        }
        if (subAccount) {
          const sBalance = await fetchBalance(subAccount.address);
          setSubAccountBalance(sBalance);
        }
      }, 3000);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to request faucet");
    } finally {
      setLoading(null);
    }
  };

  const handleSendETH = async () => {
    setLoading("send");

    try {
      if (!subAccount) {
        toast.error("Please create a sub account first");
        return;
      }

      if (!sendAmount || parseFloat(sendAmount) <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
        toast.error("Please enter a valid recipient address");
        return;
      }

      // Convert ETH to Wei (hex)
      const amountInWei = BigInt(Math.floor(parseFloat(sendAmount) * 1e18));
      const valueHex = `0x${amountInWei.toString(16)}`;

      // Send transaction using wallet_sendCalls
      const callsId = await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0",
            atomicRequired: true,
            chainId: `0x${selectedChainId.toString(16)}`,
            from: subAccount.address,
            calls: [
              {
                to: recipientAddress,
                data: "0x",
                value: valueHex,
              },
            ],
            capabilities: {
              // Add paymaster if configured
              // paymasterUrl: process.env.NEXT_PUBLIC_PAYMASTER_URL,
            },
          },
        ],
      });

      toast.success(
        `Successfully sent ${sendAmount} ETH! Calls ID: ${callsId.slice(0, 10)}...`,
      );

      // Clear form
      setSendAmount("");
      setRecipientAddress("");

      // Refresh balances after a short delay
      setTimeout(async () => {
        if (subAccount) {
          const sBalance = await fetchBalance(subAccount.address);
          setSubAccountBalance(sBalance);
        }
      }, 3000);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send ETH");
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnectWallet = async () => {
    setLoading("disconnect");

    try {
      // Reset all state
      setUniversalAddress(null);
      setUniversalBalance(null);
      setSubAccount(null);
      setSubAccountBalance(null);
      setSendAmount("");
      setRecipientAddress("");
      setProvider(null);
      setSdk(null);
      setServerWallets([]);
      setServerWalletsError(null);
      setServerWalletsLoading(false);
      setServerWalletName("");

      toast.success("Wallet disconnected successfully!");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to disconnect");
    } finally {
      setLoading(null);
    }
  };

  const handleRefreshBalances = async () => {
    setLoading("refresh");

    try {
      if (!provider) {
        toast.error("Please connect wallet first");
        return;
      }

      // Refresh universal account balance
      if (universalAddress) {
        const uBalance = await fetchBalance(universalAddress);
        setUniversalBalance(uBalance);
      }

      // Refresh sub account balance
      if (subAccount) {
        const sBalance = await fetchBalance(subAccount.address);
        setSubAccountBalance(sBalance);
      }

      if (universalAddress) {
        await loadServerWallets(universalAddress);
      }

      toast.success("Balances refreshed successfully!");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to refresh balances");
    } finally {
      setLoading(null);
    }
  };

  const handleGetSubAccount = async () => {
    setLoading("get");
    try {
      if (!universalAddress || !provider) {
        toast.error("Please connect wallet first");
        return;
      }

      // Get sub account for this domain (only one per domain)
      const response = await provider.request({
        method: "wallet_getSubAccounts",
        params: [
          {
            account: universalAddress,
            domain: window.location.origin,
          },
        ],
      });

      const existingSubAccount = response?.subAccounts?.[0];
      setSubAccount(existingSubAccount ?? null);

      // Fetch sub account balance if exists
      if (existingSubAccount) {
        const sBalance = await fetchBalance(existingSubAccount.address);
        setSubAccountBalance(sBalance);
      } else {
        setSubAccountBalance(null);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to get sub accounts");
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
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              Network
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleNetworkChange(84532)}
                disabled={!!universalAddress}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                  selectedChainId === 84532
                    ? "bg-sky-600 text-white"
                    : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Base Sepolia
              </button>
              <button
                onClick={() => handleNetworkChange(8453)}
                disabled={!!universalAddress}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                  selectedChainId === 8453
                    ? "bg-sky-600 text-white"
                    : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Base Mainnet
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {!universalAddress ? (
              <button
                onClick={handleConnectWallet}
                className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded transition-colors"
                disabled={loading === "connect"}
              >
                {loading === "connect"
                  ? "Connecting..."
                  : "Connect Smart Wallet"}
              </button>
            ) : (
              <>
                <button
                  onClick={handleDisconnectWallet}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
                  disabled={loading === "disconnect"}
                >
                  {loading === "disconnect" ? "Disconnecting..." : "Disconnect"}
                </button>
                <button
                  onClick={handleCreateSubAccount}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-60"
                  disabled={subAccount !== null || loading === "create"}
                >
                  {loading === "create"
                    ? "Creating..."
                    : subAccount
                      ? "Sub Account Exists"
                      : "Create Sub Account"}
                </button>
              </>
            )}
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Universal Account
              </p>
              {universalAddress && (
                <button
                  onClick={handleRefreshBalances}
                  className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 disabled:opacity-50"
                  disabled={loading === "refresh"}
                  title="Refresh balance"
                >
                  🔄
                </button>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 rounded p-2 border border-slate-200 dark:border-slate-600">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Address
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {universalBalance ? `${universalBalance} ETH` : ""}
                </span>
              </div>
              <code className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
                {universalAddress ?? "Not connected"}
              </code>
            </div>
            {selectedChainId === 84532 && universalAddress && (
              <button
                onClick={() => {
                  setFaucetTarget("universal");
                  handleRequestFaucet();
                }}
                className="mt-2 w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-60"
                disabled={loading === "faucet"}
              >
                {loading === "faucet" && faucetTarget === "universal"
                  ? "Requesting..."
                  : "Request Faucet"}
              </button>
            )}
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Sub Account
              </p>
              {subAccount && (
                <button
                  onClick={handleRefreshBalances}
                  className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 disabled:opacity-50"
                  disabled={loading === "refresh"}
                  title="Refresh balance"
                >
                  🔄
                </button>
              )}
            </div>
            {!subAccount ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No sub account found for this domain
              </p>
            ) : (
              <>
                <div className="bg-white dark:bg-slate-900 rounded p-2 border border-slate-200 dark:border-slate-600">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Address
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {subAccountBalance ? `${subAccountBalance} ETH` : "0 ETH"}
                    </span>
                  </div>
                  <code className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
                    {subAccount.address}
                  </code>
                </div>
                {selectedChainId === 84532 && (
                  <button
                    onClick={() => {
                      setFaucetTarget("sub");
                      handleRequestFaucet();
                    }}
                    className="mt-2 w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-60"
                    disabled={loading === "faucet"}
                  >
                    {loading === "faucet" && faucetTarget === "sub"
                      ? "Requesting..."
                      : "Request Faucet"}
                  </button>
                )}
              </>
            )}
          </div>
          {universalAddress && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Server Wallets (CDP)
                </p>
                <button
                  onClick={handleRefreshServerWallets}
                  className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 disabled:opacity-50"
                  disabled={serverWalletsLoading}
                  title="Refresh server wallets"
                >
                  🔄
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                    Server Wallet Name (optional)
                  </label>
                  <input
                    type="text"
                    value={serverWalletName}
                    onChange={(event) =>
                      setServerWalletName(event.target.value)
                    }
                    placeholder="e.g. inventory-settlement"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <button
                  onClick={handleCreateServerWallet}
                  className="w-full px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-60"
                  disabled={loading === "create-server"}
                >
                  {loading === "create-server"
                    ? "Creating..."
                    : "Create Server Wallet"}
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {serverWalletsLoading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Loading server wallets...
                  </p>
                ) : serverWallets.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No server wallets created yet.
                  </p>
                ) : (
                  serverWallets.map((wallet) => (
                    <div
                      key={wallet.serverWalletAddress}
                      className="bg-white dark:bg-slate-900 rounded p-2 border border-slate-200 dark:border-slate-600"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {wallet.name || "Unnamed Server Wallet"}
                        </span>
                        {wallet.chainId && (
                          <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Chain {wallet.chainId}
                          </span>
                        )}
                      </div>
                      <code className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
                        {wallet.serverWalletAddress}
                      </code>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        Linked to {wallet.baseAccountAddress}
                      </p>
                    </div>
                  ))
                )}
                {serverWalletsError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {serverWalletsError}
                  </p>
                )}
              </div>
            </div>
          )}
          {selectedChainId === 84532 && (universalAddress || subAccount) && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                Faucet Token
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(["eth", "usdc", "eurc", "cbbtc"] as const).map((token) => (
                  <button
                    key={token}
                    onClick={() => setSelectedToken(token)}
                    className={`px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                      selectedToken === token
                        ? "bg-green-600 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {token.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Rate limits: ETH (0.1/24h), USDC/EURC (10/24h), cbBTC
                (0.001/24h)
              </p>
            </div>
          )}
          {subAccount && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-3">
                Send ETH from Sub Account
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                    Amount (ETH)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.001"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
                <button
                  onClick={handleSendETH}
                  className="w-full px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-60"
                  disabled={
                    loading === "send" || !sendAmount || !recipientAddress
                  }
                >
                  {loading === "send" ? "Sending..." : "Send ETH"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
