"""Leakage-safe transaction features for the IBM AML benchmark.

Every aggregate is calculated from transactions strictly earlier than the
scored transaction's timestamp. Transactions sharing a timestamp therefore
cannot influence one another's features.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


REQUIRED_COLUMNS = {
    "transaction_id", "timestamp", "account", "counterparty_account",
    "amount_paid", "amount_received", "payment_currency",
    "receiving_currency", "is_laundering", "split",
}


def _prior_aggregates(frame: pd.DataFrame, keys: list[str], amount_column: str, prefix: str) -> pd.DataFrame:
    """Return count and amount history for each key/timestamp, excluding now."""
    grouped = (
        frame.groupby([*keys, "timestamp"], sort=False, dropna=False)[amount_column]
        .agg([("count", "size"), ("amount", "sum")])
        .reset_index()
        .sort_values([*keys, "timestamp"], kind="stable")
    )
    grouped[f"{prefix}_prior_count"] = grouped.groupby(keys, sort=False)["count"].cumsum() - grouped["count"]
    grouped[f"{prefix}_prior_amount"] = grouped.groupby(keys, sort=False)["amount"].cumsum() - grouped["amount"]
    return grouped[[*keys, "timestamp", f"{prefix}_prior_count", f"{prefix}_prior_amount"]]


def build_historical_features(transactions: pd.DataFrame) -> pd.DataFrame:
    """Build model-ready point-in-time features without using labels."""
    missing = sorted(REQUIRED_COLUMNS.difference(transactions.columns))
    if missing:
        raise ValueError(f"Missing required transaction columns: {missing}")

    frame = transactions.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="raise")
    frame = frame.sort_values(["timestamp", "transaction_id"], kind="stable").reset_index(drop=True)
    result = frame[["transaction_id", "timestamp", "split", "is_laundering", "account", "counterparty_account"]].copy()
    result["amount_paid"] = pd.to_numeric(frame["amount_paid"], errors="raise")
    result["amount_received"] = pd.to_numeric(frame["amount_received"], errors="raise")
    result["log_amount_paid"] = np.log1p(result["amount_paid"].clip(lower=0))
    result["log_amount_received"] = np.log1p(result["amount_received"].clip(lower=0))
    result["amount_delta"] = result["amount_received"] - result["amount_paid"]
    result["amount_ratio"] = (result["amount_received"] / result["amount_paid"].replace(0, np.nan)).fillna(0.0)
    result["hour"] = frame["timestamp"].dt.hour.astype("int8")
    result["day_of_week"] = frame["timestamp"].dt.dayofweek.astype("int8")
    result["is_cross_currency"] = (frame["payment_currency"] != frame["receiving_currency"]).astype("int8")

    outgoing = _prior_aggregates(frame, ["account"], "amount_paid", "outgoing")
    incoming = _prior_aggregates(
        frame.assign(account=frame["counterparty_account"]), ["account"], "amount_received", "incoming"
    )
    pair = _prior_aggregates(frame, ["account", "counterparty_account"], "amount_paid", "pair")
    result = result.merge(outgoing, on=["account", "timestamp"], how="left")
    result = result.merge(incoming, on=["account", "timestamp"], how="left")
    result = result.merge(pair, on=["account", "counterparty_account", "timestamp"], how="left")
    result = result.drop(columns=["account", "counterparty_account"])
    history_columns = [column for column in result.columns if column.endswith(("_prior_count", "_prior_amount"))]
    result[history_columns] = result[history_columns].fillna(0.0)
    return result.sort_values("transaction_id", kind="stable").reset_index(drop=True)
