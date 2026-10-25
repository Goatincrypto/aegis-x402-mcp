# aegis-x402-mcp

> **Model Context Protocol (MCP) server for AegisAudit — Autonomous On-Chain Token Security, PreFlight Bundles, KYA Reputation, and Grounded AI over the x402 Protocol on Base Mainnet.**

[![npm version](https://img.shields.io/npm/v/aegis-x402-mcp.svg)](https://www.npmjs.com/package/aegis-x402-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Network: Base](https://img.shields.io/badge/Network-Base%20(eip155%3A8453)-0052FF)](https://base.org)
[![x402 Protocol](https://img.shields.io/badge/Protocol-x402%20v2-green)](https://x402.org)

`aegis-x402-mcp` connects Claude Desktop, Cursor, Windsurf, and custom AI agents directly to the live Aegis autonomous node. It enables AI coding assistants and trading bots to verify smart contracts, test honeypot traps, assess DEX liquidity, and check wallet counterparty risk before deploying or trading capital.

---

## Tools Exposed

| Tool Name | Price | Description |
|---|---|---|
| `aegis_preflight_bundle` | **$0.20 USDC** | **Killer Endpoint #1:** All-in-one pre-trade clearance: multi-oracle honeypot audit, DEX liquidity depth, counterparty KYA, and AP2 spend mandate limits with a signed Proof-of-Execution. |
| `aegis_priority_audit` | **$0.05 USDC** | 100% fresh, un-cached multi-oracle token security audit bypassing the 60s cache with prioritized live execution for sniper bots. |
| `aegis_token_audit` | **$0.01 USDC** | Multi-oracle smart contract bytecode inspection (GoPlus, Honeypot.is, DexScreener, Base RPC). |
| `aegis_token_preview` | **FREE** | Real-time market pool, token price, pair address, and DEX liquidity without payment. |
| `aegis_wallet_kya` | **$0.01 USDC** | Know-Your-Agent (KYA) counterparty wallet reputation, transaction nonce history, balances, and sanctions checks. |
| `aegis_web_scrape` | **$0.005 USDC** | Converts any public webpage into clean, token-efficient LLM Markdown and extracted links. |
| `aegis_recent_audits` | **FREE** | Real-time stream of latest analyzed tokens across Base, Ethereum, and Solana. |

---

## Quick Setup

## 3-Tier Frictionless Execution Architecture

1. **Tier 1 — Zero-Config (Free Tier):**
   Tools like `aegis_token_preview` and `aegis_recent_audits` work instantly out-of-the-box with zero configuration or keys.

2. **Tier 2 — Prepaid Credit Token (Recommended for Humans):**
   Top up in 1-click at [https://aegis-audit-x402.project-easy-x.workers.dev/pay](https://aegis-audit-x402.project-easy-x.workers.dev/pay) to get a credit token `ck_...`.
   Add `AEGIS_CREDIT_TOKEN` in your config. No wallet, no signing, zero friction.

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
        "AEGIS_CREDIT_TOKEN": "ck_your_credit_token_or_leave_empty_for_free_tier"
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
        "AEGIS_CREDIT_TOKEN": "ck_your_credit_token"
      }
    }
  }
}
```

### Option 3: Windsurf / Codeium

Add to `~/.codeium/windsurf/mcp_config.json`:

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
| `AEGIS_GATEWAY_URL` | Gateway URL (defaults to `https://aegis-audit-x402.project-easy-x.workers.dev`). |
| `AEGIS_API_KEY` | Optional developer API key to bypass per-call x402 signing. |
| `X402_PAYMENT_HEADER` | Pre-signed EIP-3009 payment header or authorization token. |

---

## Publishing & Registry Registration

### Official Model Context Protocol Registry
Published on the official MCP Registry: [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) via `mcp-publisher`.

### Community Registries & Discovery
- **NPM:** [https://www.npmjs.com/package/aegis-x402-mcp](https://www.npmjs.com/package/aegis-x402-mcp)
- **GitHub:** [https://github.com/Goatincrypto/aegis-x402-mcp](https://github.com/Goatincrypto/aegis-x402-mcp)
- **Glama:** [glama.ai/mcp/servers](https://glama.ai/mcp/servers)
- **PulseMCP:** [pulsemcp.com](https://pulsemcp.com)
- **Smithery:** `npx -y @smithery/cli install aegis-x402-mcp`

---

## License

MIT © 2026 Antigravity Autonomous Systems
