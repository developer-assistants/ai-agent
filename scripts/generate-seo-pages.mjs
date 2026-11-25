import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const ROOT_DIR = path.resolve('.');
const BASE_URL = 'https://developer-assistants.github.io/ai-agent';
const REPO_URL = 'https://github.com/developer-assistants/ai-agent';
const GSC_META = '<meta name="google-site-verification" content="HqgfQrEQATXaycciOAu8GzuJP8BSRHtaR1JrgBtnApU" />';
const TODAY = new Date().toISOString().slice(0, 10);

const AGENT_PAGES = [
  {
    slug: 'seo',
    path: '/agents/seo/',
    query: 'ai seo agent',
    title: 'AI SEO Agent | Open-Source Technical SEO Audit Tool',
    h1: 'AI SEO agent for technical audits',
    description: 'Audit HTML pages and live URLs for title tags, meta descriptions, H1 structure, canonical links, image alt text, and JSON-LD schema.',
    cli: 'python3 -m ai_agent run seo --file examples/sample_page.html',
    urlCli: 'python3 -m ai_agent run seo --url https://example.com',
    steps: [
      ['fetch_url / read_input', 'Downloads the public URL or reads local HTML from disk.'],
      ['parse_html_document', 'Extracts titles, meta descriptions, canonical links, heading counts, images, and JSON-LD blocks.'],
      ['score_seo_rules', 'Scores technical checks out of 100 and lists high-priority fixes first.'],
    ],
    useCases: [
      'Pre-deployment checks in CI before shipping landing pages.',
      'Auditing missing canonical links, duplicate H1 elements, and broken structured data.',
      'Generating Markdown or JSON reports for marketing and engineering teams.',
    ],
  },
  {
    slug: 'coding',
    path: '/agents/coding/',
    query: 'ai code agent',
    title: 'AI Code Agent | Open-Source Static Code Review Agent',
    h1: 'AI code agent for automated file review',
    description: 'Inspect Python and TypeScript source files for hardcoded secrets, dynamic eval calls, bare exceptions, and maintainability issues.',
    cli: 'python3 -m ai_agent run coding --file ai_agent/cli.py',
    urlCli: 'python3 -m ai_agent run coding --file app.py --format json',
    steps: [
      ['read_source', 'Loads source files and counts lines and function definitions.'],
      ['scan_source_code', 'Checks each line against security and reliability rules with line-level evidence.'],
    ],
    useCases: [
      'Catching hardcoded API keys and unsafe eval or shell=True calls before pull requests.',
      'Running deterministic code hygiene checks in offline or air-gapped environments.',
      'Exporting JSON findings to CI scripts and engineering dashboards.',
    ],
  },
  {
    slug: 'sales',
    path: '/agents/sales/',
    query: 'ai sales agent',
    title: 'AI Sales Agent | Open-Source Lead Research and Outreach',
    h1: 'AI sales agent for lead qualification',
    description: 'Score target accounts against your ideal customer profile and prepare grounded outreach messages with traceable steps.',
    cli: 'python3 -m ai_agent run sales --input "Company: Northstar Ops\\nRole: Head of Ops\\nEmployees: 85\\nPain: Manual invoice audits"',
    urlCli: 'python3 -m ai_agent run sales --input "Company: Acme" --format json',
    steps: [
      ['parse_lead_profile', 'Extracts company name, role, team size, and operational signals.'],
      ['score_icp_fit', 'Scores account fit on a 100-point scale and assigns tier A, B, or C.'],
      ['draft_outreach', 'Generates a short outreach email tied to the lead signal.'],
    ],
    useCases: [
      'Qualifying inbound leads before routing them to account executives.',
      'Drafting tailored first-touch emails without generic filler.',
      'Logging qualification scores in SQLite for CRM sync.',
    ],
  },
  {
    slug: 'research',
    path: '/agents/research/',
    query: 'ai research agent',
    title: 'AI Research Agent | Multi-Step Topic Briefs with Sources',
    h1: 'AI research agent with source citations',
    description: 'Break a topic into sub-questions, fetch supplied URLs, and synthesize a structured report with local or OpenAI-compatible models.',
    cli: 'python3 -m ai_agent run research --input "Self-hosted AI agent runtimes"',
    urlCli: 'python3 -m ai_agent run research --input "SQLite memory patterns" --url https://sqlite.org',
    steps: [
      ['decompose_topic', 'Splits the prompt into three focused technical questions.'],
      ['collect_sources', 'Fetches supplied URLs and extracts clean titles and text excerpts.'],
      ['synthesize_brief', 'Produces a cited brief using an optional LLM or deterministic outline.'],
    ],
    useCases: [
      'Building technical literature briefs before writing architecture docs.',
      'Collecting verifiable URL excerpts for competitive and product research.',
      'Running repeatable research jobs via CLI or Docker.',
    ],
  },
  {
    slug: 'email',
    path: '/agents/email/',
    query: 'ai email agent',
    title: 'AI Email Agent | Open-Source Inbox Triage and Priority',
    h1: 'AI email agent for inbox triage',
    description: 'Classify email threads into urgent incidents, action items, and newsletters while keeping sensitive inbox data on your own machine.',
    cli: 'python3 -m ai_agent run email --input "Subject: URGENT API timeout\\nCheckout failing"',
    urlCli: 'python3 -m ai_agent run email --file inbox.json --format json',
    steps: [
      ['parse_messages', 'Parses JSON email batches or delimited plain-text threads.'],
      ['classify_priority', 'Flags outages, security alerts, and overdue invoices as high priority.'],
      ['extract_actions', 'Builds a short ordered action list for the operator.'],
    ],
    useCases: [
      'Sorting support and ops mailboxes before morning standup.',
      'Separating urgent customer issues from recurring digests.',
      'Keeping private email bodies off third-party SaaS servers.',
    ],
  },
  {
    slug: 'browser',
    path: '/agents/browser/',
    query: 'ai browser agent',
    title: 'AI Browser Agent | Public Web Scraping and Table Extraction',
    h1: 'AI browser agent for structured extraction',
    description: 'Extract HTML tables, links, headings, and Schema.org JSON-LD objects from public web pages into clean JSON.',
    cli: 'python3 -m ai_agent run browser --file examples/sample_page.html',
    urlCli: 'python3 -m ai_agent run browser --url https://example.com --format json',
    steps: [
      ['fetch_url / read_input', 'Retrieves the target HTML document with a clean user-agent header.'],
      ['parse_html_document', 'Parses tables, links, headings, and valid JSON-LD blocks.'],
      ['extract_structured_records', 'Normalizes extracted rows for CSV or JSON export.'],
    ],
    useCases: [
      'Pulling pricing tables and specification grids from public documentation.',
      'Collecting internal link graphs for site architecture audits.',
      'Feeding clean JSON records into local analytics scripts.',
    ],
  },
  {
    slug: 'data-analysis',
    path: '/agents/data-analysis/',
    query: 'ai data analysis agent',
    title: 'AI Data Analysis Agent | CSV Profiling and Outlier Detection',
    h1: 'AI data analysis agent for spreadsheets',
    description: 'Profile CSV files, calculate sum, mean, median, and standard deviation per column, and detect statistical z-score anomalies.',
    cli: 'python3 -m ai_agent run data-analysis --file examples/sample_metrics.csv',
    urlCli: 'python3 -m ai_agent run data-analysis --file metrics.csv --format json',
    steps: [
      ['read_dataset', 'Loads CSV files from disk or inline text.'],
      ['analyze_csv_text', 'Computes column statistics, missing-cell counts, and z-score outliers.'],
    ],
    useCases: [
      'Checking daily traffic or revenue exports for sudden tracking spikes.',
      'Auditing missing values before loading CSV files into a warehouse.',
      'Generating plain-text metric summaries for weekly team updates.',
    ],
  },
  {
    slug: 'document',
    path: '/agents/document/',
    query: 'ai document agent',
    title: 'AI Document Agent | Invoice Extraction and Math Verification',
    h1: 'AI document agent for invoices and receipts',
    description: 'Extract invoice numbers, dates, line items, and totals from text documents and verify subtotal plus tax arithmetic automatically.',
    cli: 'python3 -m ai_agent run document --file examples/sample_invoice.txt',
    urlCli: 'python3 -m ai_agent run document --file invoice.txt --format json',
    steps: [
      ['read_document', 'Loads raw invoice text or OCR output.'],
      ['extract_document_fields', 'Extracts invoice ID, dates, vendor emails, line items, and totals.'],
      ['verify_arithmetic', 'Cross-checks line-item sum and subtotal plus tax against total due.'],
    ],
    useCases: [
      'Catching vendor billing arithmetic errors before payment approval.',
      'Converting plain-text invoices into structured JSON for bookkeeping.',
      'Archiving verified finance runs in local SQLite history.',
    ],
  },
  {
    slug: 'contract',
    path: '/agents/contract/',
    query: 'ai contract agent',
    title: 'AI Contract Agent | Automated Agreement Risk Review',
    h1: 'AI contract agent for clause risk checks',
    description: 'Scan vendor contracts and MSAs for automatic renewals, unlimited liability, unilateral fee hikes, and broad IP assignments.',
    cli: 'python3 -m ai_agent run contract --file examples/sample_contract.txt',
    urlCli: 'python3 -m ai_agent run contract --file msa.txt --format json',
    steps: [
      ['read_document', 'Reads the contract text and counts total word volume.'],
      ['scan_risk_clauses', 'Matches commercial risk patterns and attaches quoted excerpts and negotiation notes.'],
    ],
    useCases: [
      'First-pass triage of SaaS vendor agreements before sending to counsel.',
      'Spotting evergreen renewal traps and short termination windows.',
      'Building a repeatable checklist for procurement teams.',
    ],
  },
  {
    slug: 'competitor',
    path: '/agents/competitor/',
    query: 'ai competitor monitoring agent',
    title: 'AI Competitor Agent | Website Diff and Pricing Monitor',
    h1: 'AI competitor agent for page monitoring',
    description: 'Store baseline snapshots in SQLite memory and detect added or removed pricing lines and messaging updates over time.',
    cli: 'python3 -m ai_agent run competitor --target acme --input "Starter $29/mo"',
    urlCli: 'python3 -m ai_agent run competitor --target acme --url https://example.com/pricing',
    steps: [
      ['memory_lookup', 'Loads the previous stored snapshot for the target key.'],
      ['diff_texts', 'Calculates line-level additions, removals, and similarity score.'],
      ['memory_save', 'Saves the new baseline into SQLite for the next scheduled check.'],
    ],
    useCases: [
      'Tracking competitor pricing tier changes every week.',
      'Monitoring feature launches and positioning edits on rival homepages.',
      'Triggering internal alerts when similarity drops below a threshold.',
    ],
  },
  {
    slug: 'support',
    path: '/agents/support/',
    query: 'ai customer support agent',
    title: 'AI Customer Support Agent | Knowledge-Base Grounded Replies',
    h1: 'AI customer support agent with KB citations',
    description: 'Search local documentation articles, compose grounded customer replies with source IDs, and flag low-confidence tickets for escalation.',
    cli: 'python3 -m ai_agent run support --input "How do I run this with Docker?"',
    urlCli: 'python3 -m ai_agent run support --input "Privacy policy" --format json',
    steps: [
      ['search_knowledge_base', 'Ranks local KB articles by query token overlap.'],
      ['compose_grounded_reply', 'Drafts a cited response or routes uncertain tickets to human support.'],
    ],
    useCases: [
      'Answering repetitive setup and billing questions with doc citations.',
      'Preventing hallucinated answers by escalating low-score matches.',
      'Running self-hosted support triage inside Docker.',
    ],
  },
  {
    slug: 'github',
    path: '/agents/github/',
    query: 'ai github agent',
    title: 'AI GitHub Agent | Open-Source Repository Readiness Audit',
    h1: 'AI GitHub agent for repository audits',
    description: 'Inspect local Git repositories for README coverage, license files, automated tests, Docker configuration, and GitHub Actions CI.',
    cli: 'python3 -m ai_agent run github --input .',
    urlCli: 'python3 -m ai_agent run github --input /path/to/repo --format json',
    steps: [
      ['inspect_local_repo', 'Walks repository files and aggregates extensions and key project files.'],
      ['score_repo_readiness', 'Scores open-source readiness out of 100 and lists missing items.'],
    ],
    useCases: [
      'Auditing internal projects before publishing them as open source.',
      'Checking every team repository for tests, license, and CI workflows.',
      'Standardizing Docker and documentation checklists across repos.',
    ],
  },
];

const TOPIC_PAGES = [
  {
    path: '/examples/',
    query: 'ai agent examples',
    title: 'AI Agent Examples | 12 Working Open-Source Agents in Python',
    h1: '12 working AI agent examples you can run today',
    description: 'Explore 12 complete multi-step AI agent examples with source code, sample files, SQLite memory, and verifiable CLI output.',
    bodyHtml: `
      <section class="seo-section">
        <h2>Why runnable examples beat bare prompt lists</h2>
        <p>Every example in AI Agent Hub is a working Python module with explicit tools, step-by-step execution timing, SQLite run logging, and a verification pass. You can run all 12 locally with Python 3.10 and zero third-party packages, or connect an OpenAI-compatible API or local Ollama model.</p>
        <div class="panels grid-2">
          ${AGENT_PAGES.map(
            (a) => `<article class="panel-pad">
              <h3><a class="text-link" href="/ai-agent${a.path}">${a.h1}</a></h3>
              <p>${a.description}</p>
              <pre class="code-block">${a.cli}</pre>
            </article>`,
          ).join('')}
        </div>
      </section>
    `,
  },
  {
    path: '/builder/',
    query: 'ai agent builder',
    title: 'AI Agent Builder | Self-Hosted Workflow Config Generator',
    h1: 'AI agent builder for repeatable workflows',
    description: 'Design self-hosted AI agents by combining base templates, deterministic tools, SQLite memory, and cron schedules without vendor lock-in.',
    bodyHtml: `
      <section class="seo-section">
        <h2>How an agent workflow is assembled</h2>
        <p>A production agent needs four parts: an input adapter (file, URL, or inline text), deterministic tools that parse or verify facts, persistent memory in SQLite, and a structured output format (Markdown or JSON).</p>
        <pre class="code-block">name: weekly-seo-monitor
base_agent: seo
model_provider: local-deterministic
memory: sqlite:///data/memory.db
schedule: "0 9 * * 1"
verify:
  min_steps: 2
  require_actions: true
run: python3 -m ai_agent run seo --url https://example.com --format json</pre>
        <p style="margin-top: 16px;">Use the interactive builder on the <a class="text-link" href="/ai-agent/#builder">main hub page</a> to customize fields and copy a ready-to-run YAML workflow.</p>
      </section>
    `,
  },
  {
    path: '/development/',
    query: 'ai agent development',
    title: 'AI Agent Development | Architecture for Verifiable Agents',
    h1: 'AI agent development architecture',
    description: 'Learn how to architect reliable multi-step AI agents with tool tracing, deterministic verification, SQLite memory, and zero-dependency deployment.',
    bodyHtml: `
      <section class="seo-section">
        <h2>Core design principles</h2>
        <p>Reliable agents separate deterministic tool execution from language synthesis. When an invoice total needs verification or a CSV file needs outlier detection, Python code computes exact numbers while an optional LLM summarizes context.</p>
        <div class="panels">
          <div class="panel-pad">
            <h3>1. Explicit tool steps</h3>
            <p>Every call passes through <code>run_step()</code>, recording tool name, duration in milliseconds, status, and structured evidence.</p>
          </div>
          <div class="panel-pad">
            <h3>2. Persistent SQLite memory</h3>
            <p>Runs and baselines are stored in <code>~/.ai-agent/memory.db</code> so monitoring agents can diff changes across runs.</p>
          </div>
          <div class="panel-pad">
            <h3>3. Mandatory verification pass</h3>
            <p>Before returning a report, <code>verify()</code> checks step counts, tool exit statuses, and non-empty actions.</p>
          </div>
        </div>
      </section>
    `,
  },
  {
    path: '/open-source/',
    query: 'open source ai agents',
    title: 'Open Source AI Agents | Self-Hosted Hub Under MIT License',
    h1: 'Open-source AI agents you can self-host',
    description: 'Run 12 MIT-licensed AI agents locally with Python or Docker Compose. Keep private documents, code, and inbox data on your own infrastructure.',
    bodyHtml: `
      <section class="seo-section">
        <h2>Self-host in two commands</h2>
        <p>Clone the repository and run any agent directly from the terminal, or launch the HTTP API and web interface inside Docker.</p>
        <pre class="code-block">git clone https://github.com/developer-assistants/ai-agent.git
cd ai-agent
python3 -m ai_agent list
docker compose up --build</pre>
        <p style="margin-top: 16px;">All 12 agents run in deterministic local mode without an API key. Set <code>OPENAI_API_KEY</code> or point <code>LLM_BASE_URL</code> at a local Ollama server when you want LLM-assisted synthesis.</p>
      </section>
    `,
  },
  {
    path: '/tutorials/',
    query: 'how to build an ai agent',
    title: 'How to Build an AI Agent | Step-by-Step Python Tutorial',
    h1: 'How to build a multi-step AI agent in Python',
    description: 'Build a custom AI agent with tool steps, SQLite memory, verification checks, and unit tests in under 50 lines of Python.',
    bodyHtml: `
      <section class="seo-section">
        <h2>Step 1: Subclass BaseAgent</h2>
        <p>Create a new class under <code>ai_agent/agents/</code>, declare its ID and tool list, and wrap each operation in <code>self.run_step()</code>.</p>
        <pre class="code-block">from ai_agent.engine import BaseAgent

class CustomAuditAgent(BaseAgent):
    agent_id = "custom-audit"
    name = "Custom Audit Agent"
    category = "Operations"
    description = "Checks input lines and verifies formatting."
    tools_used = ["load_input", "check_rules"]

    def _run(self, payload):
        text = self.run_step("Load input", "load_input", lambda: str(payload.get("input", "")))
        lines = self.run_step("Split lines", "check_rules", lambda: [l for l in text.splitlines() if l.strip()])
        return {
            "summary": f"Checked {len(lines)} non-empty lines.",
            "findings": [{"severity": "info", "title": "Line count", "detail": str(len(lines))}],
            "actions": ["Pipe JSON output into your reporting workflow."],
        }</pre>
        <h2 style="margin-top: 32px;">Step 2: Register and test</h2>
        <p>Add your class to <code>AGENT_REGISTRY</code> in <code>ai_agent/agents/__init__.py</code> and run <code>python3 -m unittest discover -s tests -v</code>.</p>
      </section>
    `,
  },
];

function renderShell({ title, description, canonicalPath, h1, query, contentHtml }) {
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const breadcrumbName = h1;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${GSC_META}
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${BASE_URL}/og-image.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;500&family=Host+Grotesk:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: dark;
      --color-paper: oklch(17% 0.008 250); --color-paper-2: oklch(21% 0.009 250); --color-paper-3: oklch(13.5% 0.007 250);
      --color-ink: oklch(95% 0.005 250); --color-ink-2: oklch(83% 0.008 250); --color-muted: oklch(71% 0.01 250);
      --color-rule: oklch(31% 0.01 250); --color-rule-2: oklch(42% 0.012 250);
      --color-accent: oklch(82% 0.15 80); --color-accent-ink: oklch(18% 0.04 75);
      --color-cool: oklch(77% 0.12 245); --color-cool-soft: oklch(29% 0.05 245);
      --font-display: "Host Grotesk", ui-sans-serif, system-ui, sans-serif;
      --font-outlier: "Atkinson Hyperlegible Mono", ui-monospace, monospace;
      --radius-card: 10px; --radius-pill: 6px;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { overflow-x: clip; margin: 0; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-display); line-height: 1.6; }
    :focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
    .container { width: 100%; max-width: 1120px; margin-inline: auto; padding-inline: 24px; }
    header { border-bottom: 1px solid var(--color-rule); background: var(--color-paper-3); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; min-height: 64px; gap: 16px; flex-wrap: wrap; }
    .brand { font-weight: 500; color: var(--color-ink); text-decoration: none; }
    nav { display: flex; gap: 20px; flex-wrap: wrap; }
    nav a { font-size: 0.875rem; font-weight: 500; color: var(--color-muted); text-decoration: none; }
    nav a:hover { color: var(--color-accent); }
    main { padding-block: 48px 72px; }
    h1 { font-size: clamp(2rem, 3.6vw, 3.25rem); font-weight: 500; letter-spacing: -0.03em; line-height: 1.06; margin: 0 0 16px; max-width: 24ch; }
    h2 { font-size: clamp(1.5rem, 2.2vw, 2rem); font-weight: 500; letter-spacing: -0.02em; margin: 0 0 12px; }
    h3 { font-size: 1.125rem; font-weight: 500; margin: 0 0 8px; }
    p { margin: 0 0 16px; color: var(--color-ink-2); max-width: 68ch; }
    .lead { font-size: 1.125rem; color: var(--color-ink-2); margin-bottom: 24px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 40px; }
    .btn { display: inline-flex; align-items: center; padding: 10px 16px; border-radius: var(--radius-pill); border: 1px solid var(--color-rule-2); background: var(--color-paper-2); color: var(--color-ink); font-size: 0.875rem; font-weight: 500; text-decoration: none; }
    .btn--primary { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-ink); }
    .panels { display: grid; gap: 1px; background: var(--color-rule); border: 1px solid var(--color-rule); border-radius: var(--radius-card); overflow: hidden; margin-block: 24px; }
    .panels > * { background: var(--color-paper-2); }
    .panel-pad { padding: 20px; }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .code-block { margin: 12px 0 0; padding: 14px 16px; background: var(--color-paper-3); border: 1px solid var(--color-rule); border-radius: var(--radius-pill); font-family: var(--font-outlier); font-size: 0.8125rem; color: var(--color-cool); overflow-x: auto; }
    .text-link { color: var(--color-ink); text-decoration: underline; text-decoration-color: var(--color-rule-2); }
    .text-link:hover { color: var(--color-accent); }
    .seo-section { margin-top: 40px; }
    ul { padding-left: 20px; color: var(--color-ink-2); }
    li { margin-bottom: 8px; }
    footer { border-top: 1px solid var(--color-rule); background: var(--color-paper-3); padding-block: 36px; font-size: 0.875rem; color: var(--color-muted); }
    .footer-row { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    @media (max-width: 48rem) { .grid-2 { grid-template-columns: minmax(0, 1fr); } }
  </style>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "AI Agent Hub", "item": "${BASE_URL}/" },
      { "@type": "ListItem", "position": 2, "name": "${breadcrumbName}", "item": "${canonicalUrl}" }
    ]
  }
  </script>
</head>
<body>
  <header>
    <div class="container nav-inner">
      <a class="brand" href="/ai-agent/">AI Agent Hub</a>
      <nav aria-label="Navigation">
        <a href="/ai-agent/">Live console</a>
        <a href="/ai-agent/examples/">Examples</a>
        <a href="/ai-agent/builder/">Builder</a>
        <a href="/ai-agent/open-source/">Open source</a>
        <a href="/ai-agent/tutorials/">Tutorials</a>
        <a href="${REPO_URL}" rel="noreferrer">GitHub</a>
      </nav>
    </div>
  </header>
  <main class="container">
    <h1>${h1}</h1>
    <p class="lead">${description}</p>
    <div class="actions">
      <a class="btn btn--primary" href="/ai-agent/">Try live in console</a>
      <a class="btn" href="${REPO_URL}" rel="noreferrer">View source on GitHub</a>
    </div>
    ${contentHtml}
  </main>
  <footer>
    <div class="container footer-row">
      <span>AI Agent Hub (MIT License) | Target topic: ${query}</span>
      <nav aria-label="Footer links">
        <a href="/ai-agent/">Home</a>
        <a href="/ai-agent/examples/">Examples</a>
        <a href="/ai-agent/development/">Development</a>
        <a href="/ai-agent/llms.txt">llms.txt</a>
        <a href="/ai-agent/sitemap.xml">sitemap.xml</a>
      </nav>
    </div>
  </footer>
</body>
</html>
`;
}

function writePage(relPath, html) {
  const dir = path.join(DIST_DIR, relPath.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
}

// 1. Write all 12 agent landing pages
for (const agent of AGENT_PAGES) {
  const contentHtml = `
    <section class="seo-section">
      <h2>Quickstart commands</h2>
      <p>Run the ${agent.slug} agent locally with Python 3.10 and zero mandatory dependencies.</p>
      <pre class="code-block">${agent.cli}
${agent.urlCli}</pre>
    </section>
    <section class="seo-section">
      <h2>Multi-step execution pipeline</h2>
      <div class="panels">
        ${agent.steps
          .map(
            ([tool, desc], idx) => `<div class="panel-pad">
              <h3>Step ${idx + 1}: ${tool}</h3>
              <p>${desc}</p>
            </div>`,
          )
          .join('')}
      </div>
    </section>
    <section class="seo-section">
      <h2>Practical use cases</h2>
      <ul>
        ${agent.useCases.map((u) => `<li>${u}</li>`).join('')}
      </ul>
    </section>
    <section class="seo-section">
      <h2>Related open-source agents</h2>
      <p>Browse all 12 runnable agents on the <a class="text-link" href="/ai-agent/examples/">AI agent examples page</a> or assemble a scheduled workflow in the <a class="text-link" href="/ai-agent/builder/">agent builder</a>.</p>
    </section>
  `;
  writePage(
    agent.path,
    renderShell({
      title: agent.title,
      description: agent.description,
      canonicalPath: agent.path,
      h1: agent.h1,
      query: agent.query,
      contentHtml,
    }),
  );
}

// 2. Write topic landing pages
for (const topic of TOPIC_PAGES) {
  writePage(
    topic.path,
    renderShell({
      title: topic.title,
      description: topic.description,
      canonicalPath: topic.path,
      h1: topic.h1,
      query: topic.query,
      contentHtml: topic.bodyHtml,
    }),
  );
}

// 3. Write sitemap.xml
const allPaths = ['/', ...TOPIC_PAGES.map((t) => t.path), ...AGENT_PAGES.map((a) => a.path)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths
  .map(
    (p, idx) => `  <url>
    <loc>${BASE_URL}${p}</loc>
    <lastmod>${TODAY}</lastmod>
    <priority>${idx === 0 ? '1.0' : p.startsWith('/agents/') ? '0.8' : '0.9'}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf-8');

// 4. Write robots.txt
const robots = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots, 'utf-8');

// 5. Write llms.txt (both dist/ and root)
const llmsTxt = `# AI Agent Hub

> Open-source platform of 12 multi-step AI agents for real work: SEO, coding, sales, research, email, data analysis, invoices, contracts, competitor monitoring, customer support, browser extraction, and GitHub audits.

- Repository: ${REPO_URL}
- Live Hub: ${BASE_URL}/
- License: MIT
- Runtime: Python 3.10+ (zero mandatory dependencies) or Docker Compose

## Core guides
- [AI Agent Examples](${BASE_URL}/examples/): All 12 runnable agents with CLI commands
- [AI Agent Builder](${BASE_URL}/builder/): Workflow YAML and cron builder
- [AI Agent Development](${BASE_URL}/development/): Multi-step architecture, tool tracing, and verification
- [Open Source AI Agents](${BASE_URL}/open-source/): Self-hosted Python and Docker setup
- [How to Build an AI Agent](${BASE_URL}/tutorials/): Step-by-step Python subclassing tutorial

## Agent pages
${AGENT_PAGES.map((a) => `- [${a.h1}](${BASE_URL}${a.path}): ${a.description}`).join('\n')}
`;
fs.writeFileSync(path.join(DIST_DIR, 'llms.txt'), llmsTxt, 'utf-8');
fs.writeFileSync(path.join(ROOT_DIR, 'llms.txt'), llmsTxt, 'utf-8');

// 6. Write og-image.svg
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#1b1d21"/>
  <rect x="48" y="48" width="1104" height="534" rx="12" fill="#23262c" stroke="#3c4048" stroke-width="2"/>
  <text x="96" y="170" fill="#e8b84b" font-family="system-ui, sans-serif" font-size="24" font-weight="500">developer-assistants / ai-agent</text>
  <text x="96" y="260" fill="#f2f4f7" font-family="system-ui, sans-serif" font-size="64" font-weight="500">AI Agent Hub</text>
  <text x="96" y="330" fill="#b4bac4" font-family="system-ui, sans-serif" font-size="30">12 open-source multi-step AI agents for real work</text>
  <text x="96" y="420" fill="#7cb7f0" font-family="ui-monospace, monospace" font-size="24">python3 -m ai_agent run seo --file examples/sample_page.html</text>
  <text x="96" y="510" fill="#8b929e" font-family="system-ui, sans-serif" font-size="22">MIT License · Python 3.10+ · SQLite Memory · Docker Compose</text>
</svg>
`;
fs.writeFileSync(path.join(DIST_DIR, 'og-image.svg'), ogSvg, 'utf-8');

// 7. Write 404.html
fs.copyFileSync(path.join(DIST_DIR, 'index.html'), path.join(DIST_DIR, '404.html'));

console.log(`Generated ${allPaths.length} SEO routes, sitemap.xml, robots.txt, llms.txt, and og-image.svg.`);
