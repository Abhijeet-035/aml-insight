from pathlib import Path
import json
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score, classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "processed" / "transactions.csv"
MODELS = ROOT / "models"


def main() -> None:
    frame = pd.read_csv(DATA)
    target = "is_laundering"
    if target not in frame.columns:
        raise ValueError(f"Missing {target} in {frame.columns.tolist()}")
    drop = [target, "transaction_id", "timestamp", "account", "counterparty_account"]
    X = frame.drop(columns=[column for column in drop if column in frame.columns])
    y = frame[target].astype(int)
    numeric = X.select_dtypes(include=["number"]).columns.tolist()
    categorical = X.select_dtypes(exclude=["number"]).columns.tolist()
    preprocessor = ColumnTransformer([
        ("num", SimpleImputer(strategy="median"), numeric),
        ("cat", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]), categorical),
    ])
    positive = max(int(y.sum()), 1)
    negative = max(len(y) - positive, 1)
    model = XGBClassifier(
        n_estimators=300,
        max_depth=7,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=negative / positive,
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        n_jobs=4,
    )
    pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    pipeline.fit(X_train, y_train)
    probabilities = pipeline.predict_proba(X_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    report = classification_report(y_test, predictions, output_dict=True)
    metrics = {
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
        "pr_auc": float(average_precision_score(y_test, probabilities)),
        "precision": float(report["1"]["precision"]),
        "recall": float(report["1"]["recall"]),
        "f1": float(report["1"]["f1-score"]),
        "test_rows": int(len(y_test)),
        "positive_rate": float(y.mean()),
    }
    MODELS.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODELS / "transaction_risk_xgb.joblib")
    (MODELS / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
