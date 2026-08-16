from datetime import datetime, timezone
from pathlib import Path
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[3]
MODEL_METRICS = ROOT / "models" / "metrics.json"

app = FastAPI(title="AML Insight API", version="0.2.0")
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


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/v1/overview")
def overview():
    status = model_status()
    return {
        "transactions": 0,
        "alerts": 0,
        "suspicious_rate": 0,
        "network_nodes": 0,
        "risk_volume": 0,
        "model_status": status["status"],
        "model_metrics": status["metrics"],
        "data_status": "awaiting_dataset",
    }


@app.get("/api/v1/model")
def model():
    return model_status()


@app.get("/api/v1/alerts")
def alerts():
    return []


@app.get("/api/v1/account/{account_id}")
def account(account_id: str):
    raise HTTPException(status_code=404, detail=f"Account {account_id} is not loaded")
