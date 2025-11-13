import streamlit as st
import pdfplumber
import pandas as pd
import re

def get_transactions(merged_lines, selected_card):
    transactions = []
    pattern = r"([A-Za-z]{3}\s+\d{1,2})\s+([A-Za-z0-9&\-\*.,'\/\s]+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})"
    for line in merged_lines:
        match = re.search(pattern, line)
        if match:
            date, desc, amount = match.groups()
            desc_clean = desc.strip()
            if not re.search(r"\bBPAY\b|\bCR\b", desc_clean, re.IGNORECASE):
                transactions.append([selected_card, date.strip(), desc_clean, float(amount.replace(",", ""))])
    return transactions

def generate_dataframe(transactions, selected_card):
    df = pd.DataFrame(transactions, columns=["Card Number","Date", "Description", "Amount (AUD)"])
    df.index += 1
    hide_card_df = df.style.hide(subset=['Card Number'], axis="columns").format({"Amount (AUD)": "${:.2f}"})
    

    total_amount = df["Amount (AUD)"].sum()
    st.success(f"✅ Found {len(df)} transactions for card ending in {selected_card}.")
    st.metric(label="Total (AUD)", value=f"${total_amount:,.2f}")
    st.dataframe(hide_card_df, use_container_width=True)
    
    # --- Download CSV ---
    csv = df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="📥 Download CSV",
        data=csv,
        file_name=f"credit_card_{selected_card}_transactions.csv",
        mime="text/csv"
    )

st.set_page_config(page_title="Credit Card PDF → CSV Converter", layout="centered")

st.title("💳 Credit Card PDF → CSV Converter")
st.write("""
Upload your **Macquarie Bank credit card statement (PDF)** below.  
Then select your card ending digits — the app will extract transactions, exclude credits,  
and let you download a clean CSV with totals.
""")

uploaded_file = st.file_uploader("Upload your statement (PDF)", type=["pdf"])

if uploaded_file:
    with pdfplumber.open(uploaded_file) as pdf:
        text = ""
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"

    # --- Extract Closing Balance ---
    closing_balance_match = re.search(r"Closing balance\s*\$([\d,]+\.\d{2})", text)
    closing_balance = float(closing_balance_match.group(1).replace(",", "")) if closing_balance_match else None

    if closing_balance:
        st.subheader("💰 Statement Summary")
        st.metric(label="Closing Balance", value=f"${closing_balance:,.2f}")
    else:
        st.warning("Couldn't find a closing balance in this statement.")

    # Find all card numbers in the PDF
    card_numbers = sorted(set(re.findall(r"XXXX XXXX XXXX (\d{4})", text)))

    if not card_numbers:
        st.error("No card numbers found in the statement.")
    else:
        # --- Identify certain line items BEFORE selecting card ---
        # Here we’ll just demo by filtering for some keywords (you can adjust)
        # preview_pattern = r"([A-Za-z]{3}\s+\d{1,2})\s+([A-Za-z0-9&\-\*.,'\/\s]+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})"
        # preview_matches = re.findall(preview_pattern, text)
        # preview_data = []

        # for date, desc, amount in preview_matches:
        #     if re.search(r"BUPA", desc, re.IGNORECASE):  # 👈 customize keywords here
        #         preview_data.append({
        #             "Date": date.strip(),
        #             "Description": desc.strip(),
        #             "Split Type": "Percentage",  # default
        #             "Input": ""
        #         })

        # if preview_data:
        #     st.subheader("🧾 Items for Review")
        #     st.caption("Adjust Split Type and Input values below:")

        #     df_preview = pd.DataFrame(preview_data)

        #     # Interactive editor
        #     edited_df = st.data_editor(
        #         df_preview,
        #         column_config={
        #             "Split Type": st.column_config.SelectboxColumn(
        #                 "Split Type",
        #                 options=["Percentage", "Amount"],
        #                 help="Choose whether to split by percentage or fixed amount"
        #             ),
        #             "Input": st.column_config.TextColumn(
        #                 "Input",
        #                 help="Enter an amount if Split Type = Amount",
        #                 required=False
        #             )
        #         },
        #         disabled=["Date", "Description"],  # keep these read-only
        #         use_container_width=True,
        #         hide_index=True
        #     )

        #     st.divider()

        # Continue with normal flow
        selected_card = st.selectbox("Select card ending number:", card_numbers)

        # Default card pattern for dependent cards
        card_pattern = fr"Card no\. XXXX XXXX XXXX {selected_card}(.*?)Closing balance"

        if re.search(fr"Account No. XXXX XXXX XXXX {selected_card}", text, re.S):
            # If the card is the main, switch card pattern
            card_pattern = fr"TRANSACTION DETAILS(.*?)Card no\. XXXX XXXX XXXX"

        # Extract only section for the selected card
        match = re.search(card_pattern, text, re.S)

        if not match:
            st.error(f"Couldn't find any transactions for card ending in {selected_card}.")
        else:
            section = match.group(1)

            # --- Preprocess: merge wrapped lines ---
            lines = section.splitlines()
            merged_lines = []
            buffer = ""

            for line in lines:
                if re.match(r"^[A-Za-z]{3}\s+\d{1,2}\s", line):
                    if buffer:
                        merged_lines.append(buffer.strip())
                    buffer = line
                else:
                    buffer += " " + line.strip()
            if buffer:
                merged_lines.append(buffer.strip())

            # --- Extract transactions ---
            transactions = get_transactions(merged_lines, selected_card)

            if transactions:
                generate_dataframe(transactions, selected_card)
            else:
                st.warning(f"No valid transactions found for card ending in {selected_card}.")

