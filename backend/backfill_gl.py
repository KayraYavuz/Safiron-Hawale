"""
GL backfill CLI.

Usage (from backend/, with the project venv):
    ./venv/bin/python backfill_gl.py            # default scheme: thp
    ./venv/bin/python backfill_gl.py --scheme intl

Idempotent and re-runnable. Operates on the configured DATABASE_URL.
"""
import sys
import argparse
from app.core.database import SessionLocal
from app.services.backfill import backfill_gl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scheme", default="thp", choices=["thp", "intl"],
                    help="Chart scheme to seed for companies without one")
    args = ap.parse_args()
    db = SessionLocal()
    try:
        summary = backfill_gl(db, default_scheme=args.scheme)
    finally:
        db.close()
    total_posted = sum(v["posted"] for v in summary.values())
    total_skipped = sum(v["skipped"] for v in summary.values())
    total_errors = sum(v["errors"] for v in summary.values())
    for cid, v in summary.items():
        print(f"  {cid}: posted={v['posted']} skipped={v['skipped']} errors={v['errors']}")
    print(f"\n✅ Backfill done — posted {total_posted}, skipped {total_skipped}, errors {total_errors}")
    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
