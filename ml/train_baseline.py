"""Chronological XGBoost baseline for leakage-safe AML features."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[1]
TARGET = "is_laundering"
METADATA_COLUMNS = {"transaction_id", "timestamp", "split", TARGET}


def select_threshold(y_true: pd.Series, probabilities: np.ndarray) -> float:
    """Select the F1-maximising threshold solely on validation data."""
    candidates = np.unique(np.r_[0.0, probabilities, 1.0])
    scores = [f1_score(y_true, probabilities >= threshold, zero_division=0) for threshold in candidates]
    return float(candidates[int(np.argmax(scores))])


def metrics(y_true: pd.Series, probabilities: np.ndarray, threshold: float) -> dict[str, object]:
    predictions = (probabilities >= threshold).astype(int)
    return {
        "pr_auc": float(average_precision_score(y_true, probabilities)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "precision": float(precision_score(y_true, predictions, zero_division=0)),
        "recall": float(recall_score(y_true, predictions, zero_division=0)),
        "f1": float(f1_score(y_true, predictions, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, predictions, labels=[0, 1]).tolist(),
        "rows": int(len(y_true)),
        "positive_rows": int(y_true.sum()),
    }


def train(features: pd.DataFrame) -> tuple[XGBClassifier, dict[str, object]]:
    missing = {TARGET, "split"}.difference(features.columns)
    if missing:
        raise ValueError(f"Missing required feature columns: {sorted(missing)}")
    feature_columns = [column for column in features.columns if column not in METADATA_COLUMNS]
    splits = {name: features.loc[features["split"] == name] for name in ("train", "validation", "test")}
    if any(part.empty for part in splits.values()):
        raise ValueError("Features must contain non-empty train, validation, and test splits")
    if any(part[TARGET].nunique() != 2 for part in splits.values()):
        raise ValueError("Each chronological split must contain both classes for baseline evaluation")

    y_train = splits["train"][TARGET].astype(int)
    negative = max(int((y_train == 0).sum()), 1)
    positive = max(int((y_train == 1).sum()), 1)
    model = XGBClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.05, subsample=0.85,
        colsample_bytree=0.85, scale_pos_weight=negative / positive,
        objective="binary:logistic", eval_metric="aucpr", tree_method="hist",
        n_jobs=4, random_state=42,
    )
    model.fit(splits["train"][feature_columns], y_train)
    validation_probabilities = model.predict_proba(splits["validation"][feature_columns])[:, 1]
    threshold = select_threshold(splits["validation"][TARGET].astype(int), validation_probabilities)
    test_probabilities = model.predict_proba(splits["test"][feature_columns])[:, 1]
    return model, {
        "evaluation_policy": "chronological train/validation/test; threshold selected on validation only",
        "feature_columns": feature_columns,
        "selected_threshold": threshold,
        "validation": metrics(splits["validation"][TARGET].astype(int), validation_probabilities, threshold),
        "test": metrics(splits["test"][TARGET].astype(int), test_probabilities, threshold),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train chronological XGBoost AML baseline.")
    parser.add_argument("--features", type=Path, default=ROOT / "data/processed/historical_features.csv")
    parser.add_argument("--model-output", type=Path, default=ROOT / "models/transaction_risk_xgb.joblib")
    parser.add_argument("--metrics-output", type=Path, default=ROOT / "models/metrics.json")
    parser.add_argument("--no-model", action="store_true", help="Do not write a model artifact.")
    args = parser.parse_args()
    model, report = train(pd.read_csv(args.features))
    args.metrics_output.parent.mkdir(parents=True, exist_ok=True)
    args.metrics_output.write_text(json.dumps(report, indent=2) + "\n")
    if not args.no_model:
        args.model_output.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, args.model_output)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
