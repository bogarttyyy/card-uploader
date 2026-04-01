import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import pdfplumber


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
PAYMENT_PREFIX = "BPAY PAYMENT - THANK YOU"


@dataclass(frozen=True)
class StatementMetadata:
    closing_balance: float | None
    opening_balance: float | None
    payments_and_credits: float | None
    purchases_total: float | None
    statement_period_start: date | None
    statement_period_end: date | None
    statement_from: str | None
    statement_to: str | None
    minimum_due_date: str | None
    primary_card: str | None
    card_numbers: list[str]


@dataclass(frozen=True)
class Transaction:
    card_number: str
    date: str
    description: str
    amount_aud: float
    is_credit: bool
    is_payment: bool

    @property
    def signed_amount(self) -> float:
        if self.is_payment:
            return 0.0
        if self.is_credit:
            return -self.amount_aud
        return self.amount_aud


@dataclass(frozen=True)
class CardSummary:
    card_number: str
    purchases: float
    credits: float
    excluded_bpay: float
    net_total: float


@dataclass(frozen=True)
class ReconciliationRow:
    item: str
    statement: float | None
    parsed: float | None
    delta: float | None


def parse_amount(value: str) -> float:
    return float(value.replace(",", ""))


def format_statement_date(value: str | None) -> str | None:
    if not value:
        return None
    return datetime.strptime(value, "%d/%m/%y").strftime("%d %B %Y")


def parse_statement_period_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, "%d/%m/%y").date()


def extract_pdf_text(uploaded_file) -> tuple[list[str], str]:
    page_texts = []
    with pdfplumber.open(uploaded_file) as pdf:
        for page in pdf.pages:
            page_texts.append(page.extract_text() or "")
    return page_texts, "\n".join(page_texts)


def extract_pdf_text_from_path(path: str | Path) -> tuple[list[str], str]:
    with Path(path).open("rb") as handle:
        return extract_pdf_text(handle)


def get_statement_metadata(full_text: str) -> StatementMetadata:
    closing_balance_match = re.search(r"Closing balance\s*\$([\d,]+\.\d{2})", full_text)
    opening_balance_match = OPENING_BALANCE_RE.search(full_text)
    payments_and_credits_match = PAYMENTS_AND_CREDITS_RE.search(full_text)
    purchases_match = PURCHASES_RE.search(full_text)
    statement_period_match = STATEMENT_PERIOD_RE.search(full_text)
    minimum_due_date_match = MINIMUM_DUE_DATE_RE.search(full_text)
    primary_card_match = ACCOUNT_NUMBER_RE.search(full_text)

    card_numbers: list[str] = []
    primary_card = primary_card_match.group(1) if primary_card_match else None
    if primary_card:
        card_numbers.append(primary_card)

    for card in CARD_NUMBER_RE.findall(full_text):
        if card not in card_numbers:
            card_numbers.append(card)

    statement_from = (
        statement_period_match.group("from") if statement_period_match else None
    )
    statement_to = statement_period_match.group("to") if statement_period_match else None
    minimum_due_date = (
        minimum_due_date_match.group(1) if minimum_due_date_match else None
    )

    return StatementMetadata(
        closing_balance=(
            parse_amount(closing_balance_match.group(1)) if closing_balance_match else None
        ),
        opening_balance=(
            parse_amount(opening_balance_match.group(1)) if opening_balance_match else None
        ),
        payments_and_credits=(
            parse_amount(payments_and_credits_match.group(1))
            if payments_and_credits_match
            else None
        ),
        purchases_total=parse_amount(purchases_match.group(1)) if purchases_match else None,
        statement_period_start=parse_statement_period_date(statement_from),
        statement_period_end=parse_statement_period_date(statement_to),
        statement_from=format_statement_date(statement_from),
        statement_to=format_statement_date(statement_to),
        minimum_due_date=format_statement_date(minimum_due_date),
        primary_card=primary_card,
        card_numbers=card_numbers,
    )


def parse_transaction_pages(
    page_texts: list[str], primary_card: str | None
) -> list[Transaction]:
    transactions: list[Transaction] = []

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

            if _should_stop_page_parse(line):
                break

            if current_card is None or _should_skip_line(line):
                continue

            transaction_match = TRANSACTION_LINE_RE.match(line)
            if not transaction_match:
                continue

            description = " ".join(transaction_match.group("description").split())
            amount = parse_amount(transaction_match.group("amount"))
            is_credit = bool(transaction_match.group("credit"))
            is_payment = description.upper().startswith(PAYMENT_PREFIX)

            transactions.append(
                Transaction(
                    card_number=current_card,
                    date=transaction_match.group("date"),
                    description=description,
                    amount_aud=amount,
                    is_credit=is_credit,
                    is_payment=is_payment,
                )
            )

    return transactions


def parse_statement(uploaded_file) -> tuple[StatementMetadata, list[Transaction]]:
    page_texts, full_text = extract_pdf_text(uploaded_file)
    metadata = get_statement_metadata(full_text)
    transactions = parse_transaction_pages(page_texts, metadata.primary_card)
    return metadata, transactions


def parse_statement_from_path(path: str | Path) -> tuple[StatementMetadata, list[Transaction]]:
    with Path(path).open("rb") as handle:
        return parse_statement(handle)


def get_transactions_for_card(
    transactions: list[Transaction], selected_card: str
) -> list[Transaction]:
    return [
        transaction
        for transaction in transactions
        if transaction.card_number == selected_card and not transaction.is_payment
    ]


def get_excluded_transactions_for_card(
    transactions: list[Transaction], selected_card: str
) -> list[Transaction]:
    return [
        transaction
        for transaction in transactions
        if transaction.card_number == selected_card and transaction.is_payment
    ]


def compute_card_total(transactions: list[Transaction], selected_card: str) -> float:
    total = sum(
        transaction.signed_amount
        for transaction in transactions
        if transaction.card_number == selected_card
    )
    return round(total, 2)


def compute_balance(transactions: list[Transaction], card_numbers: list[str]) -> float:
    total = sum(compute_card_total(transactions, card_number) for card_number in card_numbers)
    return round(total, 2)


def summarize_card(transactions: list[Transaction], selected_card: str) -> CardSummary:
    purchases = 0.0
    credits = 0.0
    payments = 0.0
    for transaction in transactions:
        if transaction.card_number != selected_card:
            continue
        if transaction.is_payment:
            payments += transaction.amount_aud
        elif transaction.is_credit:
            credits += transaction.amount_aud
        else:
            purchases += transaction.amount_aud

    return CardSummary(
        card_number=selected_card,
        purchases=round(purchases, 2),
        credits=round(credits, 2),
        excluded_bpay=round(payments, 2),
        net_total=round(purchases - credits, 2),
    )


def build_card_summary(
    transactions: list[Transaction], card_numbers: list[str]
) -> list[CardSummary]:
    return [summarize_card(transactions, card_number) for card_number in card_numbers]


def build_reconciliation_rows(
    metadata: StatementMetadata, transactions: list[Transaction], card_numbers: list[str]
) -> list[ReconciliationRow]:
    card_summary = build_card_summary(transactions, card_numbers)
    parsed_purchases = sum(item.purchases for item in card_summary)
    parsed_credits = sum(item.credits for item in card_summary)
    parsed_payments = sum(item.excluded_bpay for item in card_summary)
    parsed_payments_and_credits = parsed_credits + parsed_payments

    rows = [
        _reconciliation_row("Opening Balance", metadata.opening_balance, metadata.opening_balance),
        _reconciliation_row("Purchases", metadata.purchases_total, parsed_purchases),
        _reconciliation_row(
            "Payments and Credits", metadata.payments_and_credits, parsed_payments_and_credits
        ),
        _reconciliation_row("Closing Balance", metadata.closing_balance, metadata.closing_balance),
    ]

    computed_closing = None
    if metadata.opening_balance is not None:
        computed_closing = metadata.opening_balance + parsed_purchases - parsed_payments_and_credits

    rows.append(
        _reconciliation_row("Computed Closing Balance", metadata.closing_balance, computed_closing)
    )
    return rows


def normalize_transaction_date(
    transaction_date: str, metadata: StatementMetadata
) -> str:
    if not metadata.statement_period_start or not metadata.statement_period_end:
        return transaction_date

    parsed = datetime.strptime(transaction_date, "%b %d")
    candidate_years = {
        metadata.statement_period_start.year - 1,
        metadata.statement_period_start.year,
        metadata.statement_period_end.year,
        metadata.statement_period_end.year + 1,
    }

    candidates = []
    for year in sorted(candidate_years):
        try:
            candidate = date(year, parsed.month, parsed.day)
        except ValueError:
            continue
        if metadata.statement_period_start <= candidate <= metadata.statement_period_end:
            candidates.append(candidate)

    if not candidates:
        fallback_year = metadata.statement_period_end.year
        return date(fallback_year, parsed.month, parsed.day).isoformat()

    return candidates[0].isoformat()


def transactions_to_export_rows(
    transactions: list[Transaction], metadata: StatementMetadata
) -> list[dict[str, object]]:
    rows = []
    for transaction in transactions:
        amount = -transaction.amount_aud if transaction.is_credit else transaction.amount_aud
        rows.append(
            {
                "Card Number": transaction.card_number,
                "Date": normalize_transaction_date(transaction.date, metadata),
                "Description": transaction.description,
                "Amount (AUD)": amount,
            }
        )
    return rows


def _reconciliation_row(
    item: str, statement_value: float | None, parsed_value: float | None
) -> ReconciliationRow:
    delta = None
    if statement_value is not None and parsed_value is not None:
        delta = round(parsed_value - statement_value, 2)
    return ReconciliationRow(
        item=item,
        statement=statement_value,
        parsed=None if parsed_value is None else round(parsed_value, 2),
        delta=delta,
    )


def _should_stop_page_parse(line: str) -> bool:
    return (
        line.startswith("Customer service")
        or line.startswith("Closing balance $")
        or line.startswith("Continued over page..")
    )


def _should_skip_line(line: str) -> bool:
    return (
        bool(ACCOUNT_HEADER_RE.match(line))
        or line.startswith("Page ")
        or bool(REFERENCE_NUMBER_RE.match(line))
        or bool(FOREIGN_CURRENCY_RE.match(line))
    )
