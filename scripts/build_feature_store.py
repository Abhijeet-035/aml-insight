import sqlite3
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "processed" / "historical_features.csv"
DATABASE = ROOT / "data" / "processed" / "historical_features.db"

COLUMNS = [
    "transaction_id",
    "timestamp",
    "split",
    "is_laundering",
    "amount_paid",
    "amount_received",
    "log_amount_paid",
    "log_amount_received",
    "amount_delta",
    "amount_ratio",
    "hour",
    "day_of_week",
    "is_cross_currency",
    "outgoing_prior_count",
    "outgoing_prior_amount",
    "incoming_prior_count",
    "incoming_prior_amount",
    "pair_prior_count",
    "pair_prior_amount",
]

CREATE_TABLE = """
CREATE TABLE historical_features (
    transaction_id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL,
    split TEXT NOT NULL,
    is_laundering INTEGER NOT NULL,
    amount_paid REAL NOT NULL,
    amount_received REAL NOT NULL,
    log_amount_paid REAL NOT NULL,
    log_amount_received REAL NOT NULL,
    amount_delta REAL NOT NULL,
    amount_ratio REAL NOT NULL,
    hour INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    is_cross_currency INTEGER NOT NULL,
    outgoing_prior_count REAL NOT NULL,
    outgoing_prior_amount REAL NOT NULL,
    incoming_prior_count REAL NOT NULL,
    incoming_prior_amount REAL NOT NULL,
    pair_prior_count REAL NOT NULL,
    pair_prior_amount REAL NOT NULL
)
"""

if not SOURCE.exists():
    raise FileNotFoundError(f"Source file not found: {SOURCE}")

if DATABASE.exists():
    DATABASE.unlink()

connection = sqlite3.connect(DATABASE)
connection.execute(CREATE_TABLE)

rows_loaded = 0

for chunk in pd.read_csv(SOURCE, usecols=COLUMNS, chunksize=100_000):
    chunk.to_sql(
        "historical_features",
        connection,
        if_exists="append",
        index=False,
    )
    rows_loaded += len(chunk)
    print(f"Loaded {rows_loaded:,} rows")

connection.execute(
    "CREATE INDEX idx_historical_features_transaction_id "
    "ON historical_features(transaction_id)"
)
connection.commit()
connection.close()

print(f"Created {DATABASE}")
print(f"Rows: {rows_loaded:,}")
