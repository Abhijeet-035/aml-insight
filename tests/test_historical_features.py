import unittest

import pandas as pd

from ml.historical_features import build_historical_features


def transactions() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "transaction_id": [0, 1, 2, 3],
            "timestamp": ["2025-01-01 10:00:00", "2025-01-01 10:00:00", "2025-01-01 11:00:00", "2025-01-01 12:00:00"],
            "account": ["A", "A", "A", "B"],
            "counterparty_account": ["B", "C", "B", "A"],
            "amount_paid": [10.0, 20.0, 30.0, 40.0],
            "amount_received": [10.0, 20.0, 30.0, 40.0],
            "payment_currency": ["USD"] * 4,
            "receiving_currency": ["USD"] * 4,
            "is_laundering": [0, 1, 0, 1],
            "split": ["train", "train", "validation", "test"],
        }
    )


class HistoricalFeatureTests(unittest.TestCase):
    def test_history_excludes_current_timestamp(self) -> None:
        features = build_historical_features(transactions()).set_index("transaction_id")
        self.assertEqual(features.loc[0, "outgoing_prior_count"], 0)
        self.assertEqual(features.loc[1, "outgoing_prior_count"], 0)
        self.assertEqual(features.loc[2, "outgoing_prior_count"], 2)
        self.assertEqual(features.loc[2, "outgoing_prior_amount"], 30)
        self.assertEqual(features.loc[2, "pair_prior_count"], 1)

    def test_labels_do_not_change_features(self) -> None:
        source = transactions()
        altered = source.copy()
        altered["is_laundering"] = 1 - altered["is_laundering"]
        left = build_historical_features(source).drop(columns="is_laundering")
        right = build_historical_features(altered).drop(columns="is_laundering")
        pd.testing.assert_frame_equal(left, right)


if __name__ == "__main__":
    unittest.main()
