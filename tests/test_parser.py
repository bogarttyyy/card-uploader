import unittest
from pathlib import Path

from parser import (
    build_card_summary,
    build_reconciliation_rows,
    compute_balance,
    parse_statement_from_path,
)


ROOT = Path(__file__).resolve().parents[1]
STATEMENTS_DIR = ROOT / "statements"


class ParserFixtureTests(unittest.TestCase):
    EXPECTED = {
        "Statement_CRD9c58559b0ebf4c5a8d313f114865af1dd5032a0356e926bd83.pdf": {
            "due_date": "13 April 2026",
            "closing_balance": 3053.10,
            "card_numbers": ["7248", "8489"],
            "computed_balance": 3053.10,
            "card_totals": {"7248": 1239.57, "8489": 1813.53},
        },
        "Statement_CRDa949855fdeccc94518f2ed877c654f544c52013675f284edf2.pdf": {
            "due_date": "13 February 2026",
            "closing_balance": 4786.66,
            "card_numbers": ["7248", "8489"],
            "computed_balance": 4786.66,
            "card_totals": {"7248": 2093.69, "8489": 2692.97},
        },
        "Statement_CRDae837819c02a976187d6a772987a4f3b0f476f27a9cb6205fa.pdf": {
            "due_date": "13 January 2026",
            "closing_balance": 6981.85,
            "card_numbers": ["7248", "8489"],
            "computed_balance": 6981.85,
            "card_totals": {"7248": 4118.10, "8489": 2863.75},
        },
        "Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf": {
            "due_date": "16 March 2026",
            "closing_balance": 3575.18,
            "card_numbers": ["7248", "8489"],
            "computed_balance": 3575.18,
            "card_totals": {"7248": 2009.60, "8489": 1565.58},
        },
    }

    def test_sample_statements_match_expected_metadata_and_totals(self):
        for filename, expected in self.EXPECTED.items():
            with self.subTest(statement=filename):
                metadata, transactions = parse_statement_from_path(STATEMENTS_DIR / filename)
                self.assertEqual(metadata.minimum_due_date, expected["due_date"])
                self.assertEqual(metadata.card_numbers, expected["card_numbers"])
                self.assertAlmostEqual(metadata.closing_balance, expected["closing_balance"], places=2)
                self.assertAlmostEqual(
                    compute_balance(transactions, metadata.card_numbers),
                    expected["computed_balance"],
                    places=2,
                )

                actual_summaries = {
                    row.card_number: row.net_total
                    for row in build_card_summary(transactions, metadata.card_numbers)
                }
                self.assertEqual(actual_summaries, expected["card_totals"])

    def test_reconciliation_rows_have_zero_deltas_for_samples(self):
        for pdf_path in sorted(STATEMENTS_DIR.glob("*.pdf")):
            with self.subTest(statement=pdf_path.name):
                metadata, transactions = parse_statement_from_path(pdf_path)
                reconciliation_rows = build_reconciliation_rows(
                    metadata, transactions, metadata.card_numbers
                )
                deltas = {row.item: row.delta for row in reconciliation_rows}
                self.assertEqual(deltas["Purchases"], 0.0)
                self.assertEqual(deltas["Payments and Credits"], 0.0)
                self.assertEqual(deltas["Computed Closing Balance"], 0.0)


if __name__ == "__main__":
    unittest.main()
