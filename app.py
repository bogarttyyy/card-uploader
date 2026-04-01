import re

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


def get_statement_metadata(full_text):
    closing_balance_match = re.search(r"Closing balance\s*\$([\d,]+\.\d{2})", full_text)
    closing_balance = (
        parse_amount(closing_balance_match.group(1)) if closing_balance_match else None
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
        if transaction["Is Credit"] or transaction["Is Payment"]:
            continue
        rows.append(
            [
                transaction["Card Number"],
                transaction["Date"],
                transaction["Description"],
                transaction["Amount (AUD)"],
            ]
        )
    return rows


def generate_dataframe(transactions, selected_card):
    df = pd.DataFrame(
        transactions, columns=["Card Number", "Date", "Description", "Amount (AUD)"]
    )
    df.index += 1
    hide_card_df = df.style.hide(subset=["Card Number"], axis="columns").format(
        {"Amount (AUD)": "${:.2f}"}
    )

    total_amount = df["Amount (AUD)"].sum()
    st.success(f"Found {len(df)} transactions for card ending in {selected_card}.")
    st.metric(label="Total (AUD)", value=f"${total_amount:,.2f}")
    st.dataframe(hide_card_df, use_container_width=True)

    csv = df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="Download CSV",
        data=csv,
        file_name=f"credit_card_{selected_card}_transactions.csv",
        mime="text/csv",
    )


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

    closing_balance = metadata["closing_balance"]
    if closing_balance is not None:
        st.subheader("Statement Summary")
        st.metric(label="Closing Balance", value=f"${closing_balance:,.2f}")
    else:
        st.warning("Could not find a closing balance in this statement.")

    card_numbers = metadata["card_numbers"]
    primary_card = metadata["primary_card"]

    if not primary_card:
        st.error("Could not identify the primary card number in the statement.")
        return

    if not card_numbers:
        st.error("No card numbers found in the statement.")
        return

    all_transactions = parse_transaction_pages(page_texts, primary_card)
    selected_card = st.selectbox("Select card ending number:", card_numbers)
    transactions = get_transactions_for_card(all_transactions, selected_card)

    if transactions:
        generate_dataframe(transactions, selected_card)
    else:
        st.warning(f"No valid transactions found for card ending in {selected_card}.")


if __name__ == "__main__":
    main()
