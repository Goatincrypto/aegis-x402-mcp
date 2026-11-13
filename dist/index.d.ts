#!/usr/bin/env node
export declare const ALLOWED_PAYTO: string;
export declare const BASE_USDC: string;
export declare function parseChainIdFromNetwork(network?: string): number;
/**
 * Signs EIP-3009 TransferWithAuthorization locally inside the user's MCP process.
 * Keys never leave the local machine.
 * Protected by strict recipient allowlist guard: only signs toward official Aegis address.
 */
export declare function signEip3009Payment(privateKeyHex: string, accepts: any, resource?: any): Promise<string>;
/**
 * 3-Tier Execution Pipeline:
 * Tier 1: Zero-config free tools execute immediately.
 * Tier 2: Prepaid credit token (AEGIS_CREDIT_TOKEN / AEGIS_API_KEY) in env.
 * Tier 3: Local wallet signing (AEGIS_PRIVATE_KEY) in env -> signs 402 challenge and retries seamlessly.
 */
export declare function fetchFromAegis(endpoint: string, options?: RequestInit): Promise<any>;
