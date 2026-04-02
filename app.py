import streamlit as st

from parser import (
    build_card_summary,
    build_reconciliation_rows,
    compute_card_total,
    get_excluded_transactions_for_card,
    get_transactions_for_card,
    parse_statement,
)
from ui import (
    build_csv_data,
    render_card_summary,
    render_excluded_transactions,
    render_reconciliation,
    render_transactions_table,
)


def main() -> None:
    st.set_page_config(
        page_title="Credit Card PDF to CSV Converter",
        layout="centered",
        page_icon="💳")

    st.title("Credit Card PDF to CSV Converter")
    st.write(
        """
Upload your **Macquarie Bank credit card statement (PDF)** below.
Then select your card ending digits. The app will extract transactions,
exclude BPAY repayments, and let you download a clean CSV with totals.
"""
    )

    uploaded_file = st.file_uploader("Upload your statement (PDF)", type=["pdf"])
    if not uploaded_file:
        return

    metadata, all_transactions = parse_statement(uploaded_file)
    if not metadata.primary_card:
        st.error("Could not identify the primary card number in the statement.")
        return

    if not metadata.card_numbers:
        st.error("No card numbers found in the statement.")
        return

    card_summary_rows = build_card_summary(all_transactions, metadata.card_numbers)
    reconciliation_rows = build_reconciliation_rows(
        metadata, all_transactions, metadata.card_numbers
    )
    has_reconciliation_mismatch = any(
        row.delta not in (None, 0.0) for row in reconciliation_rows
    )

    st.subheader("Statement Summary")
    if metadata.closing_balance is not None:
        closing_col, due_col = st.columns(2)
        closing_col.metric(
            label="Closing Balance (In Statement)",
            value=f"${metadata.closing_balance:,.2f}",
        )
        due_col.metric(label="Due Date", value=metadata.minimum_due_date or "-")
    else:
        st.warning("Could not find a closing balance in this statement.")
        st.metric(label="Due Date", value=metadata.minimum_due_date or "-")

    if has_reconciliation_mismatch:
        st.warning(
            "Parsed totals do not fully reconcile with the statement summary. Review the reconciliation section before exporting."
        )

    combined_transactions = [
        transaction for transaction in all_transactions if not transaction.is_payment
    ]
    st.download_button(
        label="Download Combined CSV",
        data=build_csv_data(combined_transactions, metadata),
        file_name="credit_card_all_transactions.csv",
        mime="text/csv",
        use_container_width=True,
    )

    render_card_summary(card_summary_rows, all_transactions, metadata)
    render_reconciliation(reconciliation_rows)

    selected_card = st.selectbox("Select card ending number:", metadata.card_numbers)
    transactions = get_transactions_for_card(all_transactions, selected_card)
    excluded_transactions = get_excluded_transactions_for_card(
        all_transactions, selected_card
    )
    card_total = compute_card_total(all_transactions, selected_card)

    if transactions:
        render_transactions_table(transactions, selected_card, card_total)
    else:
        st.warning(f"No valid transactions found for card ending in {selected_card}.")
        st.metric(label="Total (AUD)", value=f"${card_total:,.2f}")

    render_excluded_transactions(excluded_transactions)


if __name__ == "__main__":
    main()
