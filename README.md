# aegis-x402-mcp

> **Model Context Protocol (MCP) server for [AegisAudit](https://aegisaudit.org) — On-Chain Token Security, PreFlight Pre-Swap Bundles, Honeypot Simulation, KYA Wallet Trust & Grounded AI. Works FREE out of the box, with a $1 Credit Card / Apple Pay API Key (no crypto wallet needed), or autonomously over x402 v2 (Base USDC).**

[![npm version](https://img.shields.io/npm/v/aegis-x402-mcp.svg)](https://www.npmjs.com/package/aegis-x402-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Network: Base](https://img.shields.io/badge/Network-Base%20(eip155%3A8453)-0052FF)](https://base.org)
[![x402 Protocol](https://img.shields.io/badge/Protocol-x402%20v2-green)](https://x402.org)
[![Goatincrypto/aegis-x402-mcp MCP server](https://glama.ai/mcp/servers/Goatincrypto/aegis-x402-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Goatincrypto/aegis-x402-mcp)
[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/goatincrypto/aegis-x402-mcp)

`aegis-x402-mcp` connects Claude Desktop, Cursor, Windsurf, and autonomous trading bots directly to **[https://aegisaudit.org](https://aegisaudit.org)** (local `stdio` CLI via `npx -y aegis-x402-mcp` or hosted Streamable HTTP at `https://aegisaudit.org/mcp`). Every paid response includes a third-party verifiable ECDSA `secp256k1` EIP-191 `proofOfExecution` receipt (`/.well-known/poe-key.json`), and upstream failures fail closed (`HTTP 502`, zero charge).

### Start in 30 Seconds (No Crypto Wallet Required)

- **Free Tier (`$0`, zero setup):** Run `npx -y aegis-x402-mcp` right now to call `aegis_token_preview` (live DEX pool, price, liquidity) and `aegis_recent_audits` with no keys or wallet.
- **Pay by Credit Card or Apple Pay (Recommended for Developers):** Grab an instant 30-day API key (**Starter `$1` = 150 credits** or **Pro `$5` = 1,000 credits**) via Stripe at **[https://aegisaudit.org/pay](https://aegisaudit.org/pay)** and set `AEGIS_API_KEY` (or `AEGIS_CREDIT_TOKEN`). No Base wallet or USDC required.
- **Autonomous x402 v2 Agents (Optional):** Set `AEGIS_PRIVATE_KEY` for gasless per-call EIP-3009 USDC settlement on Base Mainnet.

- **Canonical Gateway:** `https://aegisaudit.org`
- **Instant Card / Apple Pay Checkout:** `https://aegisaudit.org/pay`
- **Hosted Streamable HTTP MCP:** `https://aegisaudit.org/mcp`
- **Contact:** `security@aegisaudit.org`

---

## Commercial Security SKUs & MCP Tools (9 Tools)

| Tool Name | Price | Description |
|---|---|---|
| `aegis_preflight_bundle` | **$0.20 USDC** | **Commercial SKU #1 (Flagship Pre-Swap Guard):** Atomic multi-oracle honeypot audit + DEX liquidity depth + AP2 spend mandate + counterparty KYA + ECDSA PoE receipt. |
| `aegis_priority_audit` | **$0.05 USDC** | **Commercial SKU #2:** 100% cache-bypassed, fresh live-oracle scan for sniper bots & new Base pool launches. |
| `aegis_token_audit` | **$0.01 USDC** | **Commercial SKU #3:** Multi-oracle smart contract bytecode inspection (GoPlus, Honeypot.is V2, DexScreener, Base RPC). |
| `aegis_mcp_audit` | **$0.01 USDC** | OWASP MCP03 tool-poisoning, credential exfiltration, stealth Unicode, and SHA-256 TOFU rug-pull drift audit for remote MCP servers or inline manifests. |
| `aegis_wallet_kya` | **$0.01 USDC** | Know-Your-Agent (KYA) counterparty wallet reputation, transaction nonce age, balances, and OFAC/GoPlus sanctions checks. |
| `aegis_web_scrape` | **$0.005 USDC** | Converts any public webpage into clean, token-efficient LLM Markdown and extracted links. |
| `aegis_grounded_chat` | **$0.005 USDC** | OpenAI-compatible grounded LLM inference enriched with live Base/Ethereum on-chain security telemetry. |
| `aegis_token_preview` | **FREE** | Real-time market pool, token price, pair address, and DEX liquidity without payment. |
| `aegis_recent_audits` | **FREE** | Real-time stream of latest verified settled token audits across Base, Ethereum, and Solana. |

---

## Trading Bot & Sniper Guard Examples (`Base Mainnet`)

Drop-in fail-closed pre-swap gates calling `https://aegisaudit.org/api/v1/preflight/bundle` (`$0.20 USDC` over x402 v2) before submitting a swap on Aerodrome or Uniswap:

- TypeScript (`@x402/fetch` + `@x402/evm` + `viem`): [`examples/base-sniper-guard.ts`](examples/base-sniper-guard.ts)
- Python (zero external dependencies): [`examples/base-sniper-guard.py`](examples/base-sniper-guard.py)

Inspect a live sample clearance response with zero payment:
```bash
curl -s https://aegisaudit.org/api/v1/sample/preflight
```

---

## 3-Tier Frictionless Execution Architecture

1. **Tier 1 — Zero-Config (Free Tier):**
   Tools like `aegis_token_preview` and `aegis_recent_audits` work instantly out-of-the-box with zero configuration or keys.

2. **Tier 2 — Prepaid 30-Day API Key Pack (Recommended for Humans — Card, Apple Pay, or Base USDC):**
   Grab an instant 30-day API key (`Starter $1 = 150 credits` or `Pro $5 = 1,000 credits` via Stripe Card/Apple Pay or Base USDC) at [https://aegisaudit.org/pay?sku=pro-key](https://aegisaudit.org/pay?sku=pro-key).
   Add `AEGIS_API_KEY` (or `AEGIS_CREDIT_TOKEN`) in your config. No wallet private key or per-call signing required.

3. **Tier 3 — Autonomous Agentic Wallet (For Autonomous Trading Bots & Power Users):**
   Add `AEGIS_PRIVATE_KEY` in your config.
   The local MCP client signs gasless EIP-3009 micro-settlements on Base Mainnet on-demand inside the MCP process. Keys never leave your machine.
   **Security Allowlist Guard:** The client strictly verifies the recipient and refuses to sign toward any address other than the official Aegis node (`0x111ef680B6EFdd859FbEc473b907aCe95F0D1acB`).

---

## Quick Setup

### Option 1: Claude Desktop

Add this configuration to your `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aegis-security": {
      "command": "npx",
      "args": ["-y", "aegis-x402-mcp"],
      "env": {
        "AEGIS_CREDIT_TOKEN": "<your-prepaid-token-or-leave-empty>"
      }
    }
  }
}
```

### Option 2: Cursor (`.cursor/mcp.json`)

Create or update `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "aegis-security": {
      "command": "npx",
      "args": ["-y", "aegis-x402-mcp"],
      "env": {
        "AEGIS_CREDIT_TOKEN": "<your-prepaid-token>"
      }
    }
  }
}
```

### Option 3: Windsurf / Remote Streamable HTTP

Add to `~/.codeium/windsurf/mcp_config.json` (or connect any Streamable HTTP MCP client to `https://aegisaudit.org/mcp`):

```json
{
  "mcpServers": {
    "aegis-security": {
      "command": "npx",
      "args": ["-y", "aegis-x402-mcp"]
    }
  }
}
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `AEGIS_GATEWAY_URL` | Gateway URL (defaults to `https://aegisaudit.org`). |
| `AEGIS_CREDIT_TOKEN` | 30-day Prepaid API Key or 24h Credit Token from `https://aegisaudit.org/pay?sku=pro-key` (Card/Apple Pay or Base USDC). |
| `AEGIS_PRIVATE_KEY` | Optional local EVM private key (`0x...`) used in-process to sign EIP-3009 USDC authorizations on Base without keys ever leaving your machine. |
| `AEGIS_API_KEY` | Alias for `AEGIS_CREDIT_TOKEN` / prepaid enterprise API key. |
| `X402_PAYMENT_HEADER` | Pre-signed base64 EIP-3009 payment header or authorization token. |

---

## Discovery, Registries & B2B Automation Suite

- **Instant Card / Apple Pay API Keys ($1 Starter / $5 Pro):** [https://aegisaudit.org/pay](https://aegisaudit.org/pay)
- **Canonical Docs & Agent Manifests:** [`aegisaudit.org/AGENTS.md`](https://aegisaudit.org/AGENTS.md) · [`aegisaudit.org/llms-full.txt`](https://aegisaudit.org/llms-full.txt) · [`aegisaudit.org/.well-known/x402.json`](https://aegisaudit.org/.well-known/x402.json)
- **mcpservers.org Listing:** [mcpservers.org/servers/goatincrypto/aegis-x402-mcp](https://mcpservers.org/servers/goatincrypto/aegis-x402-mcp)
- **Official MCP Registry:** [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) (`io.github.Goatincrypto/aegis-x402-mcp`)
- **Glama Quality Score (`A / A / B`):** [glama.ai/mcp/servers/Goatincrypto/aegis-x402-mcp](https://glama.ai/mcp/servers/Goatincrypto/aegis-x402-mcp)
- **NPM:** [https://www.npmjs.com/package/aegis-x402-mcp](https://www.npmjs.com/package/aegis-x402-mcp)
- **GitHub:** [https://github.com/Goatincrypto/aegis-x402-mcp](https://github.com/Goatincrypto/aegis-x402-mcp)
- **AegisAudit Apify B2B Actors & Free n8n/Make/Clay Workflows:** [apify.com/aegisaudit](https://apify.com/aegisaudit) · [aegisaudit.org/guides](https://aegisaudit.org/guides)
- **Security Contact:** `security@aegisaudit.org`

---

## License

MIT © 2026 Antigravity Autonomous Systems
