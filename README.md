# AML Insight

AML Insight is a transaction-network analysis platform for anti-money-laundering investigations. It combines transaction-level machine learning, graph analytics, suspicious-pattern detection, and an analyst-focused investigation UI.

## Data

The project is designed around IBM's synthetic AML benchmark. The dataset is not committed to this repository. Download it separately and place the transaction CSV under `data/raw/`.

IBM states that the data is synthetic and includes a laundering label for transactions. The dataset is released under CDLA-Sharing-1.0.

Sources:
- https://github.com/IBM/AML-Data
- https://research.ibm.com/publications/realistic-synthetic-financial-transactions-for-anti-money-laundering-models

## Architecture

- `apps/web`: Next.js analyst console
- `services/api`: FastAPI service
- `ml`: model training and inference code
- `scripts`: data preparation utilities
- `data`: local-only dataset and generated artifacts

## Development status

The current milestone establishes the application shell, API contract, data preparation pipeline, graph feature pipeline, and XGBoost baseline. A small synthetic demo generator is included only for local development; it must not be used as the reported benchmark. The production benchmark is the IBM HI-Small dataset.

Planned milestones add the IBM dataset pipeline, graph neural network model, explainability, investigation workflows, and production deployment.

## Local development

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
