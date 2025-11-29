import { Aptos, AptosConfig, InputGenerateTransactionPayloadData } from "@aptos-labs/ts-sdk";
import { NETWORK, MODULE_ADDRESS } from "@/constants";

// Initialize Aptos client
const config = new AptosConfig({ network: NETWORK });
export const aptos = new Aptos(config);

// Token-related types
export interface TokenInfo {
  creator: string;
  metadata: string;
  name: string;
  symbol: string;
  decimals: number;
  icon_uri: string;
  project_uri: string;
  total_supply: bigint;
  max_supply: bigint;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  decimals: number;
  icon_uri: string;
  project_uri: string;
  initial_supply: bigint;
  max_supply: bigint;
}

// Helper to get module function ID
const getModuleId = (moduleName: string, functionName: string) =>
  `${MODULE_ADDRESS}::${moduleName}::${functionName}`;

// View Functions (read-only)
export async function getTokenInfo(metadataAddr: string): Promise<TokenInfo> {
  const result = await aptos.view({
    payload: {
      function: getModuleId("token", "get_token_info") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [metadataAddr],
    },
  });

  const [creator, metadata, name, symbol, decimals, icon_uri, project_uri, total_supply, max_supply] = result;

  return {
    creator: creator as string,
    metadata: metadata as string,
    name: name as string,
    symbol: symbol as string,
    decimals: Number(decimals),
    icon_uri: icon_uri as string,
    project_uri: project_uri as string,
    total_supply: BigInt(total_supply as string),
    max_supply: BigInt(max_supply as string),
  };
}

export async function getTokenBalance(owner: string, metadataAddr: string): Promise<bigint> {
  const [balance] = await aptos.view({
    payload: {
      function: getModuleId("token", "get_balance") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [owner, metadataAddr],
    },
  });
  return BigInt(balance as string);
}

export async function getTokenCounter(): Promise<number> {
  const [counter] = await aptos.view({
    payload: {
      function: getModuleId("token", "get_token_counter") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [],
    },
  });
  return Number(counter);
}

// Transaction Payload Builders
export function buildCreateTokenPayload(params: CreateTokenParams): InputGenerateTransactionPayloadData {
  return {
    function: getModuleId("token", "create_token") as `${string}::${string}::${string}`,
    typeArguments: [],
    functionArguments: [
      params.name,
      params.symbol,
      params.decimals,
      params.icon_uri,
      params.project_uri,
      params.initial_supply.toString(),
      params.max_supply.toString(),
    ],
  };
}

export function buildMintTokenPayload(
  metadataAddr: string,
  amount: bigint,
  to: string
): InputGenerateTransactionPayloadData {
  return {
    function: getModuleId("token", "mint") as `${string}::${string}::${string}`,
    typeArguments: [],
    functionArguments: [metadataAddr, amount.toString(), to],
  };
}

export function buildBurnTokenPayload(
  metadataAddr: string,
  amount: bigint
): InputGenerateTransactionPayloadData {
  return {
    function: getModuleId("token", "burn") as `${string}::${string}::${string}`,
    typeArguments: [],
    functionArguments: [metadataAddr, amount.toString()],
  };
}

// ========================================
// Locking Module
// ========================================

export interface LockInfo {
  id: number;
  locker: string;
  projectPointerOpt: string | null;
  assetRef: string;
  amount: bigint;
  kind: number; // 0 = fungible, 1 = LP
  unlockTs: number;
  withdrawn: boolean;
  escrowed: boolean;
  metadataOpt: string | null;
}

export interface CreateLockParams {
  token: string;
  amount: bigint;
  unlockTs: number;
  projectPointerOpt?: Uint8Array | null;
  metadataOpt?: Uint8Array | null;
}

export interface CreateLPLockParams {
  assetRef: Uint8Array;
  amount: bigint;
  unlockTs: number;
  projectPointerOpt?: Uint8Array | null;
  metadataOpt?: Uint8Array | null;
}

// Lock View Functions
export async function getLock(lockId: number): Promise<LockInfo> {
  const result = await aptos.view({
    payload: {
      function: getModuleId("locking", "get_lock") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [lockId],
    },
  });

  const [id, locker, projectPointerOpt, assetRef, amount, kind, unlockTs, withdrawn, escrowed, metadataOpt] = result;

  return {
    id: Number(id),
    locker: locker as string,
    projectPointerOpt: projectPointerOpt as string | null,
    assetRef: assetRef as string,
    amount: BigInt(amount as string),
    kind: Number(kind),
    unlockTs: Number(unlockTs),
    withdrawn: withdrawn as boolean,
    escrowed: escrowed as boolean,
    metadataOpt: metadataOpt as string | null,
  };
}

export async function getLockCounter(): Promise<number> {
  const [counter] = await aptos.view({
    payload: {
      function: getModuleId("locking", "get_lock_counter") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [],
    },
  });
  return Number(counter);
}

export async function isLockUnlocked(lockId: number): Promise<boolean> {
  const [unlocked] = await aptos.view({
    payload: {
      function: getModuleId("locking", "is_unlocked") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [lockId],
    },
  });
  return unlocked as boolean;
}

// Lock Transaction Builders
export function buildCreateLockWithDepositPayload(params: CreateLockParams): InputGenerateTransactionPayloadData {
  return {
    function: getModuleId("locking", "create_lock_with_deposit") as `${string}::${string}::${string}`,
    typeArguments: [],
    functionArguments: [
      params.projectPointerOpt ? Array.from(params.projectPointerOpt) : [],
      params.token,
      params.amount.toString(),
      params.unlockTs,
      params.metadataOpt ? Array.from(params.metadataOpt) : [],
    ],
  };
}

export function buildCreateLPLockPayload(params: CreateLPLockParams): InputGenerateTransactionPayloadData {
  return {
    function: getModuleId("locking", "create_lock_for_lp") as `${string}::${string}::${string}`,
    typeArguments: [],
    functionArguments: [
      params.projectPointerOpt || null,
      Array.from(params.assetRef),
      params.amount.toString(),
      params.unlockTs,
      params.metadataOpt || null,
    ],
  };
}

export function buildWithdrawLockedPayload(lockId: number): InputGenerateTransactionPayloadData {
  return {
    function: getModuleId("locking", "withdraw_locked") as `${string}::${string}::${string}`,
    typeArguments: [],
    functionArguments: [lockId],
  };
}

// ========================================
// Vesting Module
// ========================================

export interface StreamInfo {
  id: number;
  owner: string;
  beneficiary: string;
  token: string;
  totalAmount: bigint;
  startTs: number;
  endTs: number;
  claimed: bigint;
  escrowed: boolean;
  metadataOpt: string | null;
}

export interface CreateStreamParams {
  beneficiary: string;
  token: string;
  totalAmount: bigint;
  startTs: number;
  endTs: number;
  metadataOpt?: Uint8Array | null;
}

// Vesting View Functions
export async function getStream(streamId: number): Promise<StreamInfo> {
  const result = await aptos.view({
    payload: {
      function: getModuleId("vesting", "get_stream") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [streamId],
    },
  });

  const [id, owner, beneficiary, token, totalAmount, startTs, endTs, claimed, escrowed, metadataOpt] = result;

  return {
    id: Number(id),
    owner: owner as string,
    beneficiary: beneficiary as string,
    token: token as string,
    totalAmount: BigInt(totalAmount as string),
    startTs: Number(startTs),
    endTs: Number(endTs),
    claimed: BigInt(claimed as string),
    escrowed: escrowed as boolean,
    metadataOpt: metadataOpt as string | null,
  };
}

export async function getClaimable(streamId: number): Promise<bigint> {
  const [claimable] = await aptos.view({
    payload: {
      function: getModuleId("vesting", "get_claimable") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [streamId],
    },
  });
  return BigInt(claimable as string);
}

export async function getStreamCounter(): Promise<number> {
  const [counter] = await aptos.view({
    payload: {
      function: getModuleId("vesting", "get_stream_counter") as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [],
    },
  });
  return Number(counter);
}

// Vesting Transaction Builders
export function buildCreateStreamWithDepositPayload(params: CreateStreamParams): InputGenerateTransactionPayloadData {
  return {
    function: getModuleId("vesting", "create_stream_with_deposit") as `${string}::${string}::${string}`,
    typeArguments: [],
    functionArguments: [
      params.beneficiary,
      params.token,
      params.totalAmount.toString(),
      params.startTs,
      params.endTs,
      params.metadataOpt || null,
    ],
  };
}

export function buildClaimPayload(streamId: number): InputGenerateTransactionPayloadData {
  return {
    function: getModuleId("vesting", "claim") as `${string}::${string}::${string}`,
    typeArguments: [],
    functionArguments: [streamId],
  };
}

// ========================================
// Wallet Token Utilities
// ========================================

export interface WalletToken {
  id: string; // Unique ID (storage_id)
  metadata: string; // Asset type
  name: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  iconUri?: string;
}

// Known legitimate token metadata with fallback info
const KNOWN_TOKENS: Record<string, { name: string; symbol: string; decimals: number; iconUri: string }> = {
  "0x1::aptos_coin::AptosCoin": {
    name: "Aptos Coin",
    symbol: "APT",
    decimals: 8,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/APT.webp"
  },
  "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC": {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDC.svg"
  },
  "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT": {
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDT.svg"
  },
  "0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T": {
    name: "USD Coin (LayerZero)",
    symbol: "USDC",
    decimals: 6,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDC.svg"
  },
  "0xa2eda21a58856fda86451436513b867c97eecb4ba099da5775520e0f7492e852::coin::T": {
    name: "Tether USD (LayerZero)",
    symbol: "USDT",
    decimals: 6,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDT.svg"
  },
  "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt": {
    name: "Amnis Staked Aptos",
    symbol: "stAPT",
    decimals: 8,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/stAPT.svg"
  },
  "0xd11107bdf0d6d7040c6c0bfbdecb6545191fdf13e8d8d259952f53e1713f61b5::staked_coin::StakedAptos": {
    name: "Tortuga Staked Aptos",
    symbol: "tAPT",
    decimals: 8,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/tAPT.svg"
  },
  "0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114::staked_aptos_coin::StakedAptosCoin": {
    name: "Thala Staked APT",
    symbol: "sthAPT",
    decimals: 8,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/sthAPT.webp"
  },
  "0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL": {
    name: "Thala Token",
    symbol: "THL",
    decimals: 8,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/THL.svg"
  },
  "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::mod_coin::MOD": {
    name: "Move Dollar",
    symbol: "MOD",
    decimals: 8,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/MOD.svg"
  },
  "0xc26a8eda1c3ab69a157815183ddda88c89d6758ee491dd1647a70af2907ce074::coin::Cake": {
    name: "PancakeSwap Token",
    symbol: "CAKE",
    decimals: 8,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/CAKE.webp"
  },
};

// Check if a token is legitimate (known token OR has valid name & symbol)
function isLegitimateToken(
  name: string | undefined,
  symbol: string | undefined,
  metadata: string
): boolean {
  // Always allow known tokens
  if (KNOWN_TOKENS[metadata]) {
    return true;
  }

  // Require valid name (not empty or generic)
  if (!name || name === "Unknown Token" || name.trim() === "" || name === "unknown") {
    return false;
  }

  // Require valid symbol (not empty or generic)
  if (!symbol || symbol === "???" || symbol.trim() === "" || symbol === "unknown") {
    return false;
  }

  // Check for spam patterns in name or symbol
  const spamPatterns = [
    /airdrop/i,
    /claim/i,
    /free\s/i,
    /bonus/i,
    /reward/i,
    /\.com/i,
    /\.io$/i,
    /\.xyz/i,
    /\.org/i,
    /\.net/i,
    /visit/i,
    /https?:/i,
    /www\./i,
    /winner/i,
    /gift/i,
    /lucky/i,
    /congratulation/i,
    /telegram/i,
    /discord/i,
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(name) || pattern.test(symbol)) {
      return false;
    }
  }

  return true;
}

export async function getWalletFungibleAssets(walletAddress: string): Promise<WalletToken[]> {
  try {
    const balances = await aptos.getCurrentFungibleAssetBalances({
      ownerAddress: walletAddress,
    });

    console.log("Raw balances from API:", JSON.stringify(balances, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    const tokens: WalletToken[] = [];

    for (const balance of balances) {
      // Log each balance to see the structure
      console.log("Processing balance:", {
        amount: balance.amount,
        asset_type: balance.asset_type,
        metadata: balance.metadata,
      });

      if (balance.amount > 0) {
        const metadata = balance.asset_type || "";
        const knownToken = KNOWN_TOKENS[metadata];

        // Get metadata from API - check different possible property paths
        const apiName = balance.metadata?.name || (balance as any).name;
        const apiSymbol = balance.metadata?.symbol || (balance as any).symbol;
        const apiIconUri = balance.metadata?.icon_uri || balance.metadata?.iconUri || (balance as any).icon_uri;
        const apiDecimals = balance.metadata?.decimals ?? (balance as any).decimals;

        console.log("Token info:", { metadata, apiName, apiSymbol, knownToken: !!knownToken });

        // Check if this is a legitimate token
        if (!isLegitimateToken(apiName, apiSymbol, metadata)) {
          console.log("Filtered out:", { apiName, apiSymbol, metadata });
          continue;
        }

        // Use known token info as fallback for missing metadata
        const name = apiName || knownToken?.name || "Unknown Token";
        const symbol = apiSymbol || knownToken?.symbol || "???";
        const iconUri = apiIconUri || knownToken?.iconUri;
        const decimals = apiDecimals ?? knownToken?.decimals ?? 8;

        tokens.push({
          metadata,
          name,
          symbol,
          decimals,
          balance: BigInt(balance.amount),
          iconUri,
        });
      }
    }

    console.log("Final tokens:", tokens.map(t => ({ name: t.name, symbol: t.symbol, metadata: t.metadata })));

    // Sort tokens: known tokens first, then by balance
    tokens.sort((a, b) => {
      const aKnown = !!KNOWN_TOKENS[a.metadata];
      const bKnown = !!KNOWN_TOKENS[b.metadata];
      if (aKnown && !bKnown) return -1;
      if (!aKnown && bKnown) return 1;
      return Number(b.balance - a.balance);
    });

    return tokens;
  } catch (error) {
    console.error("Failed to fetch wallet tokens:", error);
    return [];
  }
}

// Helper to format balance for display (e.g., 100000000 with 8 decimals -> "1.0")
export function formatTokenBalance(balance: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const intPart = balance / divisor;
  const fracPart = balance % divisor;
  const fracStr = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '');

  if (fracStr === '') {
    return intPart.toLocaleString();
  }
  return `${intPart.toLocaleString()}.${fracStr.slice(0, 6)}`;
}

// Helper to parse human-readable amount to raw amount (e.g., "1.5" with 8 decimals -> 150000000n)
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [intPart, fracPart = ""] = amount.split(".");
  const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
  const rawAmount = intPart + paddedFrac;
  return BigInt(rawAmount);
}
