"""Train a chronological XGBoost baseline for AML transaction risk scoring."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from xgboost import XGBClassifier


ROOT = Path(__file__).resolve().parents[1]

FEATURE_DTYPES = {
    "transaction_id": "int32",
    "split": "category",
    "is_laundering": "int8",
    "amount_paid": "float32",
    "amount_received": "float32",
    "log_amount_paid": "float32",
    "log_amount_received": "float32",
    "amount_delta": "float32",
    "amount_ratio": "float32",
    "hour": "int8",
    "day_of_week": "int8",
    "is_cross_currency": "int8",
    "outgoing_prior_count": "int32",
    "outgoing_prior_amount": "float32",
    "incoming_prior_count": "int32",
    "incoming_prior_amount": "float32",
    "pair_prior_count": "int32",
    "pair_prior_amount": "float32",
}

FEATURE_COLUMNS = [
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


def select_f1_threshold(y_true: np.ndarray, probabilities: np.ndarray) -> tuple[float, float]:
    order = np.argsort(-probabilities)
    sorted_probabilities = probabilities[order]
    sorted_labels = y_true[order]

    true_positives = np.cumsum(sorted_labels)
    false_positives = np.cumsum(1 - sorted_labels)
    total_positives = true_positives[-1]

    false_negatives = total_positives - true_positives

    precision = true_positives / np.maximum(true_positives + false_positives, 1)
    recall = true_positives / np.maximum(true_positives + false_negatives, 1)

    f1 = 2 * precision * recall / np.maximum(precision + recall, 1e-12)

    best_index = int(np.argmax(f1))

    threshold = float(sorted_probabilities[best_index])
    best_f1 = float(f1[best_index])

    return threshold, best_f1


def calculate_metrics(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    threshold: float,
) -> dict:
    predictions = (probabilities >= threshold).astype(int)

    return {
        "pr_auc": float(average_precision_score(y_true, probabilities)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "precision": float(
            precision_score(y_true, predictions, zero_division=0)
        ),
        "recall": float(
            recall_score(y_true, predictions, zero_division=0)
        ),
        "f1": float(
            f1_score(y_true, predictions, zero_division=0)
        ),
        "confusion_matrix": confusion_matrix(
            y_true,
            predictions,
            labels=[0, 1],
        ).tolist(),
        "rows": int(len(y_true)),
        "positive_rows": int(y_true.sum()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train a chronological XGBoost AML transaction risk model."
    )

    parser.add_argument(
        "--features",
        type=Path,
        default=ROOT / "data/processed/historical_features.csv",
    )

    parser.add_argument(
        "--model-output",
        type=Path,
        default=ROOT / "models/transaction_risk_xgb.joblib",
    )

    parser.add_argument(
        "--metrics-output",
        type=Path,
        default=ROOT / "models/metrics.json",
    )

    args = parser.parse_args()

    print("[1/6] Loading historical features...")

    features = pd.read_csv(
        args.features,
        usecols=FEATURE_DTYPES.keys(),
        dtype=FEATURE_DTYPES,
    )

    print(
        f"[1/6] Loading completed: "
        f"{len(features):,} rows "
        f"({features.memory_usage(deep=True).sum() / 1024**2:.2f} MB)"
    )

    print("[2/6] Preparing chronological splits...")

    train = features[features["split"] == "train"].copy()
    validation = features[features["split"] == "validation"].copy()
    test = features[features["split"] == "test"].copy()

    y_train = train["is_laundering"].astype(int).to_numpy()
    y_validation = validation["is_laundering"].astype(int).to_numpy()
    y_test = test["is_laundering"].astype(int).to_numpy()

    positive = int(y_train.sum())
    negative = int(len(y_train) - positive)

    scale_pos_weight = negative / positive

    print(
        f"[2/6] Dataset prepared: "
        f"train={len(train):,}, "
        f"validation={len(validation):,}, "
        f"test={len(test):,}"
    )

    print(
        f"[2/6] Class weight: "
        f"scale_pos_weight={scale_pos_weight:.2f}"
    )

    print("[3/6] Model training started...")

    model = XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos_weight,
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        n_jobs=4,
        random_state=42,
        early_stopping_rounds=10,
    )

    model.fit(
        train[FEATURE_COLUMNS],
        y_train,
        eval_set=[
            (
                validation[FEATURE_COLUMNS],
                y_validation,
            )
        ],
        verbose=False,
    )

    print(
        f"[3/6] Model training completed: "
        f"{model.best_iteration + 1} trees used"
    )

    print("[4/6] Selecting validation threshold...")

    validation_probabilities = model.predict_proba(
        validation[FEATURE_COLUMNS]
    )[:, 1]

    threshold, validation_f1 = select_f1_threshold(
        y_validation,
        validation_probabilities,
    )

    print(
        f"[4/6] Validation completed: "
        f"threshold={threshold:.6f}, "
        f"F1={validation_f1:.6f}"
    )

    print("[5/6] Evaluating test set...")

    test_probabilities = model.predict_proba(
        test[FEATURE_COLUMNS]
    )[:, 1]

    validation_metrics = calculate_metrics(
        y_validation,
        validation_probabilities,
        threshold,
    )

    test_metrics = calculate_metrics(
        y_test,
        test_probabilities,
        threshold,
    )

    print(
        f"[5/6] Test evaluation completed: "
        f"PR-AUC={test_metrics['pr_auc']:.6f}, "
        f"ROC-AUC={test_metrics['roc_auc']:.6f}, "
        f"F1={test_metrics['f1']:.6f}"
    )

    report = {
        "evaluation_policy": (
            "chronological train/validation/test; "
            "threshold selected on validation only"
        ),
        "model": {
            "type": "XGBClassifier",
            "n_estimators": 100,
            "max_depth": 5,
            "learning_rate": 0.05,
            "subsample": 0.85,
            "colsample_bytree": 0.85,
            "early_stopping_rounds": 10,
            "best_iteration": int(model.best_iteration),
            "scale_pos_weight": float(scale_pos_weight),
            "random_state": 42,
        },
        "feature_columns": FEATURE_COLUMNS,
        "selected_threshold": threshold,
        "validation": validation_metrics,
        "test": test_metrics,
    }

    print("[6/6] Saving model and metrics...")

    args.model_output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    args.metrics_output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    joblib.dump(
        model,
        args.model_output,
    )

    args.metrics_output.write_text(
        json.dumps(report, indent=2) + "\n"
    )

    print("[6/6] Saving completed.")
    print(f"Model: {args.model_output}")
    print(f"Metrics: {args.metrics_output}")

    print("\nFinal report:")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()