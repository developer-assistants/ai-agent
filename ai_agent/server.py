"""Zero-dependency HTTP server for running AI agents locally or in Docker."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from ai_agent.agents import get_agent_class, list_agents
from ai_agent.memory import AgentMemory


def serve_hub(host: str = "127.0.0.1", port: int = 8080, db_path: str | None = None) -> None:
    memory = AgentMemory(db_path=db_path)
    dist_dir = Path(__file__).resolve().parent.parent / "dist"

    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, data: Any, status: int = 200) -> None:
            raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(raw)

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                self._send_json({"status": "ok", "agents": len(list_agents())})
                return
            if parsed.path == "/api/agents":
                self._send_json({"agents": list_agents()})
                return
            if parsed.path == "/api/history":
                self._send_json({"runs": memory.list_runs(limit=25)})
                return
            if dist_dir.exists():
                rel = parsed.path.lstrip("/") or "index.html"
                candidate = dist_dir / rel
                if candidate.is_dir():
                    candidate = candidate / "index.html"
                if candidate.exists() and candidate.is_file():
                    content = candidate.read_bytes()
                    ctype = "text/html; charset=utf-8"
                    if candidate.suffix == ".js":
                        ctype = "application/javascript; charset=utf-8"
                    elif candidate.suffix == ".css":
                        ctype = "text/css; charset=utf-8"
                    elif candidate.suffix == ".svg":
                        ctype = "image/svg+xml"
                    elif candidate.suffix == ".xml":
                        ctype = "application/xml"
                    elif candidate.suffix == ".txt":
                        ctype = "text/plain; charset=utf-8"
                    self.send_response(200)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Content-Length", str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return
            self._send_json({"error": "Not found", "endpoints": ["/health", "/api/agents", "/api/run", "/api/history"]}, status=404)

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path != "/api/run":
                self._send_json({"error": "Unknown endpoint"}, status=404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                req = json.loads(body)
                agent_id = req["agent_id"]
                cls = get_agent_class(agent_id)
                agent = cls(memory=memory)
                result = agent.execute(req)
                self._send_json(result.to_dict())
            except (json.JSONDecodeError, KeyError) as exc:
                self._send_json({"error": str(exc)}, status=400)

        def log_message(self, format: str, *args: Any) -> None:
            return

    server = ThreadingHTTPServer((host, port), Handler)
    print(f"AI Agent Hub listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
