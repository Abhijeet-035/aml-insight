from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "raw" / "HI-Small_Trans.csv"


def main() -> None:
    rng = np.random.default_rng(42)
    accounts = np.array([f"ACC-{i:06d}" for i in range(5000)])
    currencies = np.array(["USD", "EUR", "GBP", "INR"])
    formats = np.array(["ACH", "Wire", "Cheque", "Credit Card", "Bitcoin"])
    rows = 50000
    source = rng.choice(accounts, rows)
    target = rng.choice(accounts, rows)
    same = source == target
    target[same] = np.roll(target, 1)[same]
    amounts = np.round(np.exp(rng.normal(5.4, 1.25, rows)), 2)
    payment_currency = rng.choice(currencies, rows, p=[0.5, 0.22, 0.13, 0.15])
    receiving_currency = rng.choice(currencies, rows, p=[0.5, 0.22, 0.13, 0.15])
    payment_format = rng.choice(formats, rows, p=[0.35, 0.25, 0.12, 0.23, 0.05])
    timestamps = pd.Timestamp("2025-01-01") + pd.to_timedelta(rng.integers(0, 10 * 24 * 60, rows), unit="m")
    high_amount = amounts > np.quantile(amounts, 0.985)
    crypto = payment_format == "Bitcoin"
    cross_currency = payment_currency != receiving_currency
    laundering = ((high_amount & (crypto | cross_currency)) | ((payment_format == "Wire") & (amounts > np.quantile(amounts, 0.92))))
    laundering &= rng.random(rows) < 0.28
    laundering = laundering.astype(int)
    frame = pd.DataFrame({
        "Timestamp": timestamps,
        "From Bank": rng.integers(1, 101, rows),
        "Account": source,
        "To Bank": rng.integers(1, 101, rows),
        "Account.1": target,
        "Amount Received": amounts * rng.uniform(0.96, 1.04, rows),
        "Receiving Currency": receiving_currency,
        "Amount Paid": amounts,
        "Payment Currency": payment_currency,
        "Payment Format": payment_format,
        "Is Laundering": laundering,
    })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(OUTPUT, index=False)
    print(f"Generated {len(frame):,} demo transactions at {OUTPUT}")
    print(f"Laundering rows: {int(frame['Is Laundering'].sum()):,}")


if __name__ == "__main__":
    main()
