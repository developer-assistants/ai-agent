import { useMemo, useState } from 'react';
import { AGENTS, type AgentSpec, type LiveRunOutput } from './data/agents';

const CATEGORIES = ['All', 'Marketing', 'Engineering', 'Finance', 'Research', 'Analytics'] as const;

export default function App() {
  const [selectedId, setSelectedId] = useState<string>(AGENTS[0].id);
  const [inputMap, setInputMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(AGENTS.map((agent) => [agent.id, agent.sampleInput])),
  );
  const [output, setOutput] = useState<LiveRunOutput>(() => AGENTS[0].runLocal(AGENTS[0].sampleInput));
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [showAllAgents, setShowAllAgents] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const [builderName, setBuilderName] = useState<string>('weekly-seo-monitor');
  const [builderBase, setBuilderBase] = useState<string>('seo');
  const [builderProvider, setBuilderProvider] = useState<string>('local-deterministic');
  const [builderSchedule, setBuilderSchedule] = useState<string>('0 9 * * 1');

  const activeAgent: AgentSpec = useMemo(
    () => AGENTS.find((agent) => agent.id === selectedId) ?? AGENTS[0],
    [selectedId],
  );

  const currentInput = inputMap[activeAgent.id] ?? activeAgent.sampleInput;

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AGENTS.filter((agent) => {
      const catOk = category === 'All' || agent.category === category;
      if (!catOk) return false;
      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.tagline.toLowerCase().includes(q) ||
        agent.tools.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [category, search]);

  function handleSelectAgent(agent: AgentSpec, scrollToConsole = false) {
    setSelectedId(agent.id);
    const text = inputMap[agent.id] ?? agent.sampleInput;
    setOutput(agent.runLocal(text));
    if (scrollToConsole) {
      document.getElementById('live-console')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function handleRun() {
    setOutput(activeAgent.runLocal(currentInput));
  }

  function handleCopyCli() {
    navigator.clipboard?.writeText(activeAgent.cliCommand);
    setCopiedCmd(true);
    window.setTimeout(() => setCopiedCmd(false), 1800);
  }

  const builderConfig = useMemo(() => {
    return [
      `name: ${builderName || 'custom-agent'}`,
      `base_agent: ${builderBase}`,
      `model_provider: ${builderProvider}`,
      `memory: sqlite:///data/memory.db`,
      `schedule: "${builderSchedule}"`,
      `verify:`,
      `  min_steps: 2`,
      `  require_actions: true`,
      `run: python3 -m ai_agent run ${builderBase} --format json`,
    ].join('\n');
  }, [builderName, builderBase, builderProvider, builderSchedule]);

  return (
    <>
      <header className="slab-nav">
        <div className="container slab-nav__inner">
          <a className="brand-mark" href="/ai-agent/">
            AI Agent Hub
          </a>
          <nav className="nav-links" aria-label="Primary navigation">
            <a href="#catalog">Agents</a>
            <a href="/ai-agent/examples/">Examples</a>
            <a href="/ai-agent/builder/">Builder</a>
            <a href="/ai-agent/open-source/">Open source</a>
            <a href="/ai-agent/tutorials/">Tutorials</a>
            <a href="https://github.com/developer-assistants/ai-agent" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-section" id="live-console">
          <div className="container hero-grid">
            <div className="hero-copy">
              <h1>Open-source AI agents for real work</h1>
              <p className="lead">
                Run 12 multi-step agents locally with SQLite memory.
              </p>
              <div className="action-row">
                <button type="button" className="btn btn--primary" onClick={handleRun}>
                  Execute agent
                </button>
                <a
                  className="btn"
                  href="https://github.com/developer-assistants/ai-agent"
                  rel="noreferrer"
                >
                  Clone on GitHub
                </a>
              </div>
              <div className="cli-strip">
                <code className="measured">{activeAgent.cliCommand}</code>
                <button type="button" className="picker-btn" onClick={handleCopyCli}>
                  {copiedCmd ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="panels" aria-label="Interactive agent console">
              <div className="console-header">
                <span className="console-title">{activeAgent.name}</span>
                <span className={output.verified ? 'chip chip--ok' : 'chip chip--bad'}>
                  {output.verified ? 'Verified output' : 'Needs review'}
                </span>
              </div>
              <div className="console-body">
                <div className="picker-row" role="tablist" aria-label="Select agent to test">
                  {AGENTS.slice(0, 5).map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      role="tab"
                      aria-selected={agent.id === activeAgent.id}
                      className={`picker-btn ${agent.id === activeAgent.id ? 'picker-btn--active' : ''}`}
                      onClick={() => handleSelectAgent(agent)}
                    >
                      {agent.name.replace(' Agent', '')}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="field-label" htmlFor="agent-input-area">
                    {activeAgent.inputLabel}
                  </label>
                  <textarea
                    id="agent-input-area"
                    className="input-box"
                    value={currentInput}
                    onChange={(e) =>
                      setInputMap((prev) => ({ ...prev, [activeAgent.id]: e.target.value }))
                    }
                  />
                </div>

                <div className="trail" aria-label="Execution trace">
                  {output.steps.map((step) => (
                    <div className="trail-row" key={step.index}>
                      <span className="measured">{step.tool}</span>
                      <span className="trail-row__text">{step.summary}</span>
                      <span className="measured">{step.durationMs.toFixed(1)} ms</span>
                    </div>
                  ))}
                </div>

                <div className="cell-meta">
                  <p className="trail-row__text">{output.summary}</p>
                  {typeof output.score === 'number' && (
                    <span className="reading-large">{output.score}</span>
                  )}
                </div>

                {output.findings.slice(0, 1).map((finding, idx) => (
                  <div
                    key={idx}
                    className={`diff-line ${finding.severity === 'high' ? 'diff-line--minus' : 'diff-line--plus'}`}
                  >
                    <strong>{finding.title}:</strong> {finding.detail}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="band-section band-section--s band-section--deep">
          <div className="container">
            <div className="section-head">
              <h2>Before and after</h2>
            </div>
            <div className="panels diff-grid">
              <div className="diff-col">
                <span className="chip chip--bad">Single prompt</span>
                <div className="diff-line diff-line--minus">- One chat call, no parser.</div>
                <div className="diff-line diff-line--minus">- Math and schema checks fail silently.</div>
                <div className="diff-line diff-line--minus">- No SQLite history or diffs.</div>
              </div>
              <div className="diff-col">
                <span className="chip chip--ok">AI Agent Hub</span>
                <div className="diff-line diff-line--plus">+ Traced tool steps with timing.</div>
                <div className="diff-line diff-line--plus">+ Local math, HTML, and code checks.</div>
                <div className="diff-line diff-line--plus">+ SQLite run log and baseline diffs.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="band-section" id="catalog">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>12 ready-to-run agents</h2>
                <p>Tools and SQLite memory.</p>
              </div>
              <div style={{ minWidth: '240px' }}>
                <label className="visually-hidden" htmlFor="agent-search">
                  Search agents
                </label>
                <input
                  id="agent-search"
                  type="search"
                  className="input-field"
                  placeholder="Filter by task or tool..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="picker-row" style={{ marginBottom: 'var(--space-lg)' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`picker-btn ${category === cat ? 'picker-btn--active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="panels catalog-grid">
              {(showAllAgents || search.trim() || category !== 'All' ? filteredAgents : filteredAgents.slice(0, 3)).map((agent) => (
                <article className="agent-cell" key={agent.id}>
                  <div>
                    <div className="cell-meta" style={{ marginBottom: 'var(--space-xs)' }}>
                      <span className="chip chip--instrument">{agent.category}</span>
                      <span className="measured">{agent.tools.length} tools</span>
                    </div>
                    <h3>{agent.name}</h3>
                    <p style={{ marginTop: 'var(--space-xs)' }}>{agent.tagline}</p>
                  </div>
                  <div className="cell-actions">
                    <button
                      type="button"
                      className="picker-btn"
                      onClick={() => handleSelectAgent(agent, true)}
                    >
                      Run
                    </button>
                    <a className="text-link" href={agent.seoPath}>
                      Guide
                    </a>
                  </div>
                </article>
              ))}
            </div>
            {!showAllAgents && !search.trim() && category === 'All' && filteredAgents.length > 3 && (
              <div className="action-row" style={{ marginTop: 'var(--space-lg)' }}>
                <button type="button" className="btn" onClick={() => setShowAllAgents(true)}>
                  Show all {filteredAgents.length} agents
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="band-section band-section--l band-section--deep" id="builder">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Agent workflow builder</h2>
                <p>Assemble a repeatable agent spec with memory, model routing, and schedule.</p>
              </div>
              <a className="text-link" href="/ai-agent/builder/">
                Open builder guide
              </a>
            </div>

            <div className="panels builder-grid">
              <div className="builder-pane">
                <div>
                  <label className="field-label" htmlFor="builder-name">
                    Workflow name
                  </label>
                  <input
                    id="builder-name"
                    className="input-field"
                    value={builderName}
                    onChange={(e) => setBuilderName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="builder-base">
                    Base agent
                  </label>
                  <select
                    id="builder-base"
                    className="input-field"
                    value={builderBase}
                    onChange={(e) => setBuilderBase(e.target.value)}
                  >
                    {AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="builder-provider">
                    Execution mode
                  </label>
                  <select
                    id="builder-provider"
                    className="input-field"
                    value={builderProvider}
                    onChange={(e) => setBuilderProvider(e.target.value)}
                  >
                    <option value="local-deterministic">Local deterministic (no API key)</option>
                    <option value="ollama-local">Ollama (http://127.0.0.1:11434/v1)</option>
                    <option value="openai-compatible">OpenAI-compatible API</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="builder-cron">
                    Cron schedule
                  </label>
                  <input
                    id="builder-cron"
                    className="input-field"
                    value={builderSchedule}
                    onChange={(e) => setBuilderSchedule(e.target.value)}
                  />
                </div>
              </div>

              <div className="builder-pane">
                <span className="chip chip--person">Generated workflow spec</span>
                <pre className="code-block">{builderConfig}</pre>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => navigator.clipboard?.writeText(builderConfig)}
                  >
                    Copy workflow YAML
                  </button>
                  <a className="btn" href="/ai-agent/tutorials/">
                    Read build tutorial
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="band-section">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Platforms and deployment</h2>
                <p>Self-host the MIT source code for free with Python 3.10 or Docker Compose.</p>
              </div>
            </div>

            <div className="panels">
              <div className="table-wrap">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th>Runtime option</th>
                      <th>Requirements</th>
                      <th>Memory and history</th>
                      <th>Best for</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Python CLI</td>
                      <td className="measured">Python 3.10+</td>
                      <td>Local SQLite</td>
                      <td>Scripts and CI</td>
                    </tr>
                    <tr>
                      <td>Docker</td>
                      <td className="measured">Port 8080</td>
                      <td>Mounted volume</td>
                      <td>Self-hosted API</td>
                    </tr>
                    <tr>
                      <td>LLM mode</td>
                      <td className="measured">OpenAI or Ollama</td>
                      <td>SQLite trace</td>
                      <td>Research briefs</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="statement-footer">
        <div className="container footer-grid">
          <div className="hero-copy">
            <h2>Run your first agent in 30 seconds</h2>
            <p className="lead">
              Zero mandatory dependencies. Clone the repository and inspect every tool call locally.
            </p>
            <div className="action-row">
              <a
                className="btn btn--primary"
                href="https://github.com/developer-assistants/ai-agent"
                rel="noreferrer"
              >
                Download on GitHub
              </a>
              <a className="btn" href="/ai-agent/llms.txt">
                Read llms.txt
              </a>
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-col">
              <h3>Agents</h3>
              <a href="/ai-agent/agents/seo/">SEO</a>
              <a href="/ai-agent/agents/coding/">Coding</a>
              <a href="/ai-agent/agents/sales/">Sales</a>
              <a href="/ai-agent/agents/research/">Research</a>
              <a href="/ai-agent/agents/email/">Email</a>
              <a href="/ai-agent/agents/browser/">Browser</a>
            </div>
            <div className="footer-col">
              <h3>Business</h3>
              <a href="/ai-agent/agents/data-analysis/">Data</a>
              <a href="/ai-agent/agents/document/">Documents</a>
              <a href="/ai-agent/agents/contract/">Contracts</a>
              <a href="/ai-agent/agents/competitor/">Competitor</a>
              <a href="/ai-agent/agents/support/">Support</a>
              <a href="/ai-agent/agents/github/">GitHub</a>
            </div>
            <div className="footer-col">
              <h3>Guides</h3>
              <a href="/ai-agent/examples/">Examples</a>
              <a href="/ai-agent/builder/">Builder</a>
              <a href="/ai-agent/development/">Development</a>
              <a href="/ai-agent/open-source/">Open source</a>
              <a href="/ai-agent/tutorials/">Tutorials</a>
              <a href="/ai-agent/sitemap.xml">Sitemap</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
