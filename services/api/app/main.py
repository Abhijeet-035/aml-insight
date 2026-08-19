from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
import json
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[3]
MODEL_METRICS = ROOT / "models" / "metrics.json"
PROCESSED = ROOT / "data" / "processed" / "transactions.csv"
EDGES = ROOT / "data" / "processed" / "edges.csv"
TYPOLOGY_ALERTS = ROOT / "data" / "processed" / "typology_alerts.csv"
ACCOUNT_RISK_SCORES = ROOT / "data" / "processed" / "account_risk_scores.csv"

app = FastAPI(title="AML Insight API", version="0.4.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def model_status() -> dict:
    if not MODEL_METRICS.exists():
        return {"status": "not_trained", "metrics": None}
    return {"status": "trained", "metrics": json.loads(MODEL_METRICS.read_text())}


@lru_cache(maxsize=1)
def transaction_frame() -> pd.DataFrame | None:
    if not PROCESSED.exists():
        return None
    columns = ["transaction_id", "timestamp", "account", "counterparty_account", "amount_received", "receiving_currency", "payment_format", "is_laundering"]
    return pd.read_csv(PROCESSED, usecols=lambda column: column in columns)


@lru_cache(maxsize=1)
def typology_frame() -> pd.DataFrame | None:
    if not TYPOLOGY_ALERTS.exists():
        return None
    return pd.read_csv(TYPOLOGY_ALERTS)


@lru_cache(maxsize=1)
def account_risk_frame() -> pd.DataFrame | None:
    if not ACCOUNT_RISK_SCORES.exists():
        return None
    return pd.read_csv(ACCOUNT_RISK_SCORES)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/v1/overview")
def overview():
    status = model_status()
    frame = transaction_frame()
    if frame is None:
        return {"transactions": 0, "alerts": 0, "suspicious_rate": 0, "network_nodes": 0, "risk_volume": 0, "model_status": status["status"], "model_metrics": status["metrics"], "data_status": "awaiting_dataset"}
    nodes = pd.concat([frame["account"], frame["counterparty_account"]]).nunique()
    suspicious = int(frame["is_laundering"].sum())
    risk_volume = frame.loc[frame["is_laundering"] == 1, "amount_received"].sum()
    return {"transactions": int(len(frame)), "alerts": suspicious, "suspicious_rate": round(suspicious / len(frame) * 100, 4) if len(frame) else 0, "network_nodes": int(nodes), "risk_volume": round(float(risk_volume), 2), "model_status": status["status"], "model_metrics": status["metrics"], "data_status": "processed_dataset"}


@app.get("/api/v1/model")
def model():
    return model_status()


@app.get("/api/v1/alerts")
def alerts(limit: int = 20):
    frame = transaction_frame()
    if frame is None:
        return []
    typologies = typology_frame()
    if typologies is not None:
        candidates = typologies[typologies["typology_risk"] > 0].merge(
            frame[["transaction_id", "amount_received", "receiving_currency"]], on="transaction_id", how="left"
        ).sort_values(["typology_risk", "transaction_id"], ascending=[False, False]).head(max(1, min(limit, 100)))
        return [{
            "id": f"AML-{int(row.transaction_id):06d}",
            "account": str(row.account),
            "counterparty": str(row.counterparty_account),
            "amount": float(row.amount_received),
            "currency": str(row.receiving_currency),
            "risk": float(row.typology_risk),
            "pattern": str(row.typology_reasons),
        } for row in candidates.itertuples(index=False)]
    suspicious = frame[frame["is_laundering"] == 1].sort_values("amount_received", ascending=False).head(max(1, min(limit, 100)))
    return [{"id": f"AML-{int(row.transaction_id):06d}", "account": str(row.account), "counterparty": str(row.counterparty_account), "amount": float(row.amount_received), "currency": str(row.receiving_currency), "risk": 90.0, "pattern": "Benchmark laundering transaction"} for row in suspicious.itertuples(index=False)]


@app.get("/api/v1/network")
def network(limit: int = 20):
    if not EDGES.exists():
        return {"nodes": [], "edges": []}
    edges = pd.read_csv(EDGES).sort_values(["suspicious_count", "total_amount"], ascending=False).head(max(1, min(limit, 100)))
    node_ids = sorted(set(edges["account"]).union(edges["counterparty_account"]))
    return {"nodes": [{"id": str(node), "label": str(node)} for node in node_ids], "edges": [{"source": str(row.account), "target": str(row.counterparty_account), "transactions": int(row.transaction_count), "amount": float(row.total_amount), "suspicious": int(row.suspicious_count)} for row in edges.itertuples(index=False)]}


@app.get("/api/v1/account/{account_id}")
def account(account_id: str):
    frame = transaction_frame()
    if frame is None:
        raise HTTPException(status_code=404, detail="Dataset is not loaded")
    related = frame[(frame["account"] == account_id) | (frame["counterparty_account"] == account_id)]
    if related.empty:
        raise HTTPException(status_code=404, detail=f"Account {account_id} is not loaded")
    result = {"account": account_id, "transactions": int(len(related)), "suspicious_transactions": int(related["is_laundering"].sum()), "counterparties": int(pd.concat([related["account"], related["counterparty_account"]]).nunique() - 1), "total_volume": round(float(related["amount_received"].sum()), 2)}
    account_scores = account_risk_frame()
    if account_scores is not None:
        match = account_scores[account_scores["account"].astype(str) == account_id]
        if not match.empty:
            score = match.iloc[0]
            result["typology_risk"] = float(score.typology_risk)
            result["typology_alert_count"] = int(score.alert_count)
            result["typology_reasons"] = str(score.reasons)
    return result
