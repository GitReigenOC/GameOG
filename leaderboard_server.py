#!/usr/bin/env python3
"""Loopback-only SQLite leaderboard API for local development."""

from __future__ import annotations

import argparse
from contextlib import closing
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


VALID_MODES = {"waves", "coop", "duel", "ffa", "tdm"}
NAME_PATTERN = re.compile(r"^[A-Za-z0-9 _-]{2,16}$")
MAX_REQUEST_BYTES = 4096
DEFAULT_DATABASE = Path(__file__).with_name("leaderboard.sqlite3")


def initialize_database(database_path: Path) -> None:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS leaderboard (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                score INTEGER NOT NULL CHECK (score >= 0),
                mode TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS leaderboard_mode_score "
            "ON leaderboard (mode, score DESC, id ASC)"
        )


def validate_submission(payload: object) -> tuple[str, int, str]:
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    name = payload.get("name")
    score = payload.get("score")
    mode = payload.get("mode")
    if not isinstance(name, str) or not NAME_PATTERN.fullmatch(name.strip()):
        raise ValueError("Name must contain 2-16 letters, numbers, spaces, underscores, or hyphens.")
    if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 1_000_000_000:
        raise ValueError("Score must be an integer between 0 and 1,000,000,000.")
    if not isinstance(mode, str) or mode not in VALID_MODES:
        raise ValueError("Mode is not supported.")
    return name.strip(), score, mode


def submit_score(database_path: Path, payload: object) -> dict[str, object]:
    name, score, mode = validate_submission(payload)
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with closing(sqlite3.connect(database_path)) as connection, connection:
        cursor = connection.execute(
            "INSERT INTO leaderboard (name, score, mode, created_at) VALUES (?, ?, ?, ?)",
            (name, score, mode, created_at),
        )
        return {"id": cursor.lastrowid, "name": name, "score": score, "mode": mode, "created_at": created_at}


def get_scores(database_path: Path, mode: str, limit: int = 10) -> list[dict[str, object]]:
    if mode not in VALID_MODES:
        raise ValueError("Mode is not supported.")
    with closing(sqlite3.connect(database_path)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            "SELECT name, score, mode, created_at FROM leaderboard "
            "WHERE mode = ? ORDER BY score DESC, id ASC LIMIT ?",
            (mode, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def make_handler(database_path: Path) -> type[BaseHTTPRequestHandler]:
    class LeaderboardHandler(BaseHTTPRequestHandler):
        def send_json(self, status: int, payload: object) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self) -> None:
            self.send_json(200, {"ok": True})

        def do_GET(self) -> None:
            parsed = urlsplit(self.path)
            if parsed.path == "/api/health":
                self.send_json(200, {"ok": True})
                return
            if parsed.path != "/api/leaderboard":
                self.send_json(404, {"error": "Not found."})
                return
            mode = parse_qs(parsed.query).get("mode", [""])[0]
            try:
                self.send_json(200, get_scores(database_path, mode))
            except ValueError as error:
                self.send_json(400, {"error": str(error)})

        def do_POST(self) -> None:
            if urlsplit(self.path).path != "/api/leaderboard":
                self.send_json(404, {"error": "Not found."})
                return
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
                    raise ValueError("Request body must be between 1 and 4096 bytes.")
                payload = json.loads(self.rfile.read(content_length))
                result = submit_score(database_path, payload)
                self.send_json(201, result)
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
                self.send_json(400, {"error": str(error)})

        def log_message(self, format_string: str, *args: object) -> None:
            print(f"{self.address_string()} - {format_string % args}")

    return LeaderboardHandler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.environ.get("BLACKSITE_PORT", "8765")))
    parser.add_argument("--database", type=Path, default=Path(os.environ.get("BLACKSITE_DB", DEFAULT_DATABASE)))
    args = parser.parse_args()
    initialize_database(args.database)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(args.database))
    print(f"Leaderboard API listening at http://127.0.0.1:{args.port}/api")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping leaderboard API.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
