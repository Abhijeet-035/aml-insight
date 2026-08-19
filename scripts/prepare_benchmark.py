from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_COLUMNS = {
    "Timestamp",
    "From Bank",
    "Account",
    "To Bank",
    "Account.1",
    "Amount Received",
    "Receiving Currency",
    "Amount Paid",
    "Payment Currency",
    "Payment Format",
    "Is Laundering",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prepare(input_path: Path, output_path: Path, metadata_path: Path) -> None:
    if not input_path.exists():
        raise FileNotFoundError(f"Dataset not found: {input_path}")

    header = pd.read_csv(input_path, nrows=0)
    missing = sorted(REQUIRED_COLUMNS.difference(header.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    frame = pd.read_csv(input_path)
    frame = frame.rename(
        columns={
            "Timestamp": "timestamp",
            "From Bank": "from_bank",
            "Account": "account",
            "To Bank": "to_bank",
            "Account.1": "counterparty_account",
            "Amount Received": "amount_received",
            "Receiving Currency": "receiving_currency",
            "Amount Paid": "amount_paid",
            "Payment Currency": "payment_currency",
            "Payment Format": "payment_format",
            "Is Laundering": "is_laundering",
        }
    )
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="raise")
    frame["is_laundering"] = frame["is_laundering"].astype("int8")
    for column in ["amount_received", "amount_paid"]:
        frame[column] = pd.to_numeric(frame[column], errors="raise")

    frame = frame.sort_values("timestamp", kind="stable").reset_index(drop=True)
    frame.insert(0, "transaction_id", range(len(frame)))

    cutoff_60 = frame["timestamp"].quantile(0.60)
    cutoff_80 = frame["timestamp"].quantile(0.80)
    frame["split"] = "test"
    frame.loc[frame["timestamp"] <= cutoff_60, "split"] = "train"
    frame.loc[(frame["timestamp"] > cutoff_60) & (frame["timestamp"] <= cutoff_80), "split"] = "validation"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)
    metadata = {
        "source_file": input_path.name,
        "source_sha256": sha256(input_path),
        "rows": int(len(frame)),
        "columns": list(frame.columns),
        "time_min": frame["timestamp"].min().isoformat(),
        "time_max": frame["timestamp"].max().isoformat(),
        "splits": frame["split"].value_counts().to_dict(),
        "laundering_rows": int(frame["is_laundering"].sum()),
        "evaluation_policy": "chronological 60/20/20 split; no random row mixing",
    }
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT / "data/raw/HI-Small_Trans.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "data/processed/transactions.csv")
    parser.add_argument("--metadata", type=Path, default=ROOT / "data/processed/benchmark_metadata.json")
    args = parser.parse_args()
    prepare(args.input, args.output, args.metadata)
    print(f"Prepared {args.output}")


if __name__ == "__main__":
    main()
