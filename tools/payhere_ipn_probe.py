"""Build correctly-signed PayHere IPN bodies for the live webhook probe.

The IPN signature INCLUDES status_code:

    md5sig = UPPER(MD5(merchant_id + order_id + payhere_amount
                      + payhere_currency + status_code + UPPER(MD5(secret))))

It differs from the CHECKOUT hash by exactly that one field. A gate that only
knows the checkout shape therefore rejects every genuine notification -- which
is precisely the bug that was live on the deployment.

Three arms are emitted, because a gate that rejects everything is
indistinguishable from a gate that works:

  1. valid signature, unknown order id  -> must PASS the gate (then 404-ish,
     i.e. no invoice/order found, but NOT BAD_SIGNATURE)
  2. checkout-shaped signature          -> must be BAD_SIGNATURE
  3. valid signature, tampered amount   -> must be BAD_SIGNATURE

The secret is read from erp/.env and never printed.
"""

import hashlib
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / "erp" / ".env"


def env_value(key: str) -> str:
    if not ENV_PATH.exists():
        return ""
    text = ENV_PATH.read_text(encoding="utf-8", errors="replace")
    match = re.search(rf'^{re.escape(key)}=?"?([^"\r\n]*)"?', text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def md5_upper(text: str) -> str:
    """UPPER(MD5(...)) -- the uppercase applies to the hex DIGEST."""
    return hashlib.md5(text.encode("utf-8")).hexdigest().upper()


merchant_id = env_value("PAYHERE_MERCHANT_ID")
secret = env_value("PAYHERE_MERCHANT_SECRET")

if not merchant_id or not secret:
    print("PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET missing from erp/.env")
    sys.exit(1)

# The shared inner hash: uppercase the digest, NOT the secret.
inner = md5_upper(secret)

base = {
    "merchant_id": merchant_id,
    "order_id": "probe-order-1",
    "payhere_amount": "1000.00",
    "payhere_currency": "LKR",
    "status_code": "2",
}

ipn_sig = md5_upper(
    base["merchant_id"]
    + base["order_id"]
    + base["payhere_amount"]
    + base["payhere_currency"]
    + base["status_code"]
    + inner
)

checkout_sig = md5_upper(
    base["merchant_id"]
    + base["order_id"]
    + base["payhere_amount"]
    + base["payhere_currency"]
    + inner
)

print("ARM1_VALID=" + "&".join(f"{k}={v}" for k, v in {**base, "md5sig": ipn_sig}.items()))
print("ARM2_CHECKOUT_SHAPED=" + "&".join(f"{k}={v}" for k, v in {**base, "md5sig": checkout_sig}.items()))
print(
    "ARM3_TAMPERED_AMOUNT="
    + "&".join(
        f"{k}={v}"
        for k, v in {**base, "payhere_amount": "1.00", "md5sig": ipn_sig}.items()
    )
)
