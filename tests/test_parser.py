from io import StringIO
import unittest
from pathlib import Path

import pandas as pd

from parser import (
    build_card_summary,
    build_reconciliation_rows,
    compute_balance,
    get_transactions_for_card,
    parse_statement_from_path,
    transactions_to_export_rows,
)
from ui import build_csv_data


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

    def test_export_rows_use_iso_dates_and_negative_credit_amounts(self):
        pdf_path = STATEMENTS_DIR / "Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf"
        metadata, transactions = parse_statement_from_path(pdf_path)
        export_rows = transactions_to_export_rows(transactions, metadata)

        first_row = export_rows[0]
        self.assertEqual(first_row["Date"], "2026-01-23")

        credit_row = next(
            row
            for row in export_rows
            if row["Description"] == "eBay O*20-14219-98730 Sydney"
            and row["Amount (AUD)"] < 0
        )
        self.assertEqual(credit_row["Date"], "2026-02-14")
        self.assertEqual(credit_row["Amount (AUD)"], -4.22)

    def test_per_card_csv_export_excludes_bpay_and_keeps_negative_credits(self):
        pdf_path = STATEMENTS_DIR / "Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf"
        metadata, transactions = parse_statement_from_path(pdf_path)
        card_transactions = get_transactions_for_card(transactions, "8489")

        csv_bytes = build_csv_data(card_transactions, metadata)
        csv_df = pd.read_csv(StringIO(csv_bytes.decode("utf-8")))

        self.assertNotIn("BPAY PAYMENT - THANK YOU", " ".join(csv_df["Description"].tolist()))
        negative_credit = csv_df.loc[
            csv_df["Description"] == "eBay O*20-14219-98730 Sydney", "Amount (AUD)"
        ].min()
        self.assertEqual(negative_credit, -4.22)

    def test_combined_csv_export_contains_both_cards(self):
        pdf_path = STATEMENTS_DIR / "Statement_CRD9c58559b0ebf4c5a8d313f114865af1dd5032a0356e926bd83.pdf"
        metadata, transactions = parse_statement_from_path(pdf_path)
        combined_transactions = [transaction for transaction in transactions if not transaction.is_payment]

        csv_bytes = build_csv_data(combined_transactions, metadata)
        csv_df = pd.read_csv(StringIO(csv_bytes.decode("utf-8")))

        self.assertEqual(sorted(csv_df["Card Number"].astype(str).unique().tolist()), ["7248", "8489"])
        self.assertTrue((csv_df["Date"].str.match(r"\d{4}-\d{2}-\d{2}")).all())


if __name__ == "__main__":
    unittest.main()
