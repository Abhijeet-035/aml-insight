from pathlib import Path
import argparse
import json
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(ROOT / "data" / "raw" / "HI-Small_Trans.csv"))
    args = parser.parse_args()
    path = Path(args.input).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    frame = pd.read_csv(path, nrows=10000)
    missing = sorted(EXPECTED - set(frame.columns))
    if missing:
        raise ValueError(f"Missing expected columns: {missing}")
    label = pd.to_numeric(frame["Is Laundering"], errors="coerce")
    report = {
        "path": str(path),
        "sample_rows": int(len(frame)),
        "columns": list(frame.columns),
        "missing_values": {column: int(frame[column].isna().sum()) for column in frame.columns if frame[column].isna().any()},
        "sample_laundering_rate": float(label.mean()),
        "timestamp_min": str(pd.to_datetime(frame["Timestamp"], errors="coerce").min()),
        "timestamp_max": str(pd.to_datetime(frame["Timestamp"], errors="coerce").max()),
        "unique_accounts": int(pd.concat([frame["Account"], frame["Account.1"]]).nunique()),
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
