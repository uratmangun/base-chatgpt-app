import { NextRequest, NextResponse } from "next/server";
import { CdpClient } from "@coinbase/cdp-sdk";
import { sql, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { serverWallets } from "@/db/schema";

const REQUIRED_ENV_VARS = [
  "CDP_API_KEY_ID",
  "CDP_API_KEY_SECRET",
  "CDP_WALLET_SECRET",
] as const;

type CdpSdkErrorPayload = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

let cachedClient: CdpClient | null = null;

const normalizeAddress = (value: string) => value.trim().toLowerCase();

function ensureCdpClient(): CdpClient {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing CDP environment variables: ${missing.join(", ")}`);
  }

  if (!cachedClient) {
    cachedClient = new CdpClient();
  }

  return cachedClient;
}

function extractMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    const typedError = error as CdpSdkErrorPayload;
    return typedError.response?.data?.message ?? error.message ?? fallback;
  }

  if (error && typeof error === "object") {
    const payload = error as CdpSdkErrorPayload;
    return payload.response?.data?.message ?? payload.message ?? fallback;
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: "Database client is not configured" },
        { status: 500 },
      );
    }

    const baseAccountParam = request.nextUrl.searchParams.get("baseAccount");
    if (!baseAccountParam) {
      return NextResponse.json(
        { error: "baseAccount query parameter is required" },
        { status: 400 },
      );
    }

    const baseAccountAddress = normalizeAddress(baseAccountParam);

    const records = await db
      .select()
      .from(serverWallets)
      .where(eq(serverWallets.baseAccountAddress, baseAccountAddress))
      .orderBy(desc(serverWallets.createdAt));

    return NextResponse.json({ success: true, records });
  } catch (error) {
    console.error("Server wallet list error:", error);

    const message = extractMessage(error, "Failed to list server wallets");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cdp = ensureCdpClient();

    if (!db) {
      return NextResponse.json(
        { error: "Database client is not configured" },
        { status: 500 },
      );
    }

    const payload = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
    const normalizedName = rawName.length > 0 ? rawName : undefined;

    const baseAccountAddressInput =
      typeof payload.baseAccountAddress === "string"
        ? payload.baseAccountAddress
        : null;
    if (!baseAccountAddressInput || !baseAccountAddressInput.trim()) {
      return NextResponse.json(
        { error: "baseAccountAddress is required" },
        { status: 400 },
      );
    }
    const baseAccountAddress = normalizeAddress(baseAccountAddressInput);

    const subAccountAddressInput =
      typeof payload.subAccountAddress === "string"
        ? payload.subAccountAddress
        : null;
    const subAccountAddress =
      subAccountAddressInput && subAccountAddressInput.trim()
        ? normalizeAddress(subAccountAddressInput)
        : null;

    const chainId =
      typeof payload.chainId === "number" && Number.isFinite(payload.chainId)
        ? payload.chainId
        : null;

    const metadata =
      payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, unknown>)
        : null;

    const account = await cdp.evm.createAccount({
      ...(normalizedName ? { name: normalizedName } : {}),
    });

    const storedName = account.name ?? normalizedName ?? null;
    const policies = Array.isArray(account.policies) ? account.policies : null;

    const [record] = await db
      .insert(serverWallets)
      .values({
        baseAccountAddress,
        subAccountAddress,
        serverWalletAddress: normalizeAddress(account.address),
        name: storedName,
        policyIds: policies,
        metadata,
        chainId,
      })
      .onConflictDoUpdate({
        target: serverWallets.serverWalletAddress,
        set: {
          baseAccountAddress,
          subAccountAddress,
          name: storedName,
          policyIds: policies,
          metadata,
          chainId,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return NextResponse.json({ success: true, account, record });
  } catch (error) {
    console.error("Server wallet create error:", error);

    const message = extractMessage(error, "Failed to create server wallet");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
