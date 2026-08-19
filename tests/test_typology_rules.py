import unittest

import pandas as pd

from ml.typology_rules import TypologyConfig, fit_config, score_typologies


def transactions() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "transaction_id": [0, 1, 2],
            "timestamp": ["2025-01-01 10:00:00", "2025-01-01 10:00:00", "2025-01-01 11:00:00"],
            "account": ["B", "A", "A"],
            "counterparty_account": ["A", "B", "B"],
            "amount_paid": [100.0, 100.0, 100.0],
            "payment_currency": ["USD", "USD", "USD"],
            "receiving_currency": ["USD", "USD", "USD"],
            "split": ["train", "train", "validation"],
        }
    )


class TypologyRuleTests(unittest.TestCase):
    def test_same_timestamp_is_not_used_as_history(self) -> None:
        scores = score_typologies(transactions(), TypologyConfig(high_value_threshold=1_000))
        self.assertEqual(scores.loc[1, "typology_risk"], 0)
        self.assertIn("Circular flow", scores.loc[2, "typology_reasons"])

    def test_config_uses_train_period_only(self) -> None:
        frame = transactions()
        frame.loc[2, "amount_paid"] = 1_000_000
        config = fit_config(frame)
        self.assertLess(config.high_value_threshold, 1_000)


if __name__ == "__main__":
    unittest.main()
