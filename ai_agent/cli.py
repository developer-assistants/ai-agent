"""Command-line interface for running and inspecting AI agents."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from ai_agent.agents import get_agent_class, list_agents
from ai_agent.memory import AgentMemory
from ai_agent.server import serve_hub


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ai-agent",
        description="Run self-hosted, multi-step AI agents with tool traces and SQLite memory.",
    )
    parser.add_argument("--db", help="Optional path to SQLite memory database.")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List all built-in agents and their tools.")

    run_cmd = sub.add_parser("run", help="Execute an agent.")
    run_cmd.add_argument("agent_id", help="Agent ID (for example: seo, coding, data-analysis).")
    run_cmd.add_argument("--input", "-i", default="", help="Inline text or JSON input.")
    run_cmd.add_argument("--file", "-f", help="Path to an input file (HTML, CSV, code, invoice, contract).")
    run_cmd.add_argument("--url", "-u", help="Public URL to fetch for web-capable agents.")
    run_cmd.add_argument("--target", help="Optional memory key for competitor snapshots.")
    run_cmd.add_argument("--format", choices=["md", "json"], default="md", help="Output format.")
    run_cmd.add_argument("--out", "-o", help="Write report to a file instead of stdout.")

    hist_cmd = sub.add_parser("history", help="Show recent agent runs stored in SQLite memory.")
    hist_cmd.add_argument("--limit", type=int, default=15)
    hist_cmd.add_argument("--agent", help="Filter runs by agent ID.")

    serve_cmd = sub.add_parser("serve", help="Start the local HTTP API and web hub server.")
    serve_cmd.add_argument("--host", default="127.0.0.1")
    serve_cmd.add_argument("--port", type=int, default=8080)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    memory = AgentMemory(db_path=args.db)

    if args.command == "list":
        for agent in list_agents():
            print(f"{agent['id']:15s}  {agent['category']:12s}  {agent['name']}  ({', '.join(agent['tools'])})")
        return 0

    if args.command == "history":
        runs = memory.list_runs(limit=args.limit, agent_id=args.agent)
        print(json.dumps(runs, indent=2, ensure_ascii=False))
        return 0

    if args.command == "serve":
        serve_hub(host=args.host, port=args.port, db_path=args.db)
        return 0

    if args.command == "run":
        cls = get_agent_class(args.agent_id)
        agent = cls(memory=memory)
        payload: dict[str, Any] = {"input": args.input}
        if args.file:
            payload["file"] = args.file
        if args.url:
            payload["url"] = args.url
            payload["urls"] = [args.url]
        if args.target:
            payload["target"] = args.target

        result = agent.execute(payload)
        rendered = (
            json.dumps(result.to_dict(), indent=2, ensure_ascii=False)
            if args.format == "json"
            else result.to_markdown()
        )
        if args.out:
            Path(args.out).write_text(rendered, encoding="utf-8")
            print(f"Wrote {args.format} report to {args.out} (run_id={result.run_id})")
        else:
            print(rendered)
        return 0 if result.verified else 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
