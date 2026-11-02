#!/usr/bin/env node
export declare const ALLOWED_PAYTO: string;
export declare const BASE_USDC: string;
/**
 * Signs EIP-3009 TransferWithAuthorization locally inside the user's MCP process.
 * Keys never leave the local machine.
 * Protected by strict recipient allowlist guard: only signs toward official Aegis address.
 */
export declare function signEip3009Payment(privateKeyHex: string, accepts: any, resource?: any): Promise<string>;
