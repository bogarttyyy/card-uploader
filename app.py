import re
from datetime import datetime

import pandas as pd
import pdfplumber
import streamlit as st


TRANSACTION_LINE_RE = re.compile(
    r"^(?P<date>[A-Za-z]{3}\s+\d{1,2})\s+"
    r"(?P<description>.+?)\s+"
    r"(?P<amount>\d{1,3}(?:,\d{3})*\.\d{2})"
    r"(?:\s+(?P<credit>CR))?$"
)
MAIN_HEADER_RE = re.compile(r"^DATE TRANSACTION DETAILS AMOUNT \$$")
CARD_HEADER_RE = re.compile(
    r"^DATE TRANSACTION DETAILS Card no\. XXXX XXXX XXXX (?P<card>\d{4}) AMOUNT \$$"
)
CARD_NUMBER_RE = re.compile(r"Card no\. XXXX XXXX XXXX (\d{4})")
ACCOUNT_NUMBER_RE = re.compile(r"Account number XXXX XXXX XXXX (\d{4})")
ACCOUNT_HEADER_RE = re.compile(r"Account No\. XXXX XXXX XXXX (\d{4})")
STATEMENT_PERIOD_RE = re.compile(
    r"Statement period\s+(?P<from>\d{2}/\d{2}/\d{2})-(?P<to>\d{2}/\d{2}/\d{2})"
)
MINIMUM_DUE_DATE_RE = re.compile(r"Minimum payment due date\s+(\d{2}/\d{2}/\d{2})")
OPENING_BALANCE_RE = re.compile(r"Opening balance\s*\$([\d,]+\.\d{2})")
PAYMENTS_AND_CREDITS_RE = re.compile(r"Payments and credits\s*\$([\d,]+\.\d{2})\s*CR")
PURCHASES_RE = re.compile(r"Purchases\s*\$([\d,]+\.\d{2})")
REFERENCE_NUMBER_RE = re.compile(r"^\d{14,}$")
FOREIGN_CURRENCY_RE = re.compile(r"^[A-Z][A-Z ]+\s+\d[\d,]*\.\d{2}$")


def extract_pdf_text(uploaded_file):
    page_texts = []
    with pdfplumber.open(uploaded_file) as pdf:
        for page in pdf.pages:
            page_texts.append(page.extract_text() or "")
    return page_texts, "\n".join(page_texts)


def parse_amount(value):
    return float(value.replace(",", ""))


def format_statement_date(value):
    if not value:
        return None
    return datetime.strptime(value, "%d/%m/%y").strftime("%d %B %Y")


def get_statement_metadata(full_text):
    closing_balance_match = re.search(r"Closing balance\s*\$([\d,]+\.\d{2})", full_text)
    closing_balance = (
        parse_amount(closing_balance_match.group(1)) if closing_balance_match else None
    )
    opening_balance_match = OPENING_BALANCE_RE.search(full_text)
    opening_balance = (
        parse_amount(opening_balance_match.group(1)) if opening_balance_match else None
    )
    payments_and_credits_match = PAYMENTS_AND_CREDITS_RE.search(full_text)
    payments_and_credits = (
        parse_amount(payments_and_credits_match.group(1))
        if payments_and_credits_match
        else None
    )
    purchases_match = PURCHASES_RE.search(full_text)
    purchases_total = parse_amount(purchases_match.group(1)) if purchases_match else None
    statement_period_match = STATEMENT_PERIOD_RE.search(full_text)
    statement_from = (
        statement_period_match.group("from") if statement_period_match else None
    )
    statement_to = statement_period_match.group("to") if statement_period_match else None
    minimum_due_date_match = MINIMUM_DUE_DATE_RE.search(full_text)
    minimum_due_date = (
        minimum_due_date_match.group(1) if minimum_due_date_match else None
    )

    primary_card_match = ACCOUNT_NUMBER_RE.search(full_text)
    primary_card = primary_card_match.group(1) if primary_card_match else None

    card_numbers = []
    if primary_card:
        card_numbers.append(primary_card)

    for card in CARD_NUMBER_RE.findall(full_text):
        if card not in card_numbers:
            card_numbers.append(card)

    return {
        "closing_balance": closing_balance,
        "opening_balance": opening_balance,
        "payments_and_credits": payments_and_credits,
        "purchases_total": purchases_total,
        "statement_from": format_statement_date(statement_from),
        "statement_to": format_statement_date(statement_to),
        "minimum_due_date": format_statement_date(minimum_due_date),
        "primary_card": primary_card,
        "card_numbers": card_numbers,
    }


def parse_transaction_pages(page_texts, primary_card):
    transactions = []

    for page_text in page_texts:
        if "DATE TRANSACTION DETAILS" not in page_text:
            continue

        current_card = None

        for raw_line in page_text.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            card_header_match = CARD_HEADER_RE.match(line)
            if card_header_match:
                current_card = card_header_match.group("card")
                continue

            if MAIN_HEADER_RE.match(line):
                current_card = primary_card
                continue

            if line.startswith("Customer service"):
                break

            if line.startswith("Closing balance $"):
                break

            if line.startswith("Continued over page.."):
                break

            if current_card is None:
                continue

            if ACCOUNT_HEADER_RE.match(line):
                continue

            if line.startswith("Page "):
                continue

            if REFERENCE_NUMBER_RE.match(line):
                continue

            if FOREIGN_CURRENCY_RE.match(line):
                continue

            transaction_match = TRANSACTION_LINE_RE.match(line)
            if not transaction_match:
                continue

            description = " ".join(transaction_match.group("description").split())
            amount = parse_amount(transaction_match.group("amount"))
            is_credit = bool(transaction_match.group("credit"))
            is_payment = description.upper().startswith("BPAY PAYMENT - THANK YOU")

            transactions.append(
                {
                    "Card Number": current_card,
                    "Date": transaction_match.group("date"),
                    "Description": description,
                    "Amount (AUD)": amount,
                    "Is Credit": is_credit,
                    "Is Payment": is_payment,
                }
            )

    return transactions


def get_transactions_for_card(transactions, selected_card):
    rows = []
    for transaction in transactions:
        if transaction["Card Number"] != selected_card:
            continue
        if transaction["Is Payment"]:
            continue
        rows.append(
            [
                transaction["Card Number"],
                transaction["Date"],
                transaction["Description"],
                transaction["Amount (AUD)"],
                transaction["Is Credit"],
            ]
        )
    return rows


def compute_balance(transactions, card_numbers):
    total = 0.0
    for card_number in card_numbers:
        total += compute_card_total(transactions, card_number)
    return total


def compute_card_total(transactions, selected_card):
    total = 0.0
    for transaction in transactions:
        if transaction["Card Number"] != selected_card:
            continue
        if transaction["Is Payment"]:
            continue
        amount = transaction["Amount (AUD)"]
        if transaction["Is Credit"]:
            total -= amount
        else:
            total += amount
    return total


def summarize_card(transactions, selected_card):
    purchases = 0.0
    credits = 0.0
    payments = 0.0
    for transaction in transactions:
        if transaction["Card Number"] != selected_card:
            continue
        amount = transaction["Amount (AUD)"]
        if transaction["Is Payment"]:
            payments += amount
        elif transaction["Is Credit"]:
            credits += amount
        else:
            purchases += amount
    return {
        "Card Number": selected_card,
        "Purchases": round(purchases, 2),
        "Credits": round(credits, 2),
        "Excluded BPAY": round(payments, 2),
        "Net Total": round(purchases - credits, 2),
    }


def build_card_summary(transactions, card_numbers):
    return [summarize_card(transactions, card_number) for card_number in card_numbers]


def build_reconciliation_rows(metadata, transactions, card_numbers):
    parsed_purchases = 0.0
    parsed_credits = 0.0
    parsed_payments = 0.0
    for summary in build_card_summary(transactions, card_numbers):
        parsed_purchases += summary["Purchases"]
        parsed_credits += summary["Credits"]
        parsed_payments += summary["Excluded BPAY"]

    parsed_payments_and_credits = parsed_credits + parsed_payments

    rows = []
    entries = [
        ("Opening Balance", metadata["opening_balance"], metadata["opening_balance"]),
        ("Purchases", metadata["purchases_total"], parsed_purchases),
        ("Payments and Credits", metadata["payments_and_credits"], parsed_payments_and_credits),
        ("Closing Balance", metadata["closing_balance"], metadata["closing_balance"]),
    ]

    for label, statement_value, parsed_value in entries:
        rows.append(
            {
                "Item": label,
                "Statement": statement_value,
                "Parsed": parsed_value,
                "Delta": None
                if statement_value is None or parsed_value is None
                else round(parsed_value - statement_value, 2),
            }
        )

    computed_closing = None
    if (
        metadata["opening_balance"] is not None
        and parsed_purchases is not None
        and parsed_payments_and_credits is not None
    ):
        computed_closing = (
            metadata["opening_balance"] + parsed_purchases - parsed_payments_and_credits
        )

    rows.append(
        {
            "Item": "Computed Closing Balance",
            "Statement": metadata["closing_balance"],
            "Parsed": None if computed_closing is None else round(computed_closing, 2),
            "Delta": None
            if metadata["closing_balance"] is None or computed_closing is None
            else round(computed_closing - metadata["closing_balance"], 2),
        }
    )
    return rows


def get_excluded_transactions_for_card(transactions, selected_card):
    excluded_rows = []
    for transaction in transactions:
        if transaction["Card Number"] != selected_card:
            continue
        if not transaction["Is Payment"]:
            continue
        excluded_rows.append(
            {
                "Card Number": transaction["Card Number"],
                "Date": transaction["Date"],
                "Description": transaction["Description"],
                "Amount (AUD)": transaction["Amount (AUD)"],
                "Excluded As": "Payment",
            }
        )
    return excluded_rows


def generate_dataframe(transactions, selected_card, total_amount):
    df = pd.DataFrame(
        transactions,
        columns=[
            "Card Number",
            "Date",
            "Description",
            "Amount (AUD)",
            "Is Credit",
        ],
    )
    df.index += 1
    display_df = df.copy()
    display_df["Amount (AUD)"] = display_df.apply(
        lambda row: f"(${row['Amount (AUD)']:,.2f})"
        if row["Is Credit"]
        else f"${row['Amount (AUD)']:,.2f}",
        axis=1,
    )
    hide_card_df = df.style.hide(subset=["Card Number"], axis="columns").format(
        {"Amount (AUD)": "${:.2f}"}
    )
    hide_card_df = display_df.drop(columns=["Is Credit"]).style.hide(
        subset=["Card Number"], axis="columns"
    )

    st.success(f"Found {len(df)} transactions for card ending in {selected_card}.")
    st.metric(label="Total (AUD)", value=f"${total_amount:,.2f}")
    st.dataframe(hide_card_df, use_container_width=True)

    csv_df = df.drop(columns=["Is Credit"]).copy()
    credit_mask = df["Is Credit"]
    csv_df.loc[credit_mask, "Amount (AUD)"] = -csv_df.loc[credit_mask, "Amount (AUD)"]
    csv = csv_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="Download CSV",
        data=csv,
        file_name=f"credit_card_{selected_card}_transactions.csv",
        mime="text/csv",
    )


def render_excluded_transactions(excluded_transactions):
    if not excluded_transactions:
        return

    st.caption("Audit")
    with st.expander(
        f"Show excluded rows ({len(excluded_transactions)})", expanded=False
    ):
        excluded_df = pd.DataFrame(excluded_transactions)
        excluded_df.index += 1
        styled_df = excluded_df.style.format({"Amount (AUD)": "${:.2f}"})
        st.dataframe(styled_df, use_container_width=True)


def render_card_summary(card_summary_rows):
    if not card_summary_rows:
        return

    st.subheader("Per-Card Summary")
    summary_df = pd.DataFrame(card_summary_rows)
    styled_df = summary_df.style.format(
        {
            "Purchases": "${:,.2f}",
            "Credits": "${:,.2f}",
            "Excluded BPAY": "${:,.2f}",
            "Net Total": "${:,.2f}",
        }
    )
    st.dataframe(styled_df, use_container_width=True, hide_index=True)


def render_reconciliation(reconciliation_rows):
    if not reconciliation_rows:
        return

    st.subheader("Reconciliation")
    reconciliation_df = pd.DataFrame(reconciliation_rows)
    styled_df = reconciliation_df.style.format(
        {
            "Statement": lambda value: "-" if pd.isna(value) else f"${value:,.2f}",
            "Parsed": lambda value: "-" if pd.isna(value) else f"${value:,.2f}",
            "Delta": lambda value: "-" if pd.isna(value) else f"${value:,.2f}",
        }
    )
    st.dataframe(styled_df, use_container_width=True, hide_index=True)


def main():
    st.set_page_config(page_title="Credit Card PDF to CSV Converter", layout="centered")

    st.title("Credit Card PDF to CSV Converter")
    st.write(
        """
Upload your **Macquarie Bank credit card statement (PDF)** below.
Then select your card ending digits. The app will extract transactions,
exclude credits and BPAY repayments, and let you download a clean CSV with totals.
"""
    )

    uploaded_file = st.file_uploader("Upload your statement (PDF)", type=["pdf"])

    if not uploaded_file:
        return

    page_texts, full_text = extract_pdf_text(uploaded_file)
    metadata = get_statement_metadata(full_text)
    all_transactions = parse_transaction_pages(page_texts, metadata["primary_card"])
    computed_balance = compute_balance(all_transactions, metadata["card_numbers"])
    card_summary_rows = build_card_summary(all_transactions, metadata["card_numbers"])
    reconciliation_rows = build_reconciliation_rows(
        metadata, all_transactions, metadata["card_numbers"]
    )

    closing_balance = metadata["closing_balance"]
    minimum_due_date = metadata["minimum_due_date"]
    st.subheader("Statement Summary")
    st.metric(label="Due Date", value=minimum_due_date or "-")

    if closing_balance is not None:
        closing_col, computed_col = st.columns(2)
        closing_col.metric(
            label="Closing Balance (In Statement)", value=f"${closing_balance:,.2f}"
        )
        computed_col.metric(label="Computed Balance", value=f"${computed_balance:,.2f}")
    else:
        st.warning("Could not find a closing balance in this statement.")
        st.metric(label="Computed Balance", value=f"${computed_balance:,.2f}")

    render_card_summary(card_summary_rows)
    render_reconciliation(reconciliation_rows)

    card_numbers = metadata["card_numbers"]
    primary_card = metadata["primary_card"]

    if not primary_card:
        st.error("Could not identify the primary card number in the statement.")
        return

    if not card_numbers:
        st.error("No card numbers found in the statement.")
        return

    selected_card = st.selectbox("Select card ending number:", card_numbers)
    transactions = get_transactions_for_card(all_transactions, selected_card)
    card_total = compute_card_total(all_transactions, selected_card)
    excluded_transactions = get_excluded_transactions_for_card(
        all_transactions, selected_card
    )

    if transactions:
        generate_dataframe(transactions, selected_card, card_total)
        render_excluded_transactions(excluded_transactions)
    else:
        st.warning(f"No valid transactions found for card ending in {selected_card}.")
        st.metric(label="Total (AUD)", value=f"${card_total:,.2f}")
        render_excluded_transactions(excluded_transactions)


if __name__ == "__main__":
    main()
