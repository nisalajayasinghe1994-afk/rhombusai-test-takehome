import os
import sys
import pandas as pd

INPUT_PATH = os.path.join("fixtures", "messy-input.csv")
OUTPUT_PATH = os.path.join("data-validation", "output", "downloaded-output.csv")

EXPECTED_COLUMNS = {"id", "name", "email", "signup_date", "amount", "notes"}

def fail(msg: str) -> None:
    print(f"VALIDATION FAILED: {msg}", file=sys.stderr)
    sys.exit(1)

def main() -> None:
    if not os.path.exists(INPUT_PATH):
        fail(f"Missing input file: {INPUT_PATH}")

    if not os.path.exists(OUTPUT_PATH):
        fail(
            f"Missing output file: {OUTPUT_PATH}\n"
            "Run the UI test first to download the transformed dataset."
        )

    inp = pd.read_csv(INPUT_PATH)
    out = pd.read_csv(OUTPUT_PATH)

    # 1) Schema correctness
    out_cols = set(map(str, out.columns))
    missing = EXPECTED_COLUMNS - out_cols
    if missing:
        fail(f"Output missing expected columns: {sorted(missing)}")

    # 2) Row count expectations
    # If you included a "dedupe" transformation, this input has one duplicate (id=2 row).
    # Input rows: 6; expected after dedupe: 5 (assuming exact duplicate removal).
    in_rows = len(inp)
    out_rows = len(out)

    if out_rows > in_rows:
        fail(f"Output row count ({out_rows}) should not exceed input ({in_rows}).")

    # A conservative assertion: ensure at least one duplicate was removed OR rows stayed same.
    # If your chosen transforms don't include dedupe, remove this check.
    if out_rows not in (in_rows, in_rows - 1):
        fail(f"Unexpected output rows: got {out_rows}, expected {in_rows} or {in_rows - 1}.")

    # 3) Deterministic checks (bounded, stable)
    # Trim whitespace: names should not have leading/trailing spaces
    if out["name"].astype(str).str.match(r"^\s|\s$").any():
        fail("Found name values with leading/trailing whitespace (trim expected).")

    # Email normalization (optional): if you used a lowercasing transform
    # We keep this tolerant: at least 80% emails should be lowercase.
    emails = out["email"].astype(str)
    lower_ratio = (emails == emails.str.lower()).mean()
    if lower_ratio < 0.80:
        fail(f"Expected most emails lowercased; lowercase ratio={lower_ratio:.2f}")

    # signup_date parse rate: require that most dates are parseable after standardization
    parsed = pd.to_datetime(out["signup_date"], errors="coerce", dayfirst=False)
    parse_rate = parsed.notna().mean()
    if parse_rate < 0.60:
        fail(f"Date parse rate too low ({parse_rate:.2f}). Expected >= 0.60 after cleaning.")

    # amount: should be numeric for most rows after cleaning/imputation
    amount = pd.to_numeric(out["amount"], errors="coerce")
    amt_rate = amount.notna().mean()
    if amt_rate < 0.60:
        fail(f"Amount numeric rate too low ({amt_rate:.2f}). Expected >= 0.60.")

    print("VALIDATION PASSED ✅")
    print(f"Input rows: {in_rows}, Output rows: {out_rows}, Date parse rate: {parse_rate:.2f}, Amount numeric rate: {amt_rate:.2f}")

if __name__ == "__main__":
    main()
