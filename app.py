import streamlit as st
import pdfplumber
import pandas as pd
import re
from io import BytesIO

st.set_page_config(page_title="Credit Card CSV Generator", layout="centered")

st.title("💳 Credit Card PDF → CSV Converter")
st.write("Upload your Macquarie Bank PDF statement, and this will extract transactions for card ending in **8489** (excluding credits).")

uploaded_file = st.file_uploader("Upload your statement (PDF)", type=["pdf"])

if uploaded_file:
    with pdfplumber.open(uploaded_file) as pdf:
        text = ""
        for page in pdf.pages:
            text += page.extract_text() + "\n"

    # Extract only the section for the card ending in 8489
    card_pattern = r"Card no\. XXXX XXXX XXXX 8489(.*?)Closing balance"
    match = re.search(card_pattern, text, re.S)
    
    if not match:
        st.error("Couldn't find any transactions for card ending in 8489.")
    else:
        section = match.group(1)

        # Match transaction lines: e.g. "Oct 7 91.35GERGIS, ANTHONY JOHN ..."
        pattern = r"([A-Za-z]{3}\s+\d{1,2})\s+([A-Za-z0-9&\-\*.,'\/\s]+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})(?!\s*CR)"
        transactions = re.findall(pattern, section)

        data = []
        for date, desc, amount in transactions:
            amount_clean = float(amount.replace(",", ""))
            if "CRBPAY" not in desc:  # exclude credits
                data.append([date.strip(), desc.strip(), amount_clean])

        if data:
            df = pd.DataFrame(data, columns=["Date", "Description", "Amount (AUD)"])
            st.success(f"Found {len(df)} transactions for card ending 8489.")
            st.dataframe(df)

            # Create downloadable CSV
            csv = df.to_csv(index=False).encode("utf-8")
            st.download_button(
                label="📥 Download CSV",
                data=csv,
                file_name="credit_card_8489_transactions.csv",
                mime="text/csv"
            )
        else:
            st.warning("No valid transactions found for card ending 8489.")
