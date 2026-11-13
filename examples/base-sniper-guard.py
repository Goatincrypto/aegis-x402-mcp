import json, os, urllib.request

GATEWAY = "https://aegisaudit.org"

def guard_swap_on_base(token_address: str, trade_usd: float = 500.0, payment_sig: str = "") -> dict:
    headers = {"Content-Type": "application/json", "User-Agent": "AegisSniperGuard/1.0"}
    credit = os.getenv("AEGIS_CREDIT_TOKEN", "")
    if credit.startswith("aegis_credit_"): headers["x-api-key"] = credit
    elif payment_sig: headers["PAYMENT-SIGNATURE"] = headers["X-PAYMENT"] = payment_sig
    body = json.dumps({"chain": "base", "tokenAddress": token_address, "tradeAmountUsd": trade_usd}).encode()
    req = urllib.request.Request(f"{GATEWAY}/api/v1/preflight/bundle", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=20) as resp:  # Fails closed on HTTP 402/5xx before DEX swap
        if resp.status != 200: raise RuntimeError(f"PreFlight blocked HTTP {resp.status}")
        report = json.loads(resp.read().decode("utf-8"))
    if report.get("verdict") != "PROCEED_TRADE":
        raise ValueError(f"Swap blocked on Base ({report.get('verdict')}): {report.get('summary')}")
    return report  # Safe to execute Aerodrome / Uniswap swap
