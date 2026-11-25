# AI Agent Hub

Open-source platform with 12 runnable multi-step AI agents for real business and engineering tasks. Every agent executes explicit tool steps, records millisecond traces in SQLite memory, and verifies its own output before returning Markdown or JSON reports.

Live hub and guides: https://developer-assistants.github.io/ai-agent/

## What is included

AI Agent Hub ships as a zero-dependency Python 3.10+ runtime with a CLI, a local HTTP API, Docker Compose config, and an interactive web hub.

| Agent ID | Category | What it does |
| --- | --- | --- |
| `seo` | Marketing | Audits live URLs or HTML files for title, meta description, H1 count, canonical tags, image alt text, and JSON-LD schema |
| `coding` | Engineering | Scans source files for hardcoded secrets, `eval`/`exec`, `shell=True`, bare `except` blocks, and maintainability issues |
| `data-analysis` | Analytics | Profiles CSV files, computes sum/mean/median/stdev per column, and flags z-score outliers |
| `document` | Finance | Extracts invoice numbers, dates, line items, and totals, then verifies subtotal and tax arithmetic |
| `contract` | Legal | Scans agreements for auto-renewal traps, unlimited liability, unilateral price hikes, and broad IP assignment |
| `email` | Productivity | Classifies inbox messages by urgency, extracts action items, and separates newsletters |
| `sales` | Sales | Parses lead notes, scores ICP fit out of 100, and prepares a grounded outreach draft |
| `research` | Research | Breaks a topic into sub-questions, fetches supplied URLs, and writes a cited brief |
| `browser` | Automation | Extracts HTML tables, links, headings, and JSON-LD objects from public web pages |
| `competitor` | Research | Stores baseline page snapshots in SQLite and diffs added or removed copy across runs |
| `support` | Operations | Searches a local knowledge base, composes grounded replies with source IDs, and escalates low-confidence tickets |
| `github` | Engineering | Audits local repositories for README, license, tests, Docker setup, and GitHub Actions CI |

## Quickstart

Clone the repository and list all available agents:

```bash
git clone https://github.com/developer-assistants/ai-agent.git
cd ai-agent
python3 -m ai_agent list
```

Run an agent against one of the bundled sample files:

```bash
python3 -m ai_agent run seo --file examples/sample_page.html
python3 -m ai_agent run document --file examples/sample_invoice.txt --format json
python3 -m ai_agent run data-analysis --file examples/sample_metrics.csv
python3 -m ai_agent run contract --file examples/sample_contract.txt
```

Inspect past runs stored in SQLite memory:

```bash
python3 -m ai_agent history --limit 10
```

## Docker self-hosting

Start the local web hub and HTTP API (`/health`, `/api/agents`, `/api/run`, `/api/history`) on port 8080 with persistent SQLite storage:

```bash
docker compose up --build
```

Test the HTTP API directly:

```bash
curl -s http://127.0.0.1:8080/api/run \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"document","file":"examples/sample_invoice.txt"}'
```

## Local deterministic mode and optional LLMs

All deterministic tools run locally without external network calls or API keys. When you want LLM-assisted synthesis (for example in `research`), point the built-in OpenAI-compatible client at OpenAI or a local Ollama server:

```bash
export OPENAI_API_KEY="your-key"
export LLM_BASE_URL="https://api.openai.com/v1"
export LLM_MODEL="gpt-4o-mini"
```

For local Ollama:

```bash
export LLM_BASE_URL="http://127.0.0.1:11434/v1"
export LLM_MODEL="llama3.2"
```

## Project layout

```text
ai_agent/
  engine.py            BaseAgent, StepRecord, AgentResult, verification pass
  memory.py            SQLite run history and key-value baseline store
  llm.py               Optional zero-dependency OpenAI-compatible client
  cli.py               CLI entrypoint (list, run, history, serve)
  server.py            Local HTTP API and static hub server
  tools/builtin.py     HTML parser, CSV profiler, code scanner, invoice parser, diff, KB search
  agents/              12 multi-step agent implementations
examples/              Sample HTML, CSV, invoice, and contract files
tests/test_agents.py   Unit test suite covering all 12 agents, memory, and CLI
src/                   Interactive web hub (React, TypeScript, Vite)
scripts/               Static SEO landing page, sitemap, robots.txt, and llms.txt generator
```

## Running tests and building the web hub

```bash
python3 -m unittest discover -s tests -v
npm ci
npm run build
```

## License

MIT. See [LICENSE](LICENSE).
