import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

from leaderboard_server import get_scores, initialize_database, make_handler, submit_score


class LeaderboardTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temporary_directory.name) / "scores.sqlite3"
        initialize_database(self.database_path)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_scores_are_ranked_per_mode(self):
        submit_score(self.database_path, {"name": "Alpha", "score": 80, "mode": "duel"})
        submit_score(self.database_path, {"name": "Bravo", "score": 120, "mode": "duel"})
        submit_score(self.database_path, {"name": "Wave", "score": 999, "mode": "waves"})

        self.assertEqual(
            [row["name"] for row in get_scores(self.database_path, "duel")],
            ["Bravo", "Alpha"],
        )

    def test_rejects_invalid_score_and_mode(self):
        for payload in (
            {"name": "Alpha", "score": True, "mode": "duel"},
            {"name": "Alpha", "score": -1, "mode": "duel"},
            {"name": "Alpha", "score": 2, "mode": "unlisted"},
            {"name": "<script>", "score": 2, "mode": "duel"},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                submit_score(self.database_path, payload)

    def test_http_api_accepts_a_score_and_returns_ranked_results(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.database_path))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base_url = f"http://127.0.0.1:{server.server_port}/api/leaderboard"
        try:
            request = Request(
                base_url,
                data=json.dumps({"name": "Browser", "score": 40, "mode": "ffa"}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(request) as response:
                self.assertEqual(response.status, 201)
            with urlopen(f"{base_url}?mode=ffa") as response:
                rows = json.loads(response.read())
            self.assertEqual(rows[0]["name"], "Browser")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
