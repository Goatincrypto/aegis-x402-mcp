import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.AEGIS_PRIVATE_KEY as `0x${string}`);
const signer = toClientEvmSigner(account, createPublicClient({ chain: base, transport: http() }));
const fetchPaid = wrapFetchWithPayment(fetch, new x402Client().register('eip155:8453', new ExactEvmScheme(signer)));

export async function guardSwapOnBase(tokenAddress: string, tradeAmountUsd = 500) {
  const url = `https://aegisaudit.org/api/v1/preflight/bundle?chain=base&tokenAddress=${encodeURIComponent(tokenAddress)}&tradeAmountUsd=${tradeAmountUsd}`;
  const res = await fetchPaid(url);
  if (!res.ok) throw new Error(`Aegis PreFlight HTTP ${res.status} — swap aborted before DEX router`);
  const report = (await res.json()) as { verdict: string; summary: string; proofOfExecution?: { signature: string } };
  if (report.verdict !== 'PROCEED_TRADE') throw new Error(`Swap blocked (${report.verdict}): ${report.summary}`);
  return report; // Proceed with Aerodrome / Uniswap swap; verify report.proofOfExecution via /.well-known/poe-key.json
}
