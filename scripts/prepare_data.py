from pathlib import Path
import argparse
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"


def find_source(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit).expanduser().resolve()
        if path.exists():
            return path
        raise FileNotFoundError(path)
    candidates = [
        RAW / "HI-Small_Trans.csv",
        RAW / "HI-Small_Trans.csv.gz",
        RAW / "HI-Small_Trans.parquet",
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError("No HI-Small transaction file found under data/raw")


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    mapping = {
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
    frame = frame.rename(columns={column: mapping.get(column.strip(), column.strip().lower().replace(" ", "_")) for column in frame.columns})
    if "account.1" in frame.columns and "counterparty_account" not in frame.columns:
        frame = frame.rename(columns={"account.1": "counterparty_account"})
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce")
    for column in ["amount_received", "amount_paid"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["is_laundering"] = pd.to_numeric(frame["is_laundering"], errors="coerce").fillna(0).astype("int8")
    frame["transaction_id"] = range(len(frame))
    frame["amount_ratio"] = (frame["amount_received"] / frame["amount_paid"].replace(0, pd.NA)).fillna(0)
    frame["amount_delta"] = frame["amount_received"] - frame["amount_paid"]
    frame["hour"] = frame["timestamp"].dt.hour.fillna(-1).astype("int8")
    frame["day_of_week"] = frame["timestamp"].dt.dayofweek.fillna(-1).astype("int8")
    frame["is_cross_currency"] = (frame["payment_currency"] != frame["receiving_currency"]).astype("int8")
    return frame


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=None)
    args = parser.parse_args()
    source = find_source(args.input)
    if source.suffix == ".parquet":
        frame = pd.read_parquet(source)
    else:
        frame = pd.read_csv(source)
    frame = normalize_columns(frame)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    output = PROCESSED / "transactions.csv"
    frame.to_csv(output, index=False)
    summary = {
        "rows": int(len(frame)),
        "columns": list(frame.columns),
        "laundering_rows": int(frame["is_laundering"].sum()),
        "laundering_rate": float(frame["is_laundering"].mean()),
        "min_timestamp": str(frame["timestamp"].min()),
        "max_timestamp": str(frame["timestamp"].max()),
    }
    print(summary)
    print(output)


if __name__ == "__main__":
    main()
