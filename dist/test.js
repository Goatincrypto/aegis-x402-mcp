import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyTypedData, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
process.env.AEGIS_MCP_TEST = '1';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
test('official payTo allowlist enforces official Aegis receiver address', async () => {
    const { ALLOWED_PAYTO, BASE_USDC } = await import('./index.js');
    assert.equal(ALLOWED_PAYTO, '0x111ef680b6efdd859fbec473b907ace95f0d1acb');
    assert.equal(BASE_USDC, '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
});
test('signEip3009Payment refuses rogue payTo recipient via SECURITY_RECIPIENT_GUARD', async () => {
    const { signEip3009Payment } = await import('./index.js');
    const testPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    await assert.rejects(async () => signEip3009Payment(testPk, {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '200000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x000000000000000000000000000000000000dEaD',
    }), /SECURITY_RECIPIENT_GUARD/);
});
test('signEip3009Payment builds valid x402 v2 EIP-3009 authorization recoverable via EIP-712', async () => {
    const { signEip3009Payment } = await import('./index.js');
    const testPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const expectedAccount = privateKeyToAccount(testPk);
    const accepts = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '200000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x111ef680B6EFdd859FbEc473b907aCe95F0D1acB',
        maxTimeoutSeconds: 300,
        extra: { name: 'USD Coin', version: '2' },
    };
    const b64 = await signEip3009Payment(testPk, accepts, {
        url: 'https://aegis-audit-x402.project-easy-x.workers.dev/api/v1/preflight/bundle',
    });
    const decoded = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    assert.equal(decoded.x402Version, 2);
    assert.ok(decoded.payload.authorization, 'authorization block must exist');
    assert.ok(decoded.payload.signature, 'EIP-712 signature must exist');
    assert.equal(decoded.accepted.payTo, '0x111ef680B6EFdd859FbEc473b907aCe95F0D1acB');
    assert.equal(decoded.payload.authorization.value, '200000');
    const auth = decoded.payload.authorization;
    const isValid = await verifyTypedData({
        address: expectedAccount.address,
        domain: {
            name: 'USD Coin',
            version: '2',
            chainId: 8453,
            verifyingContract: getAddress(accepts.asset),
        },
        types: {
            TransferWithAuthorization: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'validAfter', type: 'uint256' },
                { name: 'validBefore', type: 'uint256' },
                { name: 'nonce', type: 'bytes32' },
            ],
        },
        primaryType: 'TransferWithAuthorization',
        message: {
            from: getAddress(auth.from),
            to: getAddress(auth.to),
            value: BigInt(auth.value),
            validAfter: BigInt(auth.validAfter),
            validBefore: BigInt(auth.validBefore),
            nonce: auth.nonce,
        },
        signature: decoded.payload.signature,
    });
    assert.equal(isValid, true, 'EIP-712 TransferWithAuthorization signature must verify cleanly');
});
test('MCP stdio handshake (SDK 1.32.2) initializes cleanly and exposes all 7 tools', async () => {
    const serverPath = join(__dirname, 'index.js');
    const env = { ...process.env };
    delete env.AEGIS_MCP_TEST;
    const child = spawn(process.execPath, [serverPath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const responses = [];
    let buffer = '';
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('MCP stdio handshake timed out'));
        }, 6000);
        child.stdout.on('data', (chunk) => {
            buffer += chunk.toString('utf-8');
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    const msg = JSON.parse(trimmed);
                    responses.push(msg);
                    if (msg.id === 1) {
                        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
                        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
                    }
                    else if (msg.id === 2) {
                        clearTimeout(timer);
                        child.kill();
                        resolve();
                    }
                }
                catch {
                    // ignore non-JSON lines
                }
            }
        });
        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
        child.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'aegis-ci-test', version: '1.0.3' },
            },
        }) + '\n');
    });
    const initRes = responses.find((r) => r.id === 1);
    assert.ok(initRes?.result?.serverInfo, 'initialize must return serverInfo');
    assert.equal(initRes.result.serverInfo.name, 'aegis-x402-mcp');
    assert.equal(initRes.result.serverInfo.version, '1.0.3');
    const listRes = responses.find((r) => r.id === 2);
    const tools = listRes?.result?.tools || [];
    assert.equal(tools.length, 7, 'Must expose all 7 Aegis MCP tools');
    const names = tools.map((t) => t.name);
    assert.ok(names.includes('aegis_preflight_bundle'));
    assert.ok(names.includes('aegis_priority_audit'));
    assert.ok(names.includes('aegis_token_audit'));
    assert.ok(names.includes('aegis_token_preview'));
    assert.ok(names.includes('aegis_wallet_kya'));
    assert.ok(names.includes('aegis_web_scrape'));
    assert.ok(names.includes('aegis_recent_audits'));
});
