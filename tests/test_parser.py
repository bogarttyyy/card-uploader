from io import StringIO
import unittest
from datetime import date
from pathlib import Path

import pandas as pd

from parser import (
    StatementMetadata,
    Transaction,
    build_card_summary,
    build_reconciliation_rows,
    compute_balance,
    get_transactions_for_card,
    get_statement_metadata,
    normalize_transaction_date,
    parse_transaction_pages,
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


class ParserUnitTests(unittest.TestCase):
    def test_get_statement_metadata_extracts_expected_fields_from_text(self):
        sample_text = """
Statement period 20/01/26-19/02/26
Closing balance $3,575.18
Minimum payment due date 16/03/26
Opening balance $4,786.66
Payments and credits $4,790.88 CR
Purchases $3,579.40
Account number XXXX XXXX XXXX 7248
Card no. XXXX XXXX XXXX 8489
"""
        metadata = get_statement_metadata(sample_text)

        self.assertEqual(metadata.primary_card, "7248")
        self.assertEqual(metadata.card_numbers, ["7248", "8489"])
        self.assertEqual(metadata.minimum_due_date, "16 March 2026")
        self.assertEqual(metadata.closing_balance, 3575.18)
        self.assertEqual(metadata.purchases_total, 3579.40)
        self.assertEqual(metadata.payments_and_credits, 4790.88)

    def test_parse_transaction_pages_skips_reference_and_foreign_currency_lines(self):
        page_texts = [
            """Account No. XXXX XXXX XXXX 7248 Statement period 20/01/26-19/02/26
DATE TRANSACTION DETAILS AMOUNT $
Jan 23 OPENAI *CHATGPT SUBSCR OPENAI.COM CA 31.86
24492166034100017590151
US DOLLAR 22.00
Jan 24 BPAY PAYMENT - THANK YOU - 2,692.97 CR
74984166043050019006582
DATE TRANSACTION DETAILS Card no. XXXX XXXX XXXX 8489 AMOUNT $
Feb 14 eBay O*20-14219-98730 Sydney 4.22 CR
74773886045001083297082
Continued over page..
"""
        ]

        transactions = parse_transaction_pages(page_texts, "7248")

        self.assertEqual(len(transactions), 3)
        self.assertEqual(transactions[0].description, "OPENAI *CHATGPT SUBSCR OPENAI.COM CA")
        self.assertFalse(transactions[0].is_credit)
        self.assertTrue(transactions[1].is_payment)
        self.assertEqual(transactions[2].card_number, "8489")
        self.assertTrue(transactions[2].is_credit)

    def test_normalize_transaction_date_handles_statement_year_boundary(self):
        metadata = StatementMetadata(
            closing_balance=None,
            opening_balance=None,
            payments_and_credits=None,
            purchases_total=None,
            statement_period_start=date(2025, 12, 20),
            statement_period_end=date(2026, 1, 19),
            statement_from="20 December 2025",
            statement_to="19 January 2026",
            minimum_due_date=None,
            primary_card="7248",
            card_numbers=["7248"],
        )

        self.assertEqual(normalize_transaction_date("Dec 31", metadata), "2025-12-31")
        self.assertEqual(normalize_transaction_date("Jan 01", metadata), "2026-01-01")

    def test_reconciliation_rows_support_synthetic_transactions(self):
        metadata = StatementMetadata(
            closing_balance=80.0,
            opening_balance=100.0,
            payments_and_credits=70.0,
            purchases_total=50.0,
            statement_period_start=date(2026, 1, 20),
            statement_period_end=date(2026, 2, 19),
            statement_from="20 January 2026",
            statement_to="19 February 2026",
            minimum_due_date=None,
            primary_card="7248",
            card_numbers=["7248"],
        )
        transactions = [
            Transaction("7248", "Jan 21", "Merchant A", 50.0, False, False),
            Transaction("7248", "Jan 22", "Refund", 20.0, True, False),
            Transaction("7248", "Jan 23", "BPAY PAYMENT - THANK YOU -", 50.0, True, True),
        ]

        rows = build_reconciliation_rows(metadata, transactions, metadata.card_numbers)
        deltas = {row.item: row.delta for row in rows}

        self.assertEqual(deltas["Purchases"], 0.0)
        self.assertEqual(deltas["Payments and Credits"], 0.0)
        self.assertEqual(deltas["Computed Closing Balance"], 0.0)

    def test_transactions_to_export_rows_returns_empty_for_no_transactions(self):
        metadata = StatementMetadata(
            closing_balance=None,
            opening_balance=None,
            payments_and_credits=None,
            purchases_total=None,
            statement_period_start=date(2026, 1, 20),
            statement_period_end=date(2026, 2, 19),
            statement_from="20 January 2026",
            statement_to="19 February 2026",
            minimum_due_date=None,
            primary_card=None,
            card_numbers=[],
        )

        self.assertEqual(transactions_to_export_rows([], metadata), [])


if __name__ == "__main__":
    unittest.main()
