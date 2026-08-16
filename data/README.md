# Dataset

The primary dataset is IBM's synthetic Anti-Money Laundering benchmark.

Source: https://github.com/IBM/AML-Data
Kaggle mirror: https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml

Place `HI-Small_Trans.csv` in `data/raw/` locally. Dataset files are excluded from Git. The pipeline writes CSV artifacts by default so the project can run without optional Parquet engines.

IBM states that the repository is Apache-2.0 while the actual dataset is released under CDLA-Sharing-1.0.
