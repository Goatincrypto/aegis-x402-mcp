#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { privateKeyToAccount } from 'viem/accounts';
import { randomBytes } from 'crypto';
const GATEWAY_URL = process.env.AEGIS_GATEWAY_URL || 'https://aegis-audit-x402.project-easy-x.workers.dev';
const API_KEY = process.env.AEGIS_API_KEY || process.env.AEGIS_CREDIT_TOKEN || '';
const PRIVATE_KEY = process.env.AEGIS_PRIVATE_KEY || '';
const PAYMENT_HEADER = process.env.X402_PAYMENT_HEADER || '';
const ALLOWED_PAYTO = '0x111ef680B6EFdd859FbEc473b907aCe95F0D1acB'.toLowerCase();
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
/**
 * Signs EIP-3009 TransferWithAuthorization locally inside the user's MCP process.
 * Keys never leave the local machine.
 * Protected by strict recipient allowlist guard: only signs toward official Aegis address.
 */
async function signEip3009Payment(privateKeyHex, accepts) {
    const cleanKey = privateKeyHex.trim().startsWith('0x')
        ? privateKeyHex.trim()
        : `0x${privateKeyHex.trim()}`;
    const account = privateKeyToAccount(cleanKey);
    const recipient = (accepts.payTo || accepts.recipient || '').toLowerCase();
    if (recipient !== ALLOWED_PAYTO) {
        throw new Error(`SECURITY_RECIPIENT_GUARD: Recipient ${recipient} is not official Aegis receiver (${ALLOWED_PAYTO}). Signing refused.`);
    }
    const nonce = `0x${randomBytes(32).toString('hex')}`;
    const validAfter = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const value = BigInt(accepts.amount || '10000');
    const domain = {
        name: accepts.extra?.name || 'USD Coin',
        version: accepts.extra?.version || '2',
        chainId: 8453,
        verifyingContract: (accepts.asset || BASE_USDC),
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
            from: account.address,
            to: accepts.payTo,
            value,
            validAfter,
            validBefore,
            nonce,
        },
    });
    const paymentPayload = {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:8453',
        asset: accepts.asset || BASE_USDC,
        payload: {
            from: account.address,
            to: accepts.payTo,
            value: value.toString(),
            validAfter: Number(validAfter),
            validBefore: Number(validBefore),
            nonce,
            signature,
        },
    };
    return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
}
/**
 * 3-Tier Execution Pipeline:
 * Tier 1: Zero-config free tools execute immediately.
 * Tier 2: Prepaid credit token (AEGIS_CREDIT_TOKEN / AEGIS_API_KEY) in env.
 * Tier 3: Local wallet signing (AEGIS_PRIVATE_KEY) in env -> signs 402 challenge and retries seamlessly.
 */
async function fetchFromAegis(endpoint, options = {}) {
    const url = `${GATEWAY_URL}${endpoint}`;
    const headers = {
        'Accept': 'application/json',
        ...(options.headers || {}),
    };
    if (API_KEY) {
        headers['x-api-key'] = API_KEY;
        headers['Authorization'] = `Bearer ${API_KEY}`;
    }
    if (PAYMENT_HEADER) {
        headers['X-PAYMENT'] = PAYMENT_HEADER;
        headers['PAYMENT-SIGNATURE'] = PAYMENT_HEADER;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 402) {
        const paymentReq = await res.json().catch(() => ({}));
        const accepts = paymentReq?.accepts?.[0];
        // Tier 3: If user provided a local private key, sign and retry in-flight
        if (PRIVATE_KEY && accepts) {
            try {
                const signedHeader = await signEip3009Payment(PRIVATE_KEY, accepts);
                const retryHeaders = {
                    ...headers,
                    'X-PAYMENT': signedHeader,
                    'PAYMENT-SIGNATURE': signedHeader,
                };
                const retryRes = await fetch(url, { ...options, headers: retryHeaders });
                if (retryRes.ok) {
                    return retryRes.json();
                }
            }
            catch (signErr) {
                console.error('[aegis-mcp] Local EIP-3009 signing failed:', signErr?.message);
            }
        }
        // Friendly, structured notification for the LLM without crashing
        const price = accepts?.price || (accepts?.amount ? `$${Number(accepts.amount) / 1e6} USDC` : '$0.01 USDC');
        return {
            status: 'X402_PAYMENT_REQUIRED',
            statusCode: 402,
            price,
            payTo: accepts?.recipient || accepts?.payTo || ALLOWED_PAYTO,
            network: 'eip155:8453 (Base Mainnet)',
            message: `[AEGIS x402 PAYMENT REQUIRED] This tool costs ${price} on Base Mainnet.`,
            setupInstructions: {
                optionA_prepaidCredits: 'Top up in 1-click at https://aegis-audit-x402.project-easy-x.workers.dev/pay and add AEGIS_CREDIT_TOKEN in your MCP settings (zero signing required).',
                optionB_agenticWallet: 'Add AEGIS_PRIVATE_KEY in your MCP config; the local process will sign EIP-3009 gasless settlements on-demand without keys ever leaving your machine.',
            },
            paymentDetails: paymentReq,
        };
    }
    return res.json();
}
const server = new Server({
    name: 'aegis-x402-mcp',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'aegis_preflight_bundle',
                description: 'USE WHEN: An autonomous trading agent or sniper bot needs all-in-one pre-swap security: multi-oracle honeypot audit, DEX liquidity depth, counterparty KYA, and AP2 spend mandate limits in a single call ($0.20 USDC on Base).',
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
                description: 'USE WHEN: A sniper bot or high-frequency trading agent requires a 100% fresh, un-cached multi-oracle token security audit with priority execution ($0.05 USDC on Base).',
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
                description: 'USE WHEN: Verifying smart contract security, honeypot traps, and buy/sell taxes before executing a token swap ($0.01 USDC on Base).',
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
                description: 'USE WHEN: Checking basic DEX market pool, price, and liquidity for any token without requiring payment (FREE).',
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
                description: 'USE WHEN: Checking counterparty wallet reputation, transaction count, USDC/ETH balances, and GoPlus sanctions flags before transacting ($0.01 USDC on Base).',
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
                name: 'aegis_web_scrape',
                description: 'USE WHEN: Scraping any public URL and converting the page into clean, token-efficient LLM Markdown ($0.005 USDC on Base).',
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
                name: 'aegis_recent_audits',
                description: 'USE WHEN: Monitoring the real-time stream of recently scanned tokens on Base, Ethereum, and Solana (FREE).',
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
            const tokenAddress = String(args?.tokenAddress || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
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
            const address = String(args?.address || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
            const chain = String(args?.chain || 'base');
            const data = await fetchFromAegis(`/api/v1/token/audit/priority?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            };
        }
        if (name === 'aegis_token_audit') {
            const address = String(args?.address || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
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
            const address = String(args?.address || '0x111ef680B6EFdd859FbEc473b907aCe95F0D1acB');
            const data = await fetchFromAegis(`/api/v1/kya/${encodeURIComponent(address)}`);
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            };
        }
        if (name === 'aegis_web_scrape') {
            const targetUrl = String(args?.url || 'https://example.com');
            const data = await fetchFromAegis(`/api/v1/scrape?url=${encodeURIComponent(targetUrl)}`);
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
    }
    catch (err) {
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
run().catch((error) => {
    console.error('Fatal error running aegis-x402-mcp server:', error);
    process.exit(1);
});
