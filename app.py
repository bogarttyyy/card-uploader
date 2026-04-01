import base64

import pandas as pd
import streamlit as st

from parser import (
    CardSummary,
    ReconciliationRow,
    Transaction,
    build_card_summary,
    build_reconciliation_rows,
    compute_balance,
    compute_card_total,
    get_excluded_transactions_for_card,
    get_transactions_for_card,
    parse_statement,
)


def build_transactions_dataframe(transactions: list[Transaction]) -> pd.DataFrame:
    df = pd.DataFrame(
        [
            {
                "Card Number": transaction.card_number,
                "Date": transaction.date,
                "Description": transaction.description,
                "Amount (AUD)": transaction.amount_aud,
                "Is Credit": transaction.is_credit,
            }
            for transaction in transactions
        ]
    )

    if df.empty:
        return df

    df.index += 1
    return df


def build_csv_data(transactions: list[Transaction]) -> bytes:
    df = build_transactions_dataframe(transactions)
    if df.empty:
        return df.to_csv(index=False).encode("utf-8")

    csv_df = df.drop(columns=["Is Credit"]).copy()
    credit_mask = df["Is Credit"]
    csv_df.loc[credit_mask, "Amount (AUD)"] = -csv_df.loc[credit_mask, "Amount (AUD)"]
    return csv_df.to_csv(index=False).encode("utf-8")


def render_transactions_table(
    transactions: list[Transaction], selected_card: str, total_amount: float
) -> None:
    df = build_transactions_dataframe(transactions)
    display_df = df.copy()
    if not display_df.empty:
        display_df["Amount (AUD)"] = display_df.apply(
            lambda row: f"(${row['Amount (AUD)']:,.2f})"
            if row["Is Credit"]
            else f"${row['Amount (AUD)']:,.2f}",
            axis=1,
        )
        display_df = display_df.drop(columns=["Is Credit"])
        styled_df = display_df.style.hide(subset=["Card Number"], axis="columns")
    else:
        styled_df = display_df.style

    st.success(f"Found {len(df)} transactions for card ending in {selected_card}.")
    st.metric(label="Total (AUD)", value=f"${total_amount:,.2f}")
    st.dataframe(styled_df, use_container_width=True)


def render_excluded_transactions(excluded_transactions: list[Transaction]) -> None:
    if not excluded_transactions:
        return

    excluded_df = pd.DataFrame(
        [
            {
                "Card Number": transaction.card_number,
                "Date": transaction.date,
                "Description": transaction.description,
                "Amount (AUD)": transaction.amount_aud,
                "Excluded As": "Payment",
            }
            for transaction in excluded_transactions
        ]
    )
    excluded_df.index += 1

    st.caption("Audit")
    with st.expander(
        f"Show excluded rows ({len(excluded_transactions)})", expanded=False
    ):
        styled_df = excluded_df.style.format({"Amount (AUD)": "${:.2f}"})
        st.dataframe(styled_df, use_container_width=True)


def render_card_summary(
    card_summary_rows: list[CardSummary], all_transactions: list[Transaction]
) -> None:
    if not card_summary_rows:
        return

    st.subheader("Per-Card Summary")
    summary_df = pd.DataFrame(
        [
            {
                "Card Number": row.card_number,
                "Purchases": row.purchases,
                "Credits": row.credits,
                "Excluded BPAY": row.excluded_bpay,
                "Net Total": row.net_total,
                "CSV": _build_csv_link(
                    row.card_number,
                    build_csv_data(get_transactions_for_card(all_transactions, row.card_number)),
                ),
            }
            for row in card_summary_rows
        ]
    )
    st.dataframe(
        summary_df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Purchases": st.column_config.NumberColumn("Purchases", format="$%.2f"),
            "Credits": st.column_config.NumberColumn("Credits", format="$%.2f"),
            "Excluded BPAY": st.column_config.NumberColumn(
                "Excluded BPAY", format="$%.2f"
            ),
            "Net Total": st.column_config.NumberColumn("Net Total", format="$%.2f"),
            "CSV": st.column_config.LinkColumn(
                "CSV",
                display_text="CSV",
            ),
        },
    )
    computed_balance = round(sum(row.net_total for row in card_summary_rows), 2)
    _, computed_col = st.columns(2)
    computed_col.markdown(
        f"""
<div style="text-align: right;">
  <div style="color: rgb(250, 250, 236); font-size: 0.875rem; margin-bottom: 0.125rem;">
    Computed Balance
  </div>
  <div style="font-size: 2.25rem; font-weight: 600;">
    ${computed_balance:,.2f}
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


def _build_csv_link(card_number: str, csv_bytes: bytes) -> str:
    encoded = base64.b64encode(csv_bytes).decode("ascii")
    filename = f"credit_card_{card_number}_transactions.csv"
    return f"data:text/csv;base64,{encoded}#filename={filename}"


def render_reconciliation(reconciliation_rows: list[ReconciliationRow]) -> None:
    if not reconciliation_rows:
        return

    reconciliation_df = pd.DataFrame(
        [
            {
                "Item": row.item,
                "Statement": row.statement,
                "Parsed": row.parsed,
                "Delta": row.delta,
            }
            for row in reconciliation_rows
        ]
    )

    st.subheader("Reconciliation")
    styled_df = reconciliation_df.style.format(
        {
            "Statement": lambda value: "-" if pd.isna(value) else f"${value:,.2f}",
            "Parsed": lambda value: "-" if pd.isna(value) else f"${value:,.2f}",
            "Delta": lambda value: "-" if pd.isna(value) else f"${value:,.2f}",
        }
    )
    st.dataframe(styled_df, use_container_width=True, hide_index=True)


def main() -> None:
    st.set_page_config(page_title="Credit Card PDF to CSV Converter", layout="centered")

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

    render_card_summary(card_summary_rows, all_transactions)
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
