#!/usr/bin/env python3
"""Convert trusted CSV exports from the legacy PostgreSQL database into D1 SQL."""

import argparse
import csv
from pathlib import Path

TABLES = {
    "navigation_category": ["id", "name", "title", "sort", "del_flag", "create_by", "create_time"],
    "web_navigation": [
        "id", "name", "title", "content", "detail", "url", "image_url", "thumbnail_url",
        "website_data", "collection_time", "star_rating", "tag_name", "category_name",
    ],
    "submit": ["id", "created_at", "name", "url", "email", "is_feature", "status"],
    "crawler_candidate": [
        "id", "url", "canonical_url", "domain", "source", "source_item_id", "source_url", "status",
        "attempt_count", "next_retry_at", "locked_at", "worker_lease_hash", "worker_lease_expires_at",
        "title", "description", "detail", "image_url", "category_name", "error_message", "discovered_at",
        "created_at", "updated_at",
    ],
}


def quote(value: str) -> str:
    if value == "\\N":
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def convert(input_dir: Path, output: Path) -> None:
    with output.open("w", encoding="utf-8", newline="\n") as target:
        target.write("PRAGMA foreign_keys = ON;\nBEGIN TRANSACTION;\n")
        for table, expected_columns in TABLES.items():
            source = input_dir / f"{table}.csv"
            if not source.exists():
                continue
            with source.open(encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                columns = reader.fieldnames or []
                unexpected = set(columns) - set(expected_columns)
                if unexpected or not columns:
                    raise ValueError(f"Unexpected columns in {source}: {sorted(unexpected)}")
                for row in reader:
                    values = ", ".join(quote(row[column]) for column in columns)
                    target.write(f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({values});\n")
        target.write("COMMIT;\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path, help="Directory containing <table>.csv exports")
    parser.add_argument("output", type=Path, help="Destination D1-compatible SQL file")
    args = parser.parse_args()
    convert(args.input_dir, args.output)


if __name__ == "__main__":
    main()
