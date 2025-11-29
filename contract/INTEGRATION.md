# Lilipad Integration Guide

Complete guide for integrating Lilipad into your application.

## Deployment Information

- **Network**: Aptos Testnet
- **Module Address**: `0xab61f8c2bb9227d6d3a6c7571f791fa35ae3c5b8a7e1ac02a828330beb219d07`
- **Module Name**: `lilipad::lilipad`
- **Transaction Hash**: `0x9915379597673db179526d24762e38ec144881aa4f762e11a2aee9917aba4839`
- **Explorer**: [View on Aptos Explorer](https://explorer.aptoslabs.com/account/0xab61f8c2bb9227d6d3a6c7571f791fa35ae3c5b8a7e1ac02a828330beb219d07?network=testnet)

## Quick Start

```typescript
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const MODULE_ADDRESS = "0xab61f8c2bb9227d6d3a6c7571f791fa35ae3c5b8a7e1ac02a828330beb219d07";
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Get a sale's details (no wallet needed)
const sale = await aptos.view({
  payload: {
    function: `${MODULE_ADDRESS}::lilipad::get_sale`,
    functionArguments: [0], // sale ID
  },
});
console.log("Sale info:", sale);

// Buy tokens (requires wallet)
const transaction = await aptos.transaction.build.simple({
  sender: account.address,
  data: {
    function: `${MODULE_ADDRESS}::lilipad::buy`,
    functionArguments: [0, 100_000_000], // sale ID, 1 APT in octas
  },
});
const result = await aptos.signAndSubmitTransaction({ signer: account, transaction });
console.log("Purchase successful:", result.hash);
```

## Table of Contents

- [Quick Start](#quick-start)
- [Deployment Information](#deployment-information)
- [Frontend Integration](#frontend-integration)
- [Wallet Integration](#wallet-integration)
- [Smart Contract Integration](#smart-contract-integration)
- [Event Indexing](#event-indexing)
- [Backend Integration](#backend-integration)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Frontend Integration

### Setup

#### Install Dependencies

```bash
npm install @aptos-labs/ts-sdk
# or
yarn add @aptos-labs/ts-sdk
# or with bun
bun add @aptos-labs/ts-sdk
```

#### Initialize Aptos Client

```typescript
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// Testnet configuration
const config = new AptosConfig({
  network: Network.TESTNET
});
const aptos = new Aptos(config);

// Mainnet configuration
const mainnetConfig = new AptosConfig({
  network: Network.MAINNET
});
const mainnetAptos = new Aptos(mainnetConfig);

// Custom RPC endpoint
const customConfig = new AptosConfig({
  fullnode: "https://your-custom-node.com",
  indexer: "https://your-custom-indexer.com",
});
const customAptos = new Aptos(customConfig);
```

### Configuration

```typescript
// config.ts
export const LILIPAD_CONFIG = {
  // Deployed module address on Aptos Testnet
  MODULE_ADDRESS: "0xab61f8c2bb9227d6d3a6c7571f791fa35ae3c5b8a7e1ac02a828330beb219d07",

  // Network configuration
  NETWORK: Network.TESTNET,

  // Constants from contract
  PRECISION: 1_000_000_000n, // 1e9

  // Gas settings
  MAX_GAS_AMOUNT: 10000,
  GAS_UNIT_PRICE: 100,
} as const;

export const getModuleId = (functionName: string) =>
  `${LILIPAD_CONFIG.MODULE_ADDRESS}::lilipad::${functionName}`;
```

### Core Functions

#### 1. Register Project

```typescript
async function registerProject(
  aptos: Aptos,
  account: Account,
  name: string,
  tokenAddress: string
): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: getModuleId("register_project"),
      typeArguments: [],
      functionArguments: [name, tokenAddress],
    },
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  const executedTransaction = await aptos.waitForTransaction({
    transactionHash: committedTxn.hash,
  });

  console.log("Project registered:", executedTransaction.hash);
  return committedTxn.hash;
}

// Usage
const txHash = await registerProject(
  aptos,
  account,
  "My DeFi Token",
  "0x1::aptos_coin::AptosCoin"
);
```

#### 2. Create Sale

```typescript
interface CreateSaleParams {
  projectId: number;
  tokenAddress: string;
  totalTokens: bigint;
  pricePerToken: bigint;
  startTimestamp: number;
  endTimestamp: number;
  vestingDuration: number;
}

async function createSale(
  aptos: Aptos,
  account: Account,
  params: CreateSaleParams
): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: getModuleId("create_sale"),
      typeArguments: [],
      functionArguments: [
        params.projectId,
        params.tokenAddress,
        params.totalTokens,
        params.pricePerToken,
        params.startTimestamp,
        params.endTimestamp,
        params.vestingDuration,
      ],
    },
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  await aptos.waitForTransaction({
    transactionHash: committedTxn.hash,
  });

  return committedTxn.hash;
}

// Helper: Calculate price
function calculatePrice(aptPerToken: number): bigint {
  return BigInt(Math.floor(aptPerToken * Number(LILIPAD_CONFIG.PRECISION)));
}

// Usage
const now = Math.floor(Date.now() / 1000);
const txHash = await createSale(aptos, account, {
  projectId: 0,
  tokenAddress: "0x1::aptos_coin::AptosCoin",
  totalTokens: 1_000_000n,
  pricePerToken: calculatePrice(0.001), // 0.001 APT per token
  startTimestamp: now + 300, // starts in 5 minutes
  endTimestamp: now + 86400, // ends in 24 hours
  vestingDuration: 300, // 5 minute vesting
});
```

#### 3. Buy Tokens

```typescript
async function buyTokens(
  aptos: Aptos,
  account: Account,
  saleId: number,
  aptAmount: number // in APT (will be converted to octas)
): Promise<string> {
  const octasAmount = aptAmount * 100_000_000; // Convert APT to octas

  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: getModuleId("buy"),
      typeArguments: [],
      functionArguments: [saleId, octasAmount],
    },
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  await aptos.waitForTransaction({
    transactionHash: committedTxn.hash,
  });

  return committedTxn.hash;
}

// Usage
const txHash = await buyTokens(aptos, account, 0, 10); // Buy with 10 APT
```

#### 4. Claim Vested Tokens

```typescript
async function claimVestedTokens(
  aptos: Aptos,
  account: Account,
  streamId: number
): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: getModuleId("claim"),
      typeArguments: [],
      functionArguments: [streamId],
    },
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  await aptos.waitForTransaction({
    transactionHash: committedTxn.hash,
  });

  return committedTxn.hash;
}

// Usage
const txHash = await claimVestedTokens(aptos, account, 0);
```

#### 5. Withdraw Sale Proceeds

```typescript
async function withdrawProceeds(
  aptos: Aptos,
  account: Account,
  saleId: number,
  recipientAddress: string
): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: getModuleId("withdraw_proceeds"),
      typeArguments: [],
      functionArguments: [saleId, recipientAddress],
    },
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  await aptos.waitForTransaction({
    transactionHash: committedTxn.hash,
  });

  return committedTxn.hash;
}

// Usage
const txHash = await withdrawProceeds(
  aptos,
  account,
  0,
  account.accountAddress.toString()
);
```

### View Functions (Queries)

#### Get Project Details

```typescript
interface Project {
  id: number;
  owner: string;
  name: string;
  token: string;
  created_at: number;
}

async function getProject(
  aptos: Aptos,
  projectId: number
): Promise<Project> {
  const [result] = await aptos.view({
    payload: {
      function: getModuleId("get_project"),
      typeArguments: [],
      functionArguments: [projectId],
    },
  });

  return result as Project;
}

// Usage
const project = await getProject(aptos, 0);
console.log("Project name:", project.name);
console.log("Owner:", project.owner);
```

#### Get Sale Details

```typescript
interface Sale {
  id: number;
  project_id: number;
  owner: string;
  token: string;
  total_tokens: bigint;
  tokens_sold: bigint;
  price_per_token: bigint;
  start_ts: number;
  end_ts: number;
  raised_apt: bigint;
  active: boolean;
}

async function getSale(
  aptos: Aptos,
  saleId: number
): Promise<Sale> {
  const result = await aptos.view({
    payload: {
      function: getModuleId("get_sale"),
      typeArguments: [],
      functionArguments: [saleId],
    },
  });

  // Result is a tuple, destructure it
  const [id, project_id, owner, token, total_tokens, tokens_sold,
         price_per_token, start_ts, end_ts, raised_apt, active] = result;

  return {
    id: Number(id),
    project_id: Number(project_id),
    owner: owner as string,
    token: token as string,
    total_tokens: BigInt(total_tokens as string),
    tokens_sold: BigInt(tokens_sold as string),
    price_per_token: BigInt(price_per_token as string),
    start_ts: Number(start_ts),
    end_ts: Number(end_ts),
    raised_apt: BigInt(raised_apt as string),
    active: active as boolean,
  };
}

// Usage
const sale = await getSale(aptos, 0);
console.log("Tokens remaining:", sale.total_tokens - sale.tokens_sold);
console.log("Sale active:", sale.active);
console.log("Raised APT:", Number(sale.raised_apt) / 100_000_000);
```

#### Get Claimable Amount

```typescript
async function getClaimableAmount(
  aptos: Aptos,
  streamId: number
): Promise<bigint> {
  const [amount] = await aptos.view({
    payload: {
      function: getModuleId("get_claimable"),
      typeArguments: [],
      functionArguments: [streamId],
    },
  });

  return BigInt(amount as string);
}

// Usage
const claimable = await getClaimableAmount(aptos, 0);
console.log("Claimable tokens:", Number(claimable));

// Check if worth claiming (consider gas costs)
if (claimable > 0n) {
  await claimVestedTokens(aptos, account, 0);
}
```

#### Get Stream Details

```typescript
interface Stream {
  id: number;
  sale_id: number;
  beneficiary: string;
  token: string;
  total_amount: bigint;
  start_ts: number;
  end_ts: number;
  claimed: bigint;
}

async function getStream(
  aptos: Aptos,
  streamId: number
): Promise<Stream> {
  const [result] = await aptos.view({
    payload: {
      function: getModuleId("get_stream"),
      typeArguments: [],
      functionArguments: [streamId],
    },
  });

  return result as Stream;
}

// Calculate vesting progress
async function getVestingProgress(
  aptos: Aptos,
  streamId: number
): Promise<number> {
  const stream = await getStream(aptos, streamId);
  const now = Math.floor(Date.now() / 1000);

  if (now <= stream.start_ts) return 0;
  if (now >= stream.end_ts) return 100;

  const elapsed = now - stream.start_ts;
  const duration = stream.end_ts - stream.start_ts;
  return (elapsed / duration) * 100;
}

// Usage
const progress = await getVestingProgress(aptos, 0);
console.log(`Vesting ${progress.toFixed(2)}% complete`);
```

## Wallet Integration

### Petra Wallet Integration

```typescript
// Install: npm install petra-plugin-wallet-adapter
import { PetraWallet } from "petra-plugin-wallet-adapter";

const wallet = new PetraWallet();

// Connect wallet
async function connectPetra(): Promise<string> {
  try {
    const response = await wallet.connect();
    console.log("Connected to Petra:", response.address);
    return response.address;
  } catch (error) {
    console.error("Failed to connect:", error);
    throw error;
  }
}

// Sign and submit transaction
async function buyWithPetra(
  saleId: number,
  aptAmount: number
): Promise<string> {
  const payload = {
    type: "entry_function_payload",
    function: getModuleId("buy"),
    type_arguments: [],
    arguments: [saleId, aptAmount * 100_000_000],
  };

  const response = await wallet.signAndSubmitTransaction(payload);
  return response.hash;
}
```

### Martian Wallet Integration

```typescript
// Check if Martian is installed
const isMartianInstalled = () => {
  return typeof window !== "undefined" && "martian" in window;
};

// Connect to Martian
async function connectMartian(): Promise<string> {
  if (!isMartianInstalled()) {
    throw new Error("Martian wallet is not installed");
  }

  const response = await (window as any).martian.connect();
  return response.address;
}

// Sign and submit with Martian
async function buyWithMartian(
  saleId: number,
  aptAmount: number
): Promise<string> {
  const payload = {
    type: "entry_function_payload",
    function: getModuleId("buy"),
    type_arguments: [],
    arguments: [saleId.toString(), (aptAmount * 100_000_000).toString()],
  };

  const response = await (window as any).martian.signAndSubmitTransaction(
    payload
  );

  return response.hash;
}
```

### Unified Wallet Adapter

```typescript
interface WalletAdapter {
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  signAndSubmit(payload: any): Promise<string>;
}

class UnifiedWalletAdapter {
  private wallet: "petra" | "martian" | null = null;

  async connect(walletType: "petra" | "martian"): Promise<string> {
    this.wallet = walletType;

    if (walletType === "petra") {
      return connectPetra();
    } else {
      return connectMartian();
    }
  }

  async buyTokens(saleId: number, aptAmount: number): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }

    if (this.wallet === "petra") {
      return buyWithPetra(saleId, aptAmount);
    } else {
      return buyWithMartian(saleId, aptAmount);
    }
  }
}

// Usage
const walletAdapter = new UnifiedWalletAdapter();
await walletAdapter.connect("petra");
const txHash = await walletAdapter.buyTokens(0, 10);
```

## Smart Contract Integration

### Calling Lilipad from Another Move Module

```move
module my_protocol::integration {
    use lilipad::lilipad;
    use std::signer;

    /// Buy tokens from Lilipad sale on behalf of a user
    public entry fun buy_for_user(
        buyer: &signer,
        sale_id: u64,
        apt_amount: u64,
    ) {
        // Perform any pre-checks
        // ...

        // Call Lilipad buy function
        lilipad::buy(buyer, sale_id, apt_amount);

        // Perform any post-processing
        // ...
    }

    /// Claim vested tokens and perform additional logic
    public entry fun claim_and_stake(
        user: &signer,
        stream_id: u64,
    ) {
        // Claim from Lilipad
        lilipad::claim(user, stream_id);

        // Stake the claimed tokens
        // stake_tokens(user, ...);
    }
}
```

### Reading Lilipad State

```move
module my_protocol::reader {
    use lilipad::lilipad;

    #[view]
    public fun get_sale_status(sale_id: u64): (bool, u128, u128) {
        let (_, _, _, _, total_tokens, tokens_sold, _, _, _, _, active) =
            lilipad::get_sale(sale_id);

        (active, total_tokens, tokens_sold)
    }

    #[view]
    public fun get_user_claimable(stream_id: u64): u128 {
        lilipad::get_claimable(stream_id)
    }
}
```

## Event Indexing

### Listen to Events (TypeScript)

```typescript
interface ProjectRegisteredEvent {
  project_id: number;
  owner: string;
  token: string;
  name: string;
}

interface SaleCreatedEvent {
  sale_id: number;
  project_id: number;
  owner: string;
  token: string;
  total_tokens: bigint;
  price_per_token: bigint;
  start_ts: number;
  end_ts: number;
}

interface BoughtEvent {
  sale_id: number;
  buyer: string;
  tokens_bought: bigint;
  apt_spent: bigint;
  stream_id: number;
}

// Query events using Aptos indexer
async function getProjectRegisteredEvents(
  aptos: Aptos,
  startSequenceNumber?: number
): Promise<ProjectRegisteredEvent[]> {
  const events = await aptos.getModuleEventsByEventType({
    eventType: `${LILIPAD_CONFIG.MODULE_ADDRESS}::lilipad::ProjectRegistered`,
    minimumLedgerVersion: startSequenceNumber,
  });

  return events.map((event) => event.data as ProjectRegisteredEvent);
}

async function getSaleCreatedEvents(
  aptos: Aptos
): Promise<SaleCreatedEvent[]> {
  const events = await aptos.getModuleEventsByEventType({
    eventType: `${LILIPAD_CONFIG.MODULE_ADDRESS}::lilipad::SaleCreated`,
  });

  return events.map((event) => event.data as SaleCreatedEvent);
}

async function getBoughtEvents(
  aptos: Aptos,
  saleId?: number
): Promise<BoughtEvent[]> {
  const events = await aptos.getModuleEventsByEventType({
    eventType: `${LILIPAD_CONFIG.MODULE_ADDRESS}::lilipad::Bought`,
  });

  let boughtEvents = events.map((event) => event.data as BoughtEvent);

  // Filter by sale_id if provided
  if (saleId !== undefined) {
    boughtEvents = boughtEvents.filter((event) => event.sale_id === saleId);
  }

  return boughtEvents;
}

// Usage
const sales = await getSaleCreatedEvents(aptos);
console.log("Total sales created:", sales.length);

const purchases = await getBoughtEvents(aptos, 0);
console.log("Total purchases for sale 0:", purchases.length);
```

### Real-time Event Monitoring

```typescript
// Poll for new events periodically
class EventMonitor {
  private lastVersion: number = 0;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private aptos: Aptos,
    private eventType: string,
    private callback: (event: any) => void
  ) {}

  start(intervalMs: number = 5000) {
    this.interval = setInterval(async () => {
      try {
        const events = await this.aptos.getModuleEventsByEventType({
          eventType: this.eventType,
          minimumLedgerVersion: this.lastVersion,
        });

        for (const event of events) {
          this.callback(event.data);
          this.lastVersion = Math.max(
            this.lastVersion,
            parseInt(event.version)
          );
        }
      } catch (error) {
        console.error("Error polling events:", error);
      }
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Usage
const monitor = new EventMonitor(
  aptos,
  `${LILIPAD_CONFIG.MODULE_ADDRESS}::lilipad::Bought`,
  (event: BoughtEvent) => {
    console.log("New purchase!");
    console.log("Buyer:", event.buyer);
    console.log("Tokens:", event.tokens_bought);
    console.log("Stream ID:", event.stream_id);
  }
);

monitor.start(3000); // Poll every 3 seconds

// Stop monitoring when done
// monitor.stop();
```

## Backend Integration

### Express.js API Example

```typescript
import express from "express";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const app = express();
app.use(express.json());

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Get sale details
app.get("/api/sales/:id", async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const sale = await getSale(aptos, saleId);

    res.json({
      success: true,
      data: {
        id: sale.id,
        active: sale.active,
        totalTokens: sale.total_tokens.toString(),
        tokensSold: sale.tokens_sold.toString(),
        tokensRemaining: (sale.total_tokens - sale.tokens_sold).toString(),
        pricePerToken: sale.price_per_token.toString(),
        raisedAPT: (Number(sale.raised_apt) / 100_000_000).toString(),
        startTime: new Date(sale.start_ts * 1000).toISOString(),
        endTime: new Date(sale.end_ts * 1000).toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get user streams
app.get("/api/users/:address/streams", async (req, res) => {
  try {
    const userAddress = req.params.address;

    // Query events to find user's streams
    const boughtEvents = await aptos.getModuleEventsByEventType({
      eventType: `${LILIPAD_CONFIG.MODULE_ADDRESS}::lilipad::Bought`,
    });

    const userStreams = boughtEvents
      .filter((event: any) => event.data.buyer === userAddress)
      .map((event: any) => ({
        streamId: event.data.stream_id,
        saleId: event.data.sale_id,
        tokensBought: event.data.tokens_bought.toString(),
        aptSpent: (Number(event.data.apt_spent) / 100_000_000).toString(),
      }));

    res.json({
      success: true,
      data: userStreams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get claimable amount
app.get("/api/streams/:id/claimable", async (req, res) => {
  try {
    const streamId = parseInt(req.params.id);
    const claimable = await getClaimableAmount(aptos, streamId);

    res.json({
      success: true,
      data: {
        streamId,
        claimableTokens: claimable.toString(),
        claimableFormatted: Number(claimable).toLocaleString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log("Lilipad API server running on port 3000");
});
```

## Common Patterns

### Sale Dashboard Component (React)

```typescript
import { useEffect, useState } from "react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

interface SaleDashboardProps {
  saleId: number;
}

export function SaleDashboard({ saleId }: SaleDashboardProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

    async function loadSale() {
      try {
        const saleData = await getSale(aptos, saleId);
        setSale(saleData);
      } catch (error) {
        console.error("Failed to load sale:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSale();

    // Refresh every 10 seconds
    const interval = setInterval(loadSale, 10000);
    return () => clearInterval(interval);
  }, [saleId]);

  if (loading) return <div>Loading...</div>;
  if (!sale) return <div>Sale not found</div>;

  const tokensRemaining = sale.total_tokens - sale.tokens_sold;
  const percentageSold = Number(
    (sale.tokens_sold * 100n) / sale.total_tokens
  );
  const now = Math.floor(Date.now() / 1000);
  const isActive = sale.active && now >= sale.start_ts && now <= sale.end_ts;

  return (
    <div className="sale-dashboard">
      <h2>Sale #{sale.id}</h2>
      <div className="status">
        <span className={isActive ? "active" : "inactive"}>
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="stats">
        <div>Total Tokens: {sale.total_tokens.toString()}</div>
        <div>Tokens Sold: {sale.tokens_sold.toString()}</div>
        <div>Remaining: {tokensRemaining.toString()}</div>
        <div>Progress: {percentageSold.toFixed(2)}%</div>
        <div>
          Raised: {(Number(sale.raised_apt) / 100_000_000).toFixed(4)} APT
        </div>
        <div>
          Price: {(Number(sale.price_per_token) / 1_000_000_000).toFixed(6)}{" "}
          APT/token
        </div>
      </div>
      <div className="timeline">
        <div>Start: {new Date(sale.start_ts * 1000).toLocaleString()}</div>
        <div>End: {new Date(sale.end_ts * 1000).toLocaleString()}</div>
      </div>
    </div>
  );
}
```

### Vesting Claim Component

```typescript
import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

interface VestingClaimProps {
  streamId: number;
}

export function VestingClaim({ streamId }: VestingClaimProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [claimable, setClaimable] = useState<bigint>(0n);

  async function checkClaimable() {
    const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
    const amount = await getClaimableAmount(aptos, streamId);
    setClaimable(amount);
  }

  async function handleClaim() {
    if (!account) return;

    setClaiming(true);
    try {
      const payload = {
        type: "entry_function_payload",
        function: getModuleId("claim"),
        type_arguments: [],
        arguments: [streamId],
      };

      const response = await signAndSubmitTransaction(payload);
      console.log("Claimed successfully:", response.hash);

      // Refresh claimable amount
      await checkClaimable();
    } catch (error) {
      console.error("Claim failed:", error);
    } finally {
      setClaiming(false);
    }
  }

  useEffect(() => {
    checkClaimable();
    const interval = setInterval(checkClaimable, 5000);
    return () => clearInterval(interval);
  }, [streamId]);

  return (
    <div className="vesting-claim">
      <h3>Stream #{streamId}</h3>
      <div className="claimable">
        <p>Claimable: {claimable.toString()} tokens</p>
      </div>
      <button
        onClick={handleClaim}
        disabled={claiming || claimable === 0n}
      >
        {claiming ? "Claiming..." : "Claim Tokens"}
      </button>
    </div>
  );
}
```

## Troubleshooting

### Common Issues

#### 1. Transaction Simulation Failed

```typescript
// Add better error handling
try {
  const txn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });
} catch (error: any) {
  if (error.message.includes("INSUFFICIENT_BALANCE")) {
    console.error("Insufficient balance for gas fees");
  } else if (error.message.includes("E_SALE_NOT_ACTIVE")) {
    console.error("Sale is not active");
  } else {
    console.error("Transaction failed:", error.message);
  }
}
```

#### 2. BigInt Serialization

```typescript
// JSON doesn't support BigInt by default
const sale = await getSale(aptos, 0);

// Convert BigInt to string for JSON
const serializable = {
  ...sale,
  total_tokens: sale.total_tokens.toString(),
  tokens_sold: sale.tokens_sold.toString(),
  price_per_token: sale.price_per_token.toString(),
  raised_apt: sale.raised_apt.toString(),
};

JSON.stringify(serializable); // Works!
```

#### 3. Type Argument Handling

```typescript
// Some functions may require type arguments in the future
const transaction = await aptos.transaction.build.simple({
  sender: account.accountAddress,
  data: {
    function: getModuleId("some_function"),
    typeArguments: ["0x1::aptos_coin::AptosCoin"], // Add type args if needed
    functionArguments: [arg1, arg2],
  },
});
```

## Resources

- [Aptos TypeScript SDK Docs](https://aptos.dev/sdks/ts-sdk)
- [Petra Wallet Adapter](https://petra.app/docs/developers)
- [Aptos Indexer GraphQL](https://cloud.hasura.io/public/graphiql?endpoint=https://indexer.mainnet.aptoslabs.com/v1/graphql)
- [Move Language Book](https://move-language.github.io/move/)

## Support

For integration help:
1. Check error messages carefully
2. Verify module address configuration
3. Test on devnet first
4. Review transaction simulation errors
5. Check wallet connection status

---

**Happy Integrating!** 🚀
