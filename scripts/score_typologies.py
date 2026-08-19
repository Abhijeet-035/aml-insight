from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.typology_rules import account_risk_summary, fit_config, score_typologies


def main() -> None:
    parser = argparse.ArgumentParser(description="Build explainable, point-in-time AML typology alerts.")
    parser.add_argument("--input", type=Path, default=ROOT / "data/processed/transactions.csv")
    parser.add_argument("--alerts-output", type=Path, default=ROOT / "data/processed/typology_alerts.csv")
    parser.add_argument("--accounts-output", type=Path, default=ROOT / "data/processed/account_risk_scores.csv")
    parser.add_argument("--config-output", type=Path, default=ROOT / "data/processed/typology_config.json")
    args = parser.parse_args()

    transactions = pd.read_csv(args.input)
    config = fit_config(transactions)
    scores = score_typologies(transactions, config)
    args.alerts_output.parent.mkdir(parents=True, exist_ok=True)
    scores.to_csv(args.alerts_output, index=False)
    account_risk_summary(scores).to_csv(args.accounts_output, index=False)
    args.config_output.write_text(json.dumps(config.to_dict(), indent=2) + "\n")
    print(f"Scored {len(scores):,} transactions; {int((scores['typology_risk'] > 0).sum()):,} typology alerts")


if __name__ == "__main__":
    main()
