# AML Insight

AML Insight is a transaction-network analysis platform for anti-money-laundering investigations. It combines transaction-level machine learning, graph analytics, suspicious-pattern detection, and an analyst-focused investigation UI.

## Data

The project is designed around IBM's synthetic AML benchmark. The dataset is not committed to this repository. Download it separately and place `HI-Small_Trans.csv` under `data/raw/`.

IBM states that the data is synthetic and includes a laundering label for transactions. The actual dataset is released under CDLA-Sharing-1.0.

Source: https://github.com/IBM/AML-Data

## Architecture

- `apps/web`: Next.js analyst console
- `services/api`: FastAPI service
- `ml`: model training and inference code
- `scripts`: data preparation, validation, and graph utilities
- `data`: local-only dataset and generated artifacts

## Current milestone

The dashboard is now connected to the FastAPI data contract. When processed transaction data exists locally, the API calculates transaction count, observed laundering count/rate, suspicious volume, graph node count, alert records, network edges, and account summaries. Without local data, the UI stays in clearly labelled demo mode.

A transaction explorer is available at `/transactions`. The dataset validator is available through `scripts/validate_dataset.py` and the development roadmap is in `docs/ROADMAP.md`.

The XGBoost baseline uses leakage-safe historical features and chronological train/validation/test evaluation. Generated feature files, model artifacts, and benchmark metrics are intentionally excluded from Git. Reported benchmark metrics will only be produced from the IBM HI-Small dataset, not from the demo generator.

## Local development

Generate local demo data:

```bash
python scripts/generate_demo_data.py
python scripts/prepare_data.py
python scripts/build_graph.py
```

Validate the IBM dataset:

```bash
python scripts/validate_dataset.py
python scripts/prepare_benchmark.py
python scripts/build_historical_features.py
python ml/train_baseline.py
python scripts/score_typologies.py
```

Frontend:

```bash
cd apps/web
npm install
npm run dev
```

Backend:

```bash
cd services/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:3000` for the command center and `http://localhost:3000/transactions` for the transaction explorer.

## Planned milestones

1. IBM HI-Small benchmark ingestion and profiling
2. Temporal leakage-safe model evaluation
3. AML typology/rule engine
4. Interactive graph investigation
5. GraphSAGE/GAT/RGCN comparison
6. Explainable risk scoring
7. Investigation cases and audit trail
8. PostgreSQL persistence and production deployment
