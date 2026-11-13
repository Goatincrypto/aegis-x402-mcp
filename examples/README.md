# Base Sniper & Trading Bot Examples (`$0.20 USDC` PreFlight Gate)

Fail-closed pre-swap guardrails calling `https://aegisaudit.org/api/v1/preflight/bundle` (`$0.20 USDC` via x402 v2 or 24h `AEGIS_CREDIT_TOKEN` from `https://aegisaudit.org/pay`) before routing swaps on Aerodrome or Uniswap on Base Mainnet:

- [`base-sniper-guard.ts`](base-sniper-guard.ts) — Autonomous EIP-3009 x402 client (`@x402/fetch` + `@x402/evm` + `viem`)
- [`base-sniper-guard.py`](base-sniper-guard.py) — Zero-dependency Python gate (`AEGIS_CREDIT_TOKEN` or x402 `PAYMENT-SIGNATURE`)

Every settled clearance response returns an asymmetric ECDSA EIP-191 `proofOfExecution` signature verifiable without shared secrets against `https://aegisaudit.org/.well-known/poe-key.json`.
