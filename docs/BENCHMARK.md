# AML benchmark protocol

AML Insight uses IBM's synthetic AML transaction benchmark as the primary evaluation dataset.

## Dataset

Use `HI-Small_Trans.csv` from the IBM AML-Data project. The raw dataset must stay outside Git and be placed at:

```text
data/raw/HI-Small_Trans.csv
```

## Preparation

Run:

```bash
python scripts/validate_dataset.py --input data/raw/HI-Small_Trans.csv
python scripts/prepare_benchmark.py
```

Preparation normalizes the IBM column names, validates numeric and label fields, sorts transactions by timestamp, assigns stable transaction IDs, and creates a chronological 60/20/20 train/validation/test split.

## Historical features and baseline

Build features after preparation:

```bash
python scripts/build_historical_features.py
python ml/train_baseline.py
```

The feature builder emits transaction amount/time/currency features plus prior outgoing, incoming, and account-pair transaction counts and volumes. Historical aggregates are calculated from timestamps **strictly earlier** than the transaction being scored; transactions at the same timestamp are not allowed to affect each other.

The XGBoost baseline trains only on the train period. It selects its operating threshold on the validation period, then reports PR-AUC, ROC-AUC, precision, recall, F1, and a confusion matrix on the held-out test period. The generated feature CSV, model file, and metrics JSON remain local-only.

## Explainable typology alerts

Run the rule engine after benchmark preparation:

```bash
python scripts/score_typologies.py
```

It writes local-only transaction alerts, account risk summaries, and the fitted rule configuration. The rules identify fan-in, fan-out, rapid movement, structuring, cross-currency layering, reciprocal/circular flows, and high-value transfers. Each reason is tied to the observed historical activity. Rule thresholds are fitted from the train period only, and transactions sharing a timestamp are scored before any are added to history.

## Leakage policy

The benchmark must not randomly mix future transactions into training. Features that depend on transaction history must be computed using information available at or before the transaction timestamp. Model selection is performed on the validation period and final metrics are reported only on the held-out test period.

## Metrics

Because laundering transactions are highly imbalanced, report:

- PR-AUC as the primary ranking metric
- ROC-AUC as a secondary metric
- precision
- recall
- F1
- confusion matrix at the selected operating threshold

Do not report demo-data metrics as benchmark performance.

## Reproducibility

`prepare_benchmark.py` writes `data/processed/benchmark_metadata.json`, including the source file SHA-256, row counts, time range, split counts, and laundering count. Generated data and model artifacts are ignored by Git.
