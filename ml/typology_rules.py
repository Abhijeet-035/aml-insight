"""Point-in-time, explainable AML typology rules."""

from __future__ import annotations

from collections import Counter, defaultdict, deque
from dataclasses import dataclass, asdict

import pandas as pd


REQUIRED_COLUMNS = {
    "transaction_id", "timestamp", "account", "counterparty_account",
    "amount_paid", "payment_currency", "receiving_currency", "split",
}
WINDOW = pd.Timedelta("24h")


@dataclass(frozen=True)
class TypologyConfig:
    high_value_threshold: float
    velocity_count_threshold: int = 5
    fan_out_counterparty_threshold: int = 4

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def fit_config(transactions: pd.DataFrame) -> TypologyConfig:
    """Fit monetary thresholds using only the chronological training period."""
    train = transactions.loc[transactions["split"] == "train", "amount_paid"]
    if train.empty:
        raise ValueError("Cannot fit typology thresholds without a train split")
    return TypologyConfig(high_value_threshold=float(pd.to_numeric(train, errors="raise").quantile(0.99)))


def _expire(events: deque[tuple[pd.Timestamp, float, str]], now: pd.Timestamp) -> None:
    while events and now - events[0][0] > WINDOW:
        events.popleft()


def score_typologies(transactions: pd.DataFrame, config: TypologyConfig) -> pd.DataFrame:
    """Score transactions with rules using only events before their timestamp.

    A timestamp is scored as a batch and added to history afterwards, which
    prevents same-timestamp transaction leakage.
    """
    missing = sorted(REQUIRED_COLUMNS.difference(transactions.columns))
    if missing:
        raise ValueError(f"Missing required transaction columns: {missing}")
    frame = transactions.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="raise")
    frame["amount_paid"] = pd.to_numeric(frame["amount_paid"], errors="raise")
    frame = frame.sort_values(["timestamp", "transaction_id"], kind="stable")

    outgoing: dict[str, deque[tuple[pd.Timestamp, float, str]]] = defaultdict(deque)
    incoming: dict[str, deque[tuple[pd.Timestamp, float, str]]] = defaultdict(deque)
    historical_pairs: Counter[tuple[str, str]] = Counter()
    scored: list[dict[str, object]] = []

    for timestamp, batch in frame.groupby("timestamp", sort=False):
        for row in batch.itertuples(index=False):
            account, counterparty = str(row.account), str(row.counterparty_account)
            out_events, in_events = outgoing[account], incoming[account]
            _expire(out_events, timestamp)
            _expire(in_events, timestamp)
            prior_outgoing = len(out_events)
            prior_incoming = len(in_events)
            prior_counterparties = len({event[2] for event in out_events})
            prior_incoming_amount = sum(event[1] for event in in_events)
            amount = float(row.amount_paid)
            cross_currency = row.payment_currency != row.receiving_currency
            reasons: list[str] = []
            score = 0

            if prior_outgoing >= config.velocity_count_threshold and prior_counterparties >= config.fan_out_counterparty_threshold:
                reasons.append("Fan-out: multiple counterparties in the prior 24 hours")
                score += 35
            if prior_incoming >= config.velocity_count_threshold:
                reasons.append("Fan-in: repeated incoming transfers in the prior 24 hours")
                score += 25
            if prior_incoming_amount >= amount and amount >= config.high_value_threshold * 0.5:
                reasons.append("Rapid movement: recent incoming value covers this outgoing transfer")
                score += 25
            if config.high_value_threshold * 0.8 <= amount <= config.high_value_threshold and prior_outgoing >= 2:
                reasons.append("Structuring: repeated transfers just below the high-value threshold")
                score += 20
            if cross_currency and prior_incoming >= 2:
                reasons.append("Layering: cross-currency transfer following incoming activity")
                score += 20
            if historical_pairs[(counterparty, account)] > 0:
                reasons.append("Circular flow: prior reciprocal transfer between these accounts")
                score += 20
            if amount >= config.high_value_threshold:
                reasons.append("High-value transfer: exceeds the training-period 99th percentile")
                score += 15

            scored.append({
                "transaction_id": int(row.transaction_id),
                "timestamp": timestamp,
                "account": account,
                "counterparty_account": counterparty,
                "typology_risk": min(score, 100),
                "typology_reasons": "; ".join(reasons),
                "typology_count": len(reasons),
            })
        # Update histories only after all rows at this timestamp have been scored.
        for row in batch.itertuples(index=False):
            account, counterparty = str(row.account), str(row.counterparty_account)
            outgoing[account].append((timestamp, float(row.amount_paid), counterparty))
            incoming[counterparty].append((timestamp, float(row.amount_paid), account))
            historical_pairs[(account, counterparty)] += 1

    return pd.DataFrame(scored).sort_values("transaction_id", kind="stable").reset_index(drop=True)


def account_risk_summary(scores: pd.DataFrame) -> pd.DataFrame:
    """Create an explainable account-level queue from transaction rule scores."""
    alerts = scores.loc[scores["typology_risk"] > 0]
    if alerts.empty:
        return pd.DataFrame(columns=["account", "typology_risk", "alert_count", "reasons"])
    return alerts.groupby("account", as_index=False).agg(
        typology_risk=("typology_risk", "max"),
        alert_count=("transaction_id", "size"),
        reasons=("typology_reasons", lambda values: "; ".join(dict.fromkeys(reason for value in values for reason in value.split("; ") if reason))),
    )
