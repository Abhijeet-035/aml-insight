from __future__ import annotations

import argparse
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.historical_features import build_historical_features


def main() -> None:
    parser = argparse.ArgumentParser(description="Build leakage-safe historical AML features.")
    parser.add_argument("--input", type=Path, default=ROOT / "data/processed/transactions.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "data/processed/historical_features.csv")
    args = parser.parse_args()
    features = build_historical_features(pd.read_csv(args.input))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    features.to_csv(args.output, index=False)
    print(f"Built {len(features):,} leakage-safe feature rows at {args.output}")


if __name__ == "__main__":
    main()
