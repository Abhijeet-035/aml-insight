from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import sqlite3
import uuid
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[1]
MODEL_METRICS = ROOT / "models" / "metrics.json"
MODEL_PATH = ROOT / "models" / "transaction_risk_xgb.joblib"
PROCESSED = ROOT / "data" / "processed" / "transactions.csv"
FEATURE_STORE = ROOT / "data" / "processed" / "historical_features.db"
EDGES = ROOT / "data" / "processed" / "edges.csv"
TYPOLOGY_ALERTS = ROOT / "data" / "processed" / "typology_alerts.csv"
ACCOUNT_RISK_SCORES = ROOT / "data" / "processed" / "account_risk_scores.csv"
ACCOUNT_GRAPH_FEATURES = ROOT / "data" / "processed" / "account_graph_features.csv"
INVESTIGATIONS_DB = ROOT / "data" / "processed" / "investigations.db"
MODEL_FEATURES = [
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

app = FastAPI(title="AML Insight API", version="0.4.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def investigation_connection():
    INVESTIGATIONS_DB.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(INVESTIGATIONS_DB)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS investigations (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            resolution TEXT,
            resolution_notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    investigation_columns = {
        row["name"]
        for row in connection.execute(
            "PRAGMA table_info(investigations)"
        ).fetchall()
    }

    if "resolution" not in investigation_columns:
        connection.execute(
            "ALTER TABLE investigations ADD COLUMN resolution TEXT"
        )

    if "resolution_notes" not in investigation_columns:
        connection.execute(
            "ALTER TABLE investigations ADD COLUMN resolution_notes TEXT NOT NULL DEFAULT ''"
        )

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS investigation_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            investigation_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            title TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS investigation_evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            investigation_id TEXT NOT NULL,
            evidence_type TEXT NOT NULL,
            title TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )
    connection.commit()
    return connection


def investigation_record(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "account_id": row["account_id"],
        "status": row["status"],
        "notes": row["notes"],
        "resolution": row["resolution"],
        "resolution_notes": row["resolution_notes"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def investigation_event_record(row: sqlite3.Row) -> dict:
    return {
        "id": int(row["id"]),
        "investigation_id": row["investigation_id"],
        "event_type": row["event_type"],
        "title": row["title"],
        "details": row["details"],
        "created_at": row["created_at"],
    }


def investigation_evidence_record(row: sqlite3.Row) -> dict:
    return {
        "id": int(row["id"]),
        "investigation_id": row["investigation_id"],
        "evidence_type": row["evidence_type"],
        "title": row["title"],
        "details": row["details"],
        "created_at": row["created_at"],
    }


def add_investigation_event(
    connection: sqlite3.Connection,
    investigation_id: str,
    event_type: str,
    title: str,
    details: str,
    created_at: str | None = None,
) -> None:
    timestamp = created_at or datetime.now(timezone.utc).isoformat()
    connection.execute(
        """
        INSERT INTO investigation_events (
            investigation_id,
            event_type,
            title,
            details,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            investigation_id,
            event_type,
            title,
            details,
            timestamp,
        ),
    )


def add_investigation_evidence(
    connection: sqlite3.Connection,
    investigation_id: str,
    evidence_type: str,
    title: str,
    details: str,
    created_at: str | None = None,
) -> None:
    timestamp = created_at or datetime.now(timezone.utc).isoformat()
    connection.execute(
        """
        INSERT INTO investigation_evidence (
            investigation_id,
            evidence_type,
            title,
            details,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            investigation_id,
            evidence_type,
            title,
            details,
            timestamp,
        ),
    )


def model_status() -> dict:
    if not MODEL_METRICS.exists():
        return {"status": "not_trained", "metrics": None}
    return {"status": "trained", "metrics": json.loads(MODEL_METRICS.read_text())}

@lru_cache(maxsize=1)
def risk_model():
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)

def feature_store_row(transaction_id: int) -> dict | None:
    if not FEATURE_STORE.exists():
        return None

    connection = sqlite3.connect(FEATURE_STORE)
    connection.row_factory = sqlite3.Row

    row = connection.execute(
        "SELECT * FROM historical_features WHERE transaction_id = ?",
        (transaction_id,),
    ).fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)

def transaction_metadata_row(transaction_id: int) -> dict | None:
    if not FEATURE_STORE.exists():
        return None

    connection = sqlite3.connect(FEATURE_STORE)
    connection.row_factory = sqlite3.Row

    row = connection.execute(
        "SELECT * FROM transaction_metadata WHERE transaction_id = ?",
        (transaction_id,),
    ).fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)

class InvestigationCreate(BaseModel):
    account_id: str
    notes: str = ""


class InvestigationUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    resolution: str | None = None
    resolution_notes: str | None = None


class InvestigationEvidenceCreate(BaseModel):
    evidence_type: str
    title: str
    details: str


class PredictionRequest(BaseModel):
    amount_paid: float
    amount_received: float
    log_amount_paid: float
    log_amount_received: float
    amount_delta: float
    amount_ratio: float
    hour: int
    day_of_week: int
    is_cross_currency: int
    outgoing_prior_count: int
    outgoing_prior_amount: float
    incoming_prior_count: int
    incoming_prior_amount: float
    pair_prior_count: int
    pair_prior_amount: float

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

@lru_cache(maxsize=1)
def account_graph_frame() -> pd.DataFrame | None:
    if not ACCOUNT_GRAPH_FEATURES.exists():
        return None
    return pd.read_csv(ACCOUNT_GRAPH_FEATURES)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/api/v1/investigations")
def create_investigation(request: InvestigationCreate):
    account_id = request.account_id.strip()

    if not account_id:
        raise HTTPException(
            status_code=400,
            detail="Account ID is required",
        )

    frame = transaction_frame()

    if frame is None:
        raise HTTPException(
            status_code=503,
            detail="Dataset is not loaded",
        )

    related = frame[
        (frame["account"] == account_id)
        | (frame["counterparty_account"] == account_id)
    ]

    if related.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Account {account_id} is not loaded",
        )

    now = datetime.now(timezone.utc).isoformat()
    investigation_id = (
        f"INV-{datetime.now(timezone.utc):%Y%m%d}-"
        f"{uuid.uuid4().hex[:6].upper()}"
    )

    connection = investigation_connection()

    connection.execute(
        """
        INSERT INTO investigations (
            id,
            account_id,
            status,
            notes,
            resolution,
            resolution_notes,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            investigation_id,
            account_id,
            "Open",
            request.notes.strip(),
            None,
            "",
            now,
            now,
        ),
    )

    connection.commit()

    add_investigation_event(
        connection,
        investigation_id,
        "case_created",
        "Investigation created",
        f"Investigation opened for account {account_id}.",
        now,
    )

    add_investigation_evidence(
        connection,
        investigation_id,
        "Account profile",
        "Account activity snapshot",
        (
            f"Transactions: {int(related.shape[0])}. "
            f"Suspicious transactions: {int(related["is_laundering"].sum())}. "
            f"Total volume: {float(related["amount_received"].sum()):,.2f}."
        ),
        now,
    )

    account_scores = account_risk_frame()
    if account_scores is not None:
        match = account_scores[
            account_scores["account"].astype(str) == account_id
        ]
        if not match.empty:
            score = match.iloc[0]
            add_investigation_evidence(
                connection,
                investigation_id,
                "Risk signal",
                "Account risk indicators",
                (
                    f"Typology risk: {float(score.typology_risk):.2f}. "
                    f"Alert count: {int(score.alert_count)}. "
                    f"Signals: {score.reasons}."
                ),
                now,
            )

    connection.commit()

    row = connection.execute(
        "SELECT * FROM investigations WHERE id = ?",
        (investigation_id,),
    ).fetchone()

    connection.close()

    return investigation_record(row)


@app.get("/api/v1/investigations")
def list_investigations(account_id: str | None = None):
    connection = investigation_connection()

    if account_id:
        rows = connection.execute(
            """
            SELECT *
            FROM investigations
            WHERE account_id = ?
            ORDER BY updated_at DESC
            """,
            (account_id.strip(),),
        ).fetchall()
    else:
        rows = connection.execute(
            """
            SELECT *
            FROM investigations
            ORDER BY updated_at DESC
            """
        ).fetchall()

    connection.close()

    return [investigation_record(row) for row in rows]


@app.get("/api/v1/investigations/{investigation_id}")
def get_investigation(investigation_id: str):
    connection = investigation_connection()

    row = connection.execute(
        "SELECT * FROM investigations WHERE id = ?",
        (investigation_id,),
    ).fetchone()

    connection.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Investigation was not found",
        )

    return investigation_record(row)


@app.get("/api/v1/investigations/{investigation_id}/timeline")
def investigation_timeline(investigation_id: str):
    connection = investigation_connection()

    exists = connection.execute(
        "SELECT id FROM investigations WHERE id = ?",
        (investigation_id,),
    ).fetchone()

    if exists is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Investigation was not found",
        )

    rows = connection.execute(
        """
        SELECT *
        FROM investigation_events
        WHERE investigation_id = ?
        ORDER BY created_at DESC, id DESC
        """,
        (investigation_id,),
    ).fetchall()

    connection.close()

    return [investigation_event_record(row) for row in rows]


@app.get("/api/v1/investigations/{investigation_id}/evidence")
def investigation_evidence(investigation_id: str):
    connection = investigation_connection()

    exists = connection.execute(
        "SELECT id FROM investigations WHERE id = ?",
        (investigation_id,),
    ).fetchone()

    if exists is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Investigation was not found",
        )

    rows = connection.execute(
        """
        SELECT *
        FROM investigation_evidence
        WHERE investigation_id = ?
        ORDER BY created_at DESC, id DESC
        """,
        (investigation_id,),
    ).fetchall()

    connection.close()

    return [investigation_evidence_record(row) for row in rows]


@app.post("/api/v1/investigations/{investigation_id}/evidence")
def create_investigation_evidence(
    investigation_id: str,
    request: InvestigationEvidenceCreate,
):
    evidence_type = request.evidence_type.strip()
    title = request.title.strip()
    details = request.details.strip()

    if not evidence_type or not title or not details:
        raise HTTPException(
            status_code=400,
            detail="Evidence type, title, and details are required",
        )

    connection = investigation_connection()

    exists = connection.execute(
        "SELECT id FROM investigations WHERE id = ?",
        (investigation_id,),
    ).fetchone()

    if exists is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Investigation was not found",
        )

    now = datetime.now(timezone.utc).isoformat()

    add_investigation_evidence(
        connection,
        investigation_id,
        evidence_type,
        title,
        details,
        now,
    )

    add_investigation_event(
        connection,
        investigation_id,
        "evidence_added",
        "Evidence added",
        title,
        now,
    )

    connection.commit()

    row = connection.execute(
        """
        SELECT *
        FROM investigation_evidence
        WHERE investigation_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (investigation_id,),
    ).fetchone()

    connection.close()

    return investigation_evidence_record(row)


@app.patch("/api/v1/investigations/{investigation_id}")
def update_investigation(
    investigation_id: str,
    request: InvestigationUpdate,
):
    allowed_statuses = {
        "Open",
        "In Review",
        "Escalated",
        "Closed",
    }
    allowed_resolutions = {
        "Confirmed Suspicious",
        "False Positive",
        "Insufficient Evidence",
        "Other",
    }

    if request.status is not None and request.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid investigation status",
        )

    if (
        request.resolution is not None
        and request.resolution not in allowed_resolutions
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid investigation resolution",
        )

    connection = investigation_connection()

    existing = connection.execute(
        "SELECT * FROM investigations WHERE id = ?",
        (investigation_id,),
    ).fetchone()

    if existing is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Investigation was not found",
        )

    status = (
        request.status
        if request.status is not None
        else existing["status"]
    )

    notes = (
        request.notes
        if request.notes is not None
        else existing["notes"]
    )

    resolution = (
        request.resolution
        if request.resolution is not None
        else existing["resolution"]
    )

    resolution_notes = (
        request.resolution_notes
        if request.resolution_notes is not None
        else existing["resolution_notes"]
    )

    resolution = resolution.strip() if resolution else None
    resolution_notes = resolution_notes.strip()

    if status == "Closed":
        if resolution is None:
            connection.close()
            raise HTTPException(
                status_code=400,
                detail="A resolution is required before closing a case.",
            )

        if not resolution_notes:
            connection.close()
            raise HTTPException(
                status_code=400,
                detail="Resolution notes are required before closing a case.",
            )

    updated_at = datetime.now(timezone.utc).isoformat()

    if status != existing["status"]:
        add_investigation_event(
            connection,
            investigation_id,
            "status_change",
            "Case status changed",
            f"{existing['status']} → {status}",
            updated_at,
        )

    if notes != existing["notes"]:
        add_investigation_event(
            connection,
            investigation_id,
            "note_update",
            "Investigator notes updated",
            "Case notes were updated.",
            updated_at,
        )

    if resolution != existing["resolution"]:
        add_investigation_event(
            connection,
            investigation_id,
            "resolution",
            "Case resolution updated",
            (
                f"Resolution: {resolution}."
                if resolution
                else "Case resolution cleared."
            ),
            updated_at,
        )

    if (
        resolution_notes != existing["resolution_notes"]
        and resolution_notes
    ):
        add_investigation_event(
            connection,
            investigation_id,
            "resolution_note_update",
            "Resolution notes updated",
            "Case resolution notes were updated.",
            updated_at,
        )

    if status == "Closed" and existing["status"] != "Closed":
        add_investigation_event(
            connection,
            investigation_id,
            "case_closed",
            "Case closed",
            f"Case closed with resolution: {resolution}.",
            updated_at,
        )

    connection.execute(
        """
        UPDATE investigations
        SET
            status = ?,
            notes = ?,
            resolution = ?,
            resolution_notes = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            status,
            notes,
            resolution,
            resolution_notes,
            updated_at,
            investigation_id,
        ),
    )

    connection.commit()

    row = connection.execute(
        "SELECT * FROM investigations WHERE id = ?",
        (investigation_id,),
    ).fetchone()

    connection.close()

    return investigation_record(row)


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

@app.get("/api/v1/transaction/{transaction_id}")
def transaction(transaction_id: int):
    row = feature_store_row(transaction_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction feature record not found",
        )

    return row

@app.post("/api/v1/predict")
def predict(request: PredictionRequest):
    model = risk_model()

    if model is None:
        raise HTTPException(status_code=503, detail="Risk model is not available")

    features = pd.DataFrame(
        [[getattr(request, feature) for feature in MODEL_FEATURES]],
        columns=MODEL_FEATURES,
    )

    probability = float(model.predict_proba(features)[0, 1])

    status = model_status()
    threshold = float(status["metrics"]["selected_threshold"])

    return {
        "risk_probability": probability,
        "risk_score": round(probability * 100, 2),
        "threshold": threshold,
        "prediction": int(probability >= threshold),
    }

@app.post("/api/v1/transaction/{transaction_id}/predict")
def predict_transaction(transaction_id: int):
    model = risk_model()

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Risk model is not available",
        )

    row = feature_store_row(transaction_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction feature record not found",
        )

    metadata = transaction_metadata_row(transaction_id)

    if metadata is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction metadata not found",
        )

    features = pd.DataFrame(
        [[row[feature] for feature in MODEL_FEATURES]],
        columns=MODEL_FEATURES,
    )

    probability = float(model.predict_proba(features)[0, 1])

    booster = model.get_booster()

    contribution_matrix = booster.predict(
        xgb.DMatrix(
            features,
            feature_names=MODEL_FEATURES,
        ),
        pred_contribs=True,
    )

    contributions = contribution_matrix[0]

    explanation = []

    for index, feature in enumerate(MODEL_FEATURES):
        explanation.append(
            {
                "feature": feature,
                "value": float(row[feature]),
                "contribution": float(contributions[index]),
                "direction": (
                    "increases_risk"
                    if contributions[index] > 0
                    else "decreases_risk"
                    if contributions[index] < 0
                    else "neutral"
                ),
            }
        )

    explanation.sort(
        key=lambda item: abs(item["contribution"]),
        reverse=True,
    )

    status = model_status()
    threshold = float(status["metrics"]["selected_threshold"])

    return {
        "transaction": {
            "transaction_id": metadata["transaction_id"],
            "timestamp": metadata["timestamp"],
            "from_bank": metadata["from_bank"],
            "account": metadata["account"],
            "to_bank": metadata["to_bank"],
            "counterparty_account": metadata["counterparty_account"],
            "amount_received": metadata["amount_received"],
            "receiving_currency": metadata["receiving_currency"],
            "amount_paid": metadata["amount_paid"],
            "payment_currency": metadata["payment_currency"],
            "payment_format": metadata["payment_format"],
        },
        "risk": {
            "risk_probability": probability,
            "risk_score": round(probability * 100, 2),
            "threshold": threshold,
            "prediction": int(probability >= threshold),
        },
        "explanation": explanation,
    }

@app.get("/api/v1/transactions")
def transactions(
    query: str = "",
    suspicious_only: bool = False,
    limit: int = 100,
):
    frame = transaction_frame()

    if frame is None:
        return []

    result = frame.copy()

    if suspicious_only:
        result = result[result["is_laundering"] == 1]

    search = query.strip().lower()

    if search:
        searchable = (
            result["transaction_id"].astype(str)
            + " "
            + result["account"].astype(str)
            + " "
            + result["counterparty_account"].astype(str)
            + " "
            + result["receiving_currency"].astype(str)
            + " "
            + result["payment_format"].astype(str)
        )
        result = result[searchable.str.lower().str.contains(search, na=False)]

    result = result.sort_values(
        "transaction_id",
        ascending=False,
    ).head(max(1, min(limit, 500)))

    typologies = typology_frame()

    if typologies is not None:
        risk_columns = [
            column
            for column in [
                "transaction_id",
                "typology_risk",
                "typology_reasons",
            ]
            if column in typologies.columns
        ]

        if "transaction_id" in risk_columns:
            result = result.merge(
                typologies[risk_columns],
                on="transaction_id",
                how="left",
            )
        else:
            result["typology_risk"] = None
            result["typology_reasons"] = None
    else:
        result["typology_risk"] = None
        result["typology_reasons"] = None

    records = []

    for row in result.itertuples(index=False):
        risk = (
            float(row.typology_risk)
            if pd.notna(row.typology_risk)
            else 90.0 if int(row.is_laundering) == 1 else 0.0
        )

        pattern = (
            str(row.typology_reasons)
            if pd.notna(row.typology_reasons)
            else "Benchmark laundering transaction"
            if int(row.is_laundering) == 1
            else "No typology alert"
        )

        records.append(
            {
                "transaction_id": int(row.transaction_id),
                "timestamp": str(row.timestamp),
                "account": str(row.account),
                "counterparty": str(row.counterparty_account),
                "amount": float(row.amount_received),
                "currency": str(row.receiving_currency),
                "payment_format": str(row.payment_format),
                "risk": round(risk, 2),
                "suspicious": bool(int(row.is_laundering)),
                "pattern": pattern,
            }
        )

    return records

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
            "transaction_id": int(row.transaction_id),
            "account": str(row.account),
            "counterparty": str(row.counterparty_account),
            "amount": float(row.amount_received),
            "currency": str(row.receiving_currency),
            "risk": float(row.typology_risk),
            "pattern": str(row.typology_reasons),
        } for row in candidates.itertuples(index=False)]
    suspicious = frame[frame["is_laundering"] == 1].sort_values("amount_received", ascending=False).head(max(1, min(limit, 100)))
    return [{"id": f"AML-{int(row.transaction_id):06d}", "transaction_id": int(row.transaction_id), "account": str(row.account), "counterparty": str(row.counterparty_account), "amount": float(row.amount_received), "currency": str(row.receiving_currency), "risk": 90.0, "pattern": "Benchmark laundering transaction"} for row in suspicious.itertuples(index=False)]

@app.get("/api/v1/network")
def network(limit: int = 20):
    if not EDGES.exists():
        return {"nodes": [], "edges": []}
    edges = pd.read_csv(EDGES).sort_values(["suspicious_count", "total_amount"], ascending=False).head(max(1, min(limit, 100)))
    node_ids = sorted(set(edges["account"]).union(edges["counterparty_account"]))
    return {"nodes": [{"id": str(node), "label": str(node)} for node in node_ids], "edges": [{"source": str(row.account), "target": str(row.counterparty_account), "transactions": int(row.transaction_count), "amount": float(row.total_amount), "suspicious": int(row.suspicious_count)} for row in edges.itertuples(index=False)]}

@app.get("/api/v1/account/{account_id}/network")
def account_network(account_id: str, limit: int = 50):
    if not EDGES.exists():
        return {"account": account_id, "nodes": [], "edges": []}

    matching_chunks = []

    for chunk in pd.read_csv(EDGES, chunksize=100_000):
        matches = chunk[
            (chunk["account"].astype(str) == account_id)
            | (chunk["counterparty_account"].astype(str) == account_id)
        ]

        if not matches.empty:
            matching_chunks.append(matches)

    if not matching_chunks:
        raise HTTPException(
            status_code=404,
            detail=f"Account {account_id} is not present in the network",
        )

    edges = pd.concat(matching_chunks, ignore_index=True)

    edges = (
        edges.sort_values(
            ["suspicious_count", "total_amount"],
            ascending=False,
        )
        .head(max(1, min(limit, 100)))
    )

    node_ids = sorted(
        set(edges["account"]).union(
            edges["counterparty_account"]
        )
    )

    return {
        "account": account_id,
        "nodes": [
            {
                "id": str(node),
                "label": str(node),
            }
            for node in node_ids
        ],
        "edges": [
            {
                "source": str(row.account),
                "target": str(row.counterparty_account),
                "transactions": int(row.transaction_count),
                "amount": float(row.total_amount),
                "suspicious": int(row.suspicious_count),
            }
            for row in edges.itertuples(index=False)
        ],
    }

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
    
    account_graph = account_graph_frame()
    if account_graph is not None:
        match = account_graph[account_graph["account"].astype(str) == account_id]
        if not match.empty:
            graph = match.iloc[0]
            result["in_degree"] = int(graph.in_degree)
            result["out_degree"] = int(graph.out_degree)
            result["pagerank"] = float(graph.pagerank)

    return result

