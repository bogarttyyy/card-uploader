import streamlit as st
import pdfplumber
import pandas as pd
import re

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

    # Find all card numbers in the PDF
    card_numbers = sorted(set(re.findall(r"XXXX XXXX XXXX (\d{4})", text)))

    if not card_numbers:
        st.error("No card numbers found in the statement.")
    else:
        selected_card = st.selectbox("Select card ending number:", card_numbers)

        # Extract only section for the selected card
        card_pattern = fr"Card no\. XXXX XXXX XXXX {selected_card}(.*?)Closing balance"
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
                # Start of a transaction line
                if re.match(r"^[A-Za-z]{3}\s+\d{1,2}\s", line):
                    if buffer:
                        merged_lines.append(buffer.strip())
                    buffer = line
                else:
                    # continuation of previous line (merchant code or address)
                    buffer += " " + line.strip()
            if buffer:
                merged_lines.append(buffer.strip())

            # --- Extract transactions ---
            pattern = r"([A-Za-z]{3}\s+\d{1,2})\s+([A-Za-z0-9&\-\*.,'\/\s]+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})"
            transactions = []
            for line in merged_lines:
                match = re.search(pattern, line)
                if match:
                    date, desc, amount = match.groups()
                    desc_clean = desc.strip()
                    # Exclude credits *after* extraction (fix for missed lines)
                    if not re.search(r"\bBPAY\b|\bCR\b", desc_clean, re.IGNORECASE):
                        transactions.append([date.strip(), desc_clean, float(amount.replace(",", ""))])

            if transactions:
                df = pd.DataFrame(transactions, columns=["Date", "Description", "Amount (AUD)"])
                # df.style.format({'Amount (AUD)':'${:.2f}'})
                df.index += 1

                # --- Summary ---
                total_amount = df["Amount (AUD)"].sum()
                st.success(f"✅ Found {len(df)} transactions for card ending in {selected_card}.")
                st.metric(label="Total (AUD)", value=f"${total_amount:,.2f}")
                st.dataframe(df, use_container_width=True)

                # --- Download CSV ---
                csv = df.to_csv(index=False).encode("utf-8")
                st.download_button(
                    label="📥 Download CSV",
                    data=csv,
                    file_name=f"credit_card_{selected_card}_transactions.csv",
                    mime="text/csv"
                )
            else:
                st.warning(f"No valid transactions found for card ending in {selected_card}.")
