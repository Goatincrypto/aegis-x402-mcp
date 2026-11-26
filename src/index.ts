#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { privateKeyToAccount } from 'viem/accounts';
import { getAddress } from 'viem';
import { randomBytes } from 'crypto';

const GATEWAY_URL = process.env.AEGIS_GATEWAY_URL || 'https://aegisaudit.org';
const API_KEY = process.env.AEGIS_API_KEY || process.env.AEGIS_CREDIT_TOKEN || '';
const PRIVATE_KEY = process.env.AEGIS_PRIVATE_KEY || '';
const PAYMENT_HEADER = process.env.X402_PAYMENT_HEADER || '';

export const ALLOWED_PAYTO = '0x111ef680B6EFdd859FbEc473b907aCe95F0D1acB'.toLowerCase();
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
export const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'.toLowerCase();
const REQUEST_TIMEOUT_MS = 15000;

export function parseChainIdFromNetwork(network?: string): number {
  const raw = String(network || '').trim().toLowerCase();
  if (raw === 'base') return 8453;
  if (raw === 'base-sepolia') return 84532;
  const match = raw.match(/^eip155:(\d+)$/);
  return match ? Number(match[1]) : 8453;
}

export function decodePaymentRequiredFromResponse(res: Response, bodyJson: any): any {
  const header = res.headers.get('payment-required') || res.headers.get('PAYMENT-REQUIRED');
  if (header && header.trim().length > 0) {
    try {
      const normalized = header.trim().replace(/-/g, '+').replace(/_/g, '/');
      const padMod = normalized.length % 4;
      const padded = padMod === 2 ? `${normalized}==` : padMod === 3 ? `${normalized}=` : normalized;
      const decoded = Buffer.from(padded, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // fall back to response JSON body
    }
  }
  return bodyJson && typeof bodyJson === 'object' ? bodyJson : {};
}

export function selectSupportedAccept(paymentReq: any): any {
  const list = Array.isArray(paymentReq?.accepts) ? paymentReq.accepts : [];
  const isEvmUsdcCandidate = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    const scheme = String(item.scheme || '').toLowerCase();
    if (scheme !== 'exact') return false;
    const net = String(item.network || '').toLowerCase();
    const validNet = net === 'eip155:8453' || net === 'eip155:84532' || net === 'base' || net === 'base-sepolia';
    if (!validNet) return false;
    const assetCandidate = String(item.assetAddress || item.asset || '').trim();
    const isZeroX = /^0x[a-fA-F0-9]{40}$/.test(assetCandidate);
    const isUsdcAlias = String(item.asset || '').toUpperCase() === 'USDC' && (!item.assetAddress || /^0x[a-fA-F0-9]{40}$/.test(String(item.assetAddress)));
    return isZeroX || isUsdcAlias;
  };
  return list.find(isEvmUsdcCandidate) || null;
}

/**
 * Signs EIP-3009 TransferWithAuthorization locally inside the user's MCP process.
 * Keys never leave the local machine.
 * Protected by strict recipient allowlist guard: only signs toward official Aegis address.
 */
export async function signEip3009Payment(privateKeyHex: string, accepts: any, resource?: any): Promise<string> {
  const cleanKey = privateKeyHex.trim().startsWith('0x')
    ? (privateKeyHex.trim() as `0x${string}`)
    : (`0x${privateKeyHex.trim()}` as `0x${string}`);
  const account = privateKeyToAccount(cleanKey);

  const recipient = String(accepts?.payTo || accepts?.recipient || '').toLowerCase();
  if (recipient !== ALLOWED_PAYTO) {
    throw new Error(`SECURITY_RECIPIENT_GUARD: Recipient ${recipient} is not official Aegis receiver (${ALLOWED_PAYTO}). Signing refused.`);
  }

  const nonce = `0x${randomBytes(32).toString('hex')}` as `0x${string}`;
  const validAfterStr = '0';
  const maxTimeout = typeof accepts?.maxTimeoutSeconds === 'number' ? accepts.maxTimeoutSeconds : 300;
  const validBeforeStr = String(Math.floor(Date.now() / 1000) + maxTimeout);
  const valueStr = String(accepts?.amount || accepts?.maxAmountRequired || '10000');

  const rawAsset = accepts?.assetAddress || accepts?.asset;
  const chainId = parseChainIdFromNetwork(accepts?.network);
  const fallbackAsset = chainId === 84532 ? BASE_SEPOLIA_USDC : BASE_USDC;
  const resolvedAssetRaw =
    typeof rawAsset === 'string' && /^0x[a-fA-F0-9]{40}$/.test(rawAsset.trim())
      ? rawAsset.trim()
      : !rawAsset || String(rawAsset).toUpperCase() === 'USDC'
      ? fallbackAsset
      : '';
  if (!resolvedAssetRaw) {
    throw new Error(`UNSUPPORTED_PAYMENT_ASSET: Expected EVM USDC address, got "${String(rawAsset)}".`);
  }

  const fromChecksum = getAddress(account.address);
  const toChecksum = getAddress(accepts.payTo || accepts.recipient);
  const assetChecksum = getAddress(resolvedAssetRaw);

  const domain = {
    name: accepts.extra?.name || 'USD Coin',
    version: accepts.extra?.version || '2',
    chainId,
    verifyingContract: assetChecksum,
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: fromChecksum,
      to: toChecksum,
      value: BigInt(valueStr),
      validAfter: BigInt(validAfterStr),
      validBefore: BigInt(validBeforeStr),
      nonce,
    },
  });

  const authorization = {
    from: fromChecksum,
    to: toChecksum,
    value: valueStr,
    validAfter: validAfterStr,
    validBefore: validBeforeStr,
    nonce,
  };

  const paymentPayload: Record<string, any> = {
    x402Version: 2,
    payload: {
      authorization,
      signature,
    },
    accepted: accepts,
  };
  if (resource) {
    paymentPayload.resource = resource;
  }

  return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
}

/**
 * 3-Tier Execution Pipeline:
 * Tier 1: Zero-config free tools execute immediately.
 * Tier 2: Prepaid credit token (AEGIS_CREDIT_TOKEN / AEGIS_API_KEY) in env.
 * Tier 3: Local wallet signing (AEGIS_PRIVATE_KEY) in env -> signs 402 challenge and retries seamlessly.
 */
export async function fetchFromAegis(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${GATEWAY_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }
  if (PAYMENT_HEADER) {
    headers['X-PAYMENT'] = PAYMENT_HEADER;
    headers['PAYMENT-SIGNATURE'] = PAYMENT_HEADER;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 402) {
    const rawBody = await res.json().catch(() => ({}));
    const paymentReq = decodePaymentRequiredFromResponse(res, rawBody);
    const accepts = selectSupportedAccept(paymentReq) || paymentReq?.accepts?.[0];

    // Tier 3: If user provided a local private key, sign and retry in-flight
    if (PRIVATE_KEY && accepts) {
      try {
        const signedHeader = await signEip3009Payment(PRIVATE_KEY, accepts, paymentReq?.resource);
        const retryHeaders = {
          ...headers,
          'X-PAYMENT': signedHeader,
          'PAYMENT-SIGNATURE': signedHeader,
        };
        const retryRes = await fetch(url, {
          ...options,
          headers: retryHeaders,
          signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (retryRes.ok) {
          return retryRes.json();
        }
        const retryBody = await retryRes.json().catch(async () => ({ raw: await retryRes.text().catch(() => '') }));
        return {
          status: 'UPSTREAM_ERROR',
          statusCode: retryRes.status,
          charged: false,
          message: retryBody?.message || retryBody?.error || retryRes.statusText || 'Payment retry failed',
          details: retryBody,
        };
      } catch (signErr: any) {
        return {
          status: 'UPSTREAM_ERROR',
          statusCode: 500,
          charged: false,
          message: `Local EIP-3009 signing failed: ${signErr?.message || String(signErr)}`,
        };
      }
    }

    // Friendly, structured notification for the LLM without crashing
    const price = accepts?.price || (accepts?.amount ? `$${Number(accepts.amount) / 1e6} USDC` : '$0.01 USDC');
    return {
      status: 'X402_PAYMENT_REQUIRED',
      statusCode: 402,
      price,
      payTo: accepts?.recipient || accepts?.payTo || ALLOWED_PAYTO,
      network: `${accepts?.network || 'eip155:8453'}`,
      message: `[AEGIS x402 PAYMENT REQUIRED] This tool costs ${price} on Base.`,
      setupInstructions: {
        optionA_prepaidCredits: 'Top up in 1-click at https://aegisaudit.org/pay and add AEGIS_CREDIT_TOKEN in your MCP settings (zero signing required).',
        optionB_agenticWallet: 'Add AEGIS_PRIVATE_KEY in your MCP config; the local process will sign EIP-3009 gasless settlements on-demand without keys ever leaving your machine.',
      },
      paymentDetails: paymentReq,
    };
  }

  if (!res.ok) {
    const errBody = await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }));
    return {
      status: 'UPSTREAM_ERROR',
      statusCode: res.status,
      charged: false,
      message: errBody?.message || errBody?.error || res.statusText || 'Aegis gateway request failed',
      details: errBody,
    };
  }

  return res.json();
}

const server = new Server(
  {
    name: 'aegis-x402-mcp',
    version: '1.0.8',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'aegis_preflight_bundle',
        description:
          'USE WHEN: An autonomous trading agent or sniper bot needs all-in-one pre-swap security: multi-oracle honeypot audit, DEX liquidity depth, counterparty KYA, and AP2 spend mandate limits in a single call ($0.20 USDC on Base).',
        inputSchema: {
          type: 'object',
          properties: {
            tokenAddress: {
              type: 'string',
              description: 'Contract or mint address of the token to clear before swapping (e.g. 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 on Base)',
            },
            chain: {
              type: 'string',
              enum: ['base', 'ethereum', 'solana'],
              default: 'base',
              description: 'Target blockchain network (defaults to base)',
            },
            counterpartyAddress: {
              type: 'string',
              description: 'Optional counterparty, router, or deployer EVM address for KYA trust verification',
            },
            tradeAmountUsd: {
              type: 'number',
              description: 'Planned trade or swap size in USD to calculate price impact and verify AP2 spend mandate limits',
            },
          },
          required: ['tokenAddress'],
        },
      },
      {
        name: 'aegis_priority_audit',
        description:
          'USE WHEN: A sniper bot or high-frequency trading agent requires a 100% fresh, un-cached multi-oracle token security audit with priority execution ($0.05 USDC on Base).',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Contract address of the token to audit',
            },
            chain: {
              type: 'string',
              enum: ['base', 'ethereum', 'solana'],
              default: 'base',
              description: 'Target blockchain network',
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'aegis_token_audit',
        description:
          'USE WHEN: Verifying smart contract security, honeypot traps, and buy/sell taxes before executing a token swap ($0.01 USDC on Base).',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Contract address of the token',
            },
            chain: {
              type: 'string',
              enum: ['base', 'ethereum', 'solana'],
              default: 'base',
              description: 'Target blockchain network',
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'aegis_token_preview',
        description:
          'USE WHEN: Checking basic DEX market pool, price, and liquidity for any token without requiring payment (FREE).',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Contract address of the token',
            },
            chain: {
              type: 'string',
              enum: ['base', 'ethereum', 'solana'],
              default: 'base',
              description: 'Target blockchain network',
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'aegis_wallet_kya',
        description:
          'USE WHEN: Checking counterparty wallet reputation, transaction count, USDC/ETH balances, and GoPlus sanctions flags before transacting ($0.01 USDC on Base).',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: '0x EVM wallet or agent contract address on Base',
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'aegis_mcp_audit',
        description:
          'USE WHEN: Auditing a remote MCP server URL or inline tool manifest for OWASP MCP03 tool poisoning, credential theft, stealth Unicode, and SHA-256 rug-pull drift before connecting an AI agent ($0.01 USDC on Base).',
        inputSchema: {
          type: 'object',
          properties: {
            serverUrl: {
              type: 'string',
              description: 'Public https:// Streamable HTTP MCP server or mcp.json manifest URL',
            },
            tools: {
              type: 'array',
              description: 'Optional inline MCP tools array to audit instead of a remote serverUrl',
              items: { type: 'object' },
            },
            baselineManifestHash: {
              type: 'string',
              description: 'Optional pinned SHA-256 baseline hash to detect silent runtime rug-pull drift',
            },
          },
        },
      },
      {
        name: 'aegis_web_scrape',
        description:
          'USE WHEN: Scraping any public URL and converting the page into clean, token-efficient LLM Markdown ($0.005 USDC on Base).',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Target HTTP/HTTPS URL to scrape',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'aegis_grounded_chat',
        description:
          'USE WHEN: Running OpenAI-compatible LLM reasoning grounded in live Base/Ethereum/Solana on-chain security telemetry ($0.005 USDC on Base).',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Security or DeFi analysis question to run with live on-chain token context',
            },
            model: {
              type: 'string',
              description: 'Optional model identifier (defaults to aegis-llama-3.1-8b-default)',
              default: 'aegis-llama-3.1-8b-default',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'aegis_recent_audits',
        description:
          'USE WHEN: Monitoring the real-time stream of recently scanned tokens on Base, Ethereum, and Solana (FREE).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'aegis_preflight_bundle') {
      const tokenAddress = String(args?.tokenAddress || args?.address || '').trim();
      if (!tokenAddress) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_ARGUMENT', message: 'tokenAddress is required', charged: false }) }],
          isError: true,
        };
      }
      const chain = String(args?.chain || 'base');
      const counterpartyAddress = args?.counterpartyAddress ? String(args.counterpartyAddress) : undefined;
      const tradeAmountUsd = typeof args?.tradeAmountUsd === 'number' ? args.tradeAmountUsd : undefined;

      const data = await fetchFromAegis('/api/v1/preflight/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, chain, counterpartyAddress, tradeAmountUsd }),
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === 'aegis_priority_audit') {
      const address = String(args?.address || args?.tokenAddress || '').trim();
      if (!address) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_ARGUMENT', message: 'address is required', charged: false }) }],
          isError: true,
        };
      }
      const chain = String(args?.chain || 'base');
      const data = await fetchFromAegis(`/api/v1/token/audit/priority?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === 'aegis_token_audit') {
      const address = String(args?.address || args?.tokenAddress || '').trim();
      if (!address) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_ARGUMENT', message: 'address is required', charged: false }) }],
          isError: true,
        };
      }
      const chain = String(args?.chain || 'base');
      const data = await fetchFromAegis(`/api/v1/token/audit/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === 'aegis_token_preview') {
      const address = String(args?.address || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
      const chain = String(args?.chain || 'base');
      const data = await fetchFromAegis(`/api/v1/token/preview/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === 'aegis_wallet_kya') {
      const address = String(args?.address || '').trim();
      if (!address) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_ARGUMENT', message: 'address is required', charged: false }) }],
          isError: true,
        };
      }
      const data = await fetchFromAegis(`/api/v1/kya/${encodeURIComponent(address)}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === 'aegis_mcp_audit') {
      const serverUrl = args?.serverUrl ? String(args.serverUrl).trim() : '';
      const inlineTools = Array.isArray(args?.tools) ? args.tools : undefined;
      if (!serverUrl && !inlineTools) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_ARGUMENT', message: 'serverUrl or tools array is required', charged: false }) }],
          isError: true,
        };
      }
      const data = await fetchFromAegis('/api/v1/mcp/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: serverUrl || undefined,
          tools: inlineTools,
          baselineManifestHash: args?.baselineManifestHash ? String(args.baselineManifestHash) : undefined,
        }),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === 'aegis_web_scrape') {
      const targetUrl = String(args?.url || '').trim();
      if (!targetUrl) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_ARGUMENT', message: 'url is required', charged: false }) }],
          isError: true,
        };
      }
      const data = await fetchFromAegis(`/api/v1/scrape?url=${encodeURIComponent(targetUrl)}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === 'aegis_grounded_chat') {
      const prompt = String(args?.prompt || '').trim();
      if (!prompt) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_ARGUMENT', message: 'prompt is required', charged: false }) }],
          isError: true,
        };
      }
      const model = String(args?.model || 'aegis-llama-3.1-8b-default');
      const data = await fetchFromAegis('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === 'aegis_recent_audits') {
      const data = await fetchFromAegis('/api/v1/recent');
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Error executing ${name}: ${err?.message || String(err)}` }],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.env.AEGIS_MCP_TEST !== '1') {
  run().catch((error) => {
    console.error('Fatal error running aegis-x402-mcp server:', error);
    process.exit(1);
  });
}
