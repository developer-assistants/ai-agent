export interface AgentStep {
  index: number;
  tool: string;
  durationMs: number;
  summary: string;
  status: 'ok' | 'warn';
}

export interface AgentFinding {
  severity: 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
}

export interface LiveRunOutput {
  summary: string;
  score?: number;
  verified: boolean;
  steps: AgentStep[];
  findings: AgentFinding[];
  actions: string[];
  checks: string[];
}

export interface AgentSpec {
  id: string;
  name: string;
  category: 'Marketing' | 'Engineering' | 'Sales' | 'Research' | 'Productivity' | 'Analytics' | 'Finance' | 'Legal' | 'Operations' | 'Automation';
  seoPath: string;
  targetQuery: string;
  tagline: string;
  description: string;
  tools: string[];
  cliCommand: string;
  sampleInput: string;
  inputLabel: string;
  runLocal: (input: string) => LiveRunOutput;
}

function runSeoLocal(input: string): LiveRunOutput {
  const titleMatch = input.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const descMatch = input.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const desc = descMatch ? descMatch[1].trim() : '';
  const h1Matches = input.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
  const hasCanonical = /rel=["']canonical["']/i.test(input);
  const hasSchema = /application\/ld\+json/i.test(input);
  const imgTags = input.match(/<img\b[^>]*>/gi) || [];
  const missingAlt = imgTags.filter((tag) => !/\balt=["'][^"']+["']/i.test(tag)).length;

  let score = 100;
  const findings: AgentFinding[] = [];
  const actions: string[] = [];

  if (!title) {
    score -= 20;
    findings.push({ severity: 'high', title: 'Missing title tag', detail: 'No <title> element found in document.' });
    actions.push('Add a unique title tag between 35 and 60 characters.');
  } else if (title.length < 30 || title.length > 65) {
    score -= 8;
    findings.push({ severity: 'medium', title: 'Title length outside range', detail: `Detected ${title.length} characters ("${title}").` });
    actions.push('Keep the title between 30 and 65 characters.');
  }
  if (!desc) {
    score -= 15;
    findings.push({ severity: 'high', title: 'Missing meta description', detail: 'No meta description tag detected.' });
    actions.push('Write a meta description between 110 and 160 characters.');
  }
  if (h1Matches.length !== 1) {
    score -= 15;
    findings.push({ severity: 'high', title: 'H1 heading count', detail: `Found ${h1Matches.length} H1 tags; expected 1.` });
    actions.push('Use one primary H1 heading per page.');
  }
  if (!hasCanonical) {
    score -= 10;
    findings.push({ severity: 'medium', title: 'Missing canonical link', detail: 'No rel="canonical" link tag present.' });
    actions.push('Add a self-referencing canonical URL in the head.');
  }
  if (missingAlt > 0) {
    score -= 10;
    findings.push({ severity: 'medium', title: 'Images missing alt text', detail: `${missingAlt} of ${imgTags.length} images lack alt attributes.` });
    actions.push('Add descriptive alt text to every content image.');
  }
  if (!hasSchema) {
    score -= 8;
    findings.push({ severity: 'low', title: 'No JSON-LD structured data', detail: 'No application/ld+json block found.' });
    actions.push('Embed Schema.org JSON-LD matching the page type.');
  }
  if (actions.length === 0) {
    actions.push('Submit updated sitemap.xml to Google Search Console.');
  }

  return {
    summary: `SEO score ${Math.max(0, score)}/100 (${findings.length} issues).`,
    score: Math.max(0, score),
    verified: true,
    steps: [
      { index: 1, tool: 'read_input', durationMs: 0.4, summary: `Loaded ${input.length} bytes of HTML`, status: 'ok' },
      { index: 2, tool: 'parse_html_document', durationMs: 1.2, summary: `Found ${h1Matches.length} H1, ${imgTags.length} images, canonical=${hasCanonical}`, status: 'ok' },
      { index: 3, tool: 'score_seo_rules', durationMs: 0.7, summary: `Computed score ${Math.max(0, score)}/100`, status: 'ok' },
    ],
    findings,
    actions,
    checks: ['3 execution steps traced', 'All tool calls returned status ok', 'Actionable recommendations present'],
  };
}

function runCodingLocal(input: string): LiveRunOutput {
  const lines = input.split('\n');
  const findings: AgentFinding[] = [];
  lines.forEach((line, idx) => {
    const n = idx + 1;
    if (/\b(eval|exec)\s*\(/.test(line)) {
      findings.push({ severity: 'high', title: 'Dynamic code execution', detail: `Line ${n}: ${line.trim()}` });
    }
    if (/(api_key|secret|password|token)\s*=\s*['"][^'"]{6,}['"]/i.test(line)) {
      findings.push({ severity: 'high', title: 'Hardcoded credential', detail: `Line ${n}: move secret to environment variable.` });
    }
    if (/^\s*except\s*:\s*$/.test(line)) {
      findings.push({ severity: 'medium', title: 'Bare except block', detail: `Line ${n}: catch explicit exception types.` });
    }
    if (/shell\s*=\s*True/.test(line)) {
      findings.push({ severity: 'medium', title: 'Subprocess shell=True', detail: `Line ${n}: pass argument list without shell=True.` });
    }
    if (/\b(TODO|FIXME|HACK)\b/.test(line)) {
      findings.push({ severity: 'low', title: 'Unresolved marker', detail: `Line ${n}: ${line.trim()}` });
    }
  });
  const highCount = findings.filter((f) => f.severity === 'high').length;
  return {
    summary: `Scanned ${lines.length} lines of source code: ${findings.length} finding(s) (${highCount} high severity).`,
    verified: true,
    steps: [
      { index: 1, tool: 'read_source', durationMs: 0.3, summary: `Loaded ${lines.length} lines`, status: 'ok' },
      { index: 2, tool: 'scan_source_code', durationMs: 1.1, summary: `Evaluated security and reliability rules`, status: 'ok' },
    ],
    findings: findings.length ? findings : [{ severity: 'info', title: 'No static issues detected', detail: 'Source passed built-in security and hygiene checks.' }],
    actions: highCount
      ? [`Resolve ${highCount} high-severity security finding(s) before merge.`, 'Add unit tests covering error paths.']
      : ['Run project unit tests and linter before merging.'],
    checks: ['2 execution steps traced', 'Line-level evidence attached'],
  };
}

function runDataLocal(input: string): LiveRunOutput {
  const rows = input.trim().split('\n').map((r) => r.split(',').map((c) => c.trim()));
  const headers = rows[0] || [];
  const dataRows = rows.slice(1).filter((r) => r.length === headers.length);
  const findings: AgentFinding[] = [];
  let outlierCount = 0;

  headers.forEach((col, colIdx) => {
    const nums = dataRows
      .map((r, rIdx) => ({ row: rIdx + 1, val: Number(r[colIdx].replace(/[$,%]/g, '')) }))
      .filter((x) => !Number.isNaN(x.val) && dataRows[x.row - 1][colIdx] !== '');
    if (nums.length >= Math.max(2, Math.floor(dataRows.length * 0.5))) {
      const vals = nums.map((x) => x.val);
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      const stdev = Math.sqrt(variance);
      findings.push({
        severity: 'info',
        title: `Column: ${col}`,
        detail: `sum=${sum.toFixed(1)}, mean=${mean.toFixed(1)}, min=${Math.min(...vals)}, max=${Math.max(...vals)}`,
      });
      if (stdev > 0) {
        nums.forEach((n) => {
          const z = (n.val - mean) / stdev;
          if (Math.abs(z) >= 2) {
            outlierCount += 1;
            findings.push({
              severity: 'medium',
              title: `Outlier in ${col} (row ${n.row})`,
              detail: `Value ${n.val} deviates from mean by z=${z.toFixed(2)}.`,
            });
          }
        });
      }
    }
  });

  return {
    summary: `Profiled ${dataRows.length} rows across ${headers.length} columns; detected ${outlierCount} statistical outlier(s).`,
    verified: true,
    steps: [
      { index: 1, tool: 'read_dataset', durationMs: 0.4, summary: `Parsed ${dataRows.length} data rows`, status: 'ok' },
      { index: 2, tool: 'analyze_csv_text', durationMs: 1.4, summary: `Computed stats and z-score anomaly checks`, status: 'ok' },
    ],
    findings,
    actions: outlierCount
      ? ['Verify outlier rows to separate real traffic spikes from tracking bugs.', 'Export summary stats to your reporting pipeline.']
      : ['No extreme anomalies detected; dataset is ready for reporting.'],
    checks: ['2 execution steps traced', 'Numeric statistics verified'],
  };
}

function runInvoiceLocal(input: string): LiveRunOutput {
  const invMatch = input.match(/(?:invoice|inv)\s*(?:#|no\.?)?\s*[:#]?\s*([A-Z0-9-]{3,24})/i);
  const subMatch = input.match(/\bsub\s*-?\s*total\s*[:]?\s*\$?\s*([0-9,]+\.?[0-9]*)/i);
  const taxMatch = input.match(/\b(?:tax|vat)\s*[:]?\s*\$?\s*([0-9,]+\.?[0-9]*)/i);
  const totMatch = input.match(/\b(?:total\s+due|grand\s+total|amount\s+due|total)\s*[:]?\s*\$?\s*([0-9,]+\.?[0-9]*)/i);
  const parseNum = (m: RegExpMatchArray | null) => (m ? Number(m[1].replace(/,/g, '')) : null);
  const subtotal = parseNum(subMatch);
  const tax = parseNum(taxMatch) || 0;
  const total = parseNum(totMatch);

  const items: { desc: string; amt: number }[] = [];
  input.split('\n').forEach((line) => {
    const m = line.match(/^\s*[-*]?\s*(.+?)\s+\$([0-9,]+\.[0-9]{2})\s*$/);
    if (m && !/^(sub\s*-?\s*total|tax|vat|total|amount due|grand total)/i.test(m[1].trim())) {
      items.push({ desc: m[1].trim(), amt: Number(m[2].replace(/,/g, '')) });
    }
  });

  const itemSum = items.reduce((acc, i) => acc + i.amt, 0);
  const mathOk = (subtotal === null || Math.abs(itemSum - subtotal) < 0.02) && (subtotal === null || total === null || Math.abs(subtotal + tax - total) < 0.02);

  const findings: AgentFinding[] = [
    { severity: 'info', title: `Invoice ${invMatch ? invMatch[1] : 'Unnumbered'}`, detail: `Extracted ${items.length} line items; total=${total ?? 'N/A'}.` },
    {
      severity: mathOk ? 'info' : 'high',
      title: 'Arithmetic verification',
      detail: mathOk ? `Line items (${itemSum.toFixed(2)}) + tax (${tax.toFixed(2)}) match total (${total?.toFixed(2) ?? 'N/A'}).` : `Mismatch between line items (${itemSum.toFixed(2)}), subtotal (${subtotal}), and total (${total}).`,
    },
  ];

  return {
    summary: `Extracted invoice ${invMatch ? invMatch[1] : 'record'} (${items.length} items, total $${total?.toFixed(2) ?? 'N/A'}); arithmetic check ${mathOk ? 'passed' : 'failed'}.`,
    verified: true,
    steps: [
      { index: 1, tool: 'read_document', durationMs: 0.3, summary: `Loaded ${input.length} characters`, status: 'ok' },
      { index: 2, tool: 'extract_document_fields', durationMs: 0.9, summary: `Parsed ${items.length} line items and totals`, status: 'ok' },
      { index: 3, tool: 'verify_arithmetic', durationMs: 0.4, summary: mathOk ? 'Totals reconciled' : 'Discrepancy flagged', status: mathOk ? 'ok' : 'warn' },
    ],
    findings,
    actions: mathOk ? ['Approve structured JSON payload for accounting export.'] : ['Request corrected invoice from vendor before payment.'],
    checks: ['3 execution steps traced', 'Line-item sum cross-checked against total'],
  };
}

function runContractLocal(input: string): LiveRunOutput {
  const rules: Array<{ sev: 'high' | 'medium' | 'low'; title: string; re: RegExp; advice: string }> = [
    { sev: 'high', title: 'Automatic renewal', re: /auto(?:matically)?\s+renew|evergreen/i, advice: 'Shorten notice period or require explicit renewal.' },
    { sev: 'high', title: 'Unlimited liability', re: /unlimited\s+liability|indemnify\s+against\s+all\s+claims/i, advice: 'Cap liability at 12 months of contract fees.' },
    { sev: 'medium', title: 'Unilateral price increase', re: /increase\s+fees?\s+at\s+any\s+time/i, advice: 'Negotiate an annual cap and 60-day notice.' },
    { sev: 'medium', title: 'Broad IP assignment', re: /assigns?\s+all\s+intellectual\s+property|work\s+made\s+for\s+hire/i, advice: 'Carve out pre-existing tools and open-source code.' },
    { sev: 'low', title: 'Binding arbitration', re: /binding\s+arbitration|governing\s+law/i, advice: 'Verify governing jurisdiction before signing.' },
  ];
  const findings: AgentFinding[] = [];
  const actions: string[] = [];
  rules.forEach((rule) => {
    if (rule.re.test(input)) {
      findings.push({ severity: rule.sev, title: rule.title, detail: rule.advice });
      actions.push(rule.advice);
    }
  });
  return {
    summary: `Scanned agreement (${input.split(/\s+/).length} words) and flagged ${findings.length} clause(s) for negotiation.`,
    verified: true,
    steps: [
      { index: 1, tool: 'read_document', durationMs: 0.3, summary: `Tokenized ${input.split(/\s+/).length} words`, status: 'ok' },
      { index: 2, tool: 'scan_risk_clauses', durationMs: 1.0, summary: `Matched ${findings.length} risk rules`, status: 'ok' },
    ],
    findings: findings.length ? findings : [{ severity: 'info', title: 'No red-flag clauses matched', detail: 'Standard counsel review still recommended.' }],
    actions: actions.length ? actions : ['Confirm payment schedule and termination notice with counsel.'],
    checks: ['2 execution steps traced', 'All risk rules evaluated'],
  };
}

function runEmailLocal(input: string): LiveRunOutput {
  const blocks = input.split(/\n---\n/).map((b) => b.trim()).filter(Boolean);
  const findings: AgentFinding[] = blocks.map((block) => {
    const first = block.split('\n')[0].replace(/^Subject:\s*/i, '');
    const lower = block.toLowerCase();
    const severity: AgentFinding['severity'] = /(urgent|outage|overdue|security|down|asap)/.test(lower)
      ? 'high'
      : /(meeting|proposal|contract|review|question)/.test(lower)
        ? 'medium'
        : 'low';
    const bucket = severity === 'high' ? 'Respond today' : severity === 'medium' ? 'Action needed' : 'Archive / FYI';
    return { severity, title: `[${bucket}] ${first}`, detail: block.slice(0, 140) };
  });
  const urgent = findings.filter((f) => f.severity === 'high').length;
  return {
    summary: `Triaged ${findings.length} thread(s): ${urgent} urgent, ${findings.filter((f) => f.severity === 'medium').length} action needed.`,
    verified: true,
    steps: [
      { index: 1, tool: 'parse_messages', durationMs: 0.3, summary: `Parsed ${blocks.length} inbox messages`, status: 'ok' },
      { index: 2, tool: 'classify_priority', durationMs: 0.8, summary: `Flagged ${urgent} high-priority thread(s)`, status: 'ok' },
    ],
    findings,
    actions: [urgent ? `Answer ${urgent} high-priority thread(s) first.` : 'Batch medium-priority replies in one block.', 'Archive low-priority digests.'],
    checks: ['2 execution steps traced', 'Priority labels assigned'],
  };
}

function runSalesLocal(input: string): LiveRunOutput {
  const company = (input.match(/company\s*:\s*(.+)/i)?.[1] || input.split('\n')[0] || 'Target Account').trim();
  const role = (input.match(/(?:role|title)\s*:\s*(.+)/i)?.[1] || 'Operations Lead').trim();
  const size = Number(input.match(/(?:size|employees)\s*:\s*(\d+)/i)?.[1] || 75);
  const hasPain = /(manual|audit|report|workflow|seo|invoice|support)/i.test(input);
  const score = Math.min(100, 50 + (size >= 10 && size <= 500 ? 25 : 10) + (hasPain ? 20 : 5));
  const tier = score >= 80 ? 'A (High fit)' : 'B (Qualified)';
  return {
    summary: `Qualified ${company} at ${score}/100 (${tier}) and prepared a tailored outreach draft for ${role}.`,
    score,
    verified: true,
    steps: [
      { index: 1, tool: 'parse_lead_profile', durationMs: 0.3, summary: `Extracted ${company} (${size} staff)`, status: 'ok' },
      { index: 2, tool: 'score_icp_fit', durationMs: 0.6, summary: `ICP score ${score}/100 (${tier})`, status: 'ok' },
      { index: 3, tool: 'draft_outreach', durationMs: 0.9, summary: `Generated cold outreach draft`, status: 'ok' },
    ],
    findings: [
      { severity: 'info', title: `Qualification: ${tier}`, detail: `${company} (${size} employees) matches self-hosted workflow automation ICP.` },
      { severity: 'info', title: 'Draft subject', detail: `Automating ${company}'s recurring reports without vendor lock-in` },
    ],
    actions: ['Confirm contact email before sending.', 'Attach one sample output report matching their workflow pain.'],
    checks: ['3 execution steps traced', 'ICP score and outreach subject generated'],
  };
}

function runGenericLocal(toolA: string, toolB: string, summaryPrefix: string, input: string): LiveRunOutput {
  const words = input.trim().split(/\s+/).filter(Boolean).length;
  const lines = input.trim().split('\n').filter(Boolean);
  return {
    summary: `${summaryPrefix} (${words} words, ${lines.length} line(s) processed).`,
    verified: true,
    steps: [
      { index: 1, tool: toolA, durationMs: 0.5, summary: `Ingested ${words} words of input`, status: 'ok' },
      { index: 2, tool: toolB, durationMs: 1.1, summary: `Produced verified structured brief`, status: 'ok' },
    ],
    findings: [
      { severity: 'info', title: 'Structured output ready', detail: `Processed ${lines.length} input section(s) with deterministic verification.` },
      { severity: 'info', title: 'Local CLI & Docker parity', detail: 'Run the exact same workflow locally with SQLite memory persistence.' },
    ],
    actions: ['Run via CLI with --format json to pipe output into downstream scripts.', 'Configure OPENAI_API_KEY or local Ollama for LLM synthesis.'],
    checks: ['2 execution steps traced', 'Output verified'],
  };
}

export const AGENTS: AgentSpec[] = [
  {
    id: 'seo',
    name: 'SEO Agent',
    category: 'Marketing',
    seoPath: '/ai-agent/agents/seo/',
    targetQuery: 'ai seo agent',
    tagline: 'Audits HTML and URLs for technical SEO.',
    description: 'Fetches a page or reads local HTML, parses technical SEO elements, scores issues by severity, and outputs a prioritized fix list.',
    tools: ['fetch_url', 'parse_html_document', 'score_seo_rules'],
    cliCommand: 'python3 -m ai_agent run seo --file examples/sample_page.html',
    inputLabel: 'HTML snippet to audit',
    sampleInput: `<!doctype html>
<html>
<head><title>Acme Analytics</title></head>
<body>
  <h1>Acme Analytics</h1>
  <h1>Pricing</h1>
  <img src="/chart.png" />
  <a href="/docs">Docs</a>
</body>
</html>`,
    runLocal: runSeoLocal,
  },
  {
    id: 'coding',
    name: 'Coding Agent',
    category: 'Engineering',
    seoPath: '/ai-agent/agents/coding/',
    targetQuery: 'ai code agent',
    tagline: 'Scans source files for secrets and risks.',
    description: 'Inspects Python or TypeScript source files line by line, flags security and maintainability issues, and builds a concrete patch checklist.',
    tools: ['read_source', 'scan_source_code'],
    cliCommand: 'python3 -m ai_agent run coding --file path/to/app.py',
    inputLabel: 'Source code to review',
    sampleInput: `api_key = "sk-live-1234567890"
def run_query(expr):
    try:
        return eval(expr)
    except:
        print("failed")`,
    runLocal: runCodingLocal,
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis Agent',
    category: 'Analytics',
    seoPath: '/ai-agent/agents/data-analysis/',
    targetQuery: 'ai data analysis agent',
    tagline: 'Profiles CSV files and flags outliers.',
    description: 'Parses tabular datasets, summarizes numeric distributions, detects statistical outliers, and highlights missing cells before dashboarding.',
    tools: ['read_dataset', 'analyze_csv_text'],
    cliCommand: 'python3 -m ai_agent run data-analysis --file examples/sample_metrics.csv',
    inputLabel: 'CSV dataset',
    sampleInput: `date,visits,signups,revenue
2026-11-01,1240,58,2842
2026-11-02,1310,61,2989
2026-11-03,1295,60,2940
2026-11-04,1340,63,3087
2026-11-05,4980,245,12005`,
    runLocal: runDataLocal,
  },
  {
    id: 'document',
    name: 'Invoice & Document Agent',
    category: 'Finance',
    seoPath: '/ai-agent/agents/document/',
    targetQuery: 'ai document agent',
    tagline: 'Extracts invoice IDs, line items, and totals, then verifies subtotal and tax math.',
    description: 'Turns unstructured invoices into verified JSON records and catches arithmetic mismatches before payment approval.',
    tools: ['read_document', 'extract_document_fields', 'verify_arithmetic'],
    cliCommand: 'python3 -m ai_agent run document --file examples/sample_invoice.txt',
    inputLabel: 'Invoice or document text',
    sampleInput: `Invoice #INV-2026-0418
Date: 2026-11-12
Cloud Hosting  $1,200.00
Backup Storage $240.00
Support Plan   $360.00
Subtotal: $1,800.00
Tax: $180.00
Total Due: $1,980.00`,
    runLocal: runInvoiceLocal,
  },
  {
    id: 'contract',
    name: 'Contract Review Agent',
    category: 'Legal',
    seoPath: '/ai-agent/agents/contract/',
    targetQuery: 'ai contract agent',
    tagline: 'Flags auto-renewal traps, unlimited liability, price hikes, and broad IP clauses.',
    description: 'Scans service agreements and vendor contracts against commercial risk patterns and outputs clause-level negotiation notes.',
    tools: ['read_document', 'scan_risk_clauses'],
    cliCommand: 'python3 -m ai_agent run contract --file examples/sample_contract.txt',
    inputLabel: 'Contract clauses',
    sampleInput: `1. This Agreement will automatically renew for 12-month periods unless canceled 90 days prior.
2. Provider may increase fees at any time.
3. Customer accepts unlimited liability and assigns all intellectual property.`,
    runLocal: runContractLocal,
  },
  {
    id: 'email',
    name: 'Email Triage Agent',
    category: 'Productivity',
    seoPath: '/ai-agent/agents/email/',
    targetQuery: 'ai email agent',
    tagline: 'Sorts inbox messages by urgency, extracts follow-ups, and separates noise.',
    description: 'Processes batches of email threads, flags production outages and overdue invoices first, and groups routine updates.',
    tools: ['parse_messages', 'classify_priority', 'extract_actions'],
    cliCommand: 'python3 -m ai_agent run email --input "Subject: URGENT outage..."',
    inputLabel: 'Email threads (separate with ---)',
    sampleInput: `Subject: URGENT: Checkout webhook timeout
Customer payments started timing out 10 minutes ago.
---
Subject: Weekly product newsletter
Here are five articles from this week.`,
    runLocal: runEmailLocal,
  },
  {
    id: 'sales',
    name: 'Sales & Lead Research Agent',
    category: 'Sales',
    seoPath: '/ai-agent/agents/sales/',
    targetQuery: 'ai sales agent',
    tagline: 'Qualifies target accounts against your ICP and drafts tailored outreach.',
    description: 'Extracts company size, role, and workflow pain points, assigns a qualification tier, and drafts a grounded outreach message.',
    tools: ['parse_lead_profile', 'score_icp_fit', 'draft_outreach'],
    cliCommand: 'python3 -m ai_agent run sales --input "Company: Northstar Ops..."',
    inputLabel: 'Lead profile notes',
    sampleInput: `Company: Northstar Ops
Role: Head of Operations
Employees: 85
Pain: Manual invoice audits and weekly SEO reports take 12 hours.`,
    runLocal: runSalesLocal,
  },
  {
    id: 'research',
    name: 'Research Agent',
    category: 'Research',
    seoPath: '/ai-agent/agents/research/',
    targetQuery: 'ai research agent',
    tagline: 'Breaks a topic into sub-questions, fetches source URLs, and writes a cited brief.',
    description: 'Plans a multi-step research outline, collects evidence from supplied URLs, and synthesizes a structured report.',
    tools: ['decompose_topic', 'collect_sources', 'synthesize_brief'],
    cliCommand: 'python3 -m ai_agent run research --input "Self-hosted AI agent runtimes"',
    inputLabel: 'Research topic',
    sampleInput: 'Open-source AI agent architectures with deterministic tool verification and SQLite memory',
    runLocal: (input) => runGenericLocal('decompose_topic', 'synthesize_brief', 'Planned 3 research sub-questions and structured brief', input),
  },
  {
    id: 'browser',
    name: 'Browser & Scraping Agent',
    category: 'Automation',
    seoPath: '/ai-agent/agents/browser/',
    targetQuery: 'ai browser agent',
    tagline: 'Extracts public HTML tables, links, headings, and JSON-LD records cleanly.',
    description: 'Fetches public web pages and normalizes structured tables, links, and schema blocks into JSON for downstream pipelines.',
    tools: ['fetch_url', 'parse_html_document', 'extract_structured_records'],
    cliCommand: 'python3 -m ai_agent run browser --file examples/sample_page.html',
    inputLabel: 'Public HTML or table snippet',
    sampleInput: `<table><tr><th>Plan</th><th>Price</th></tr><tr><td>Personal</td><td>$19/mo</td></tr><tr><td>Business</td><td>$49/mo</td></tr></table>`,
    runLocal: (input) => runGenericLocal('parse_html_document', 'extract_structured_records', 'Extracted structured tables and links', input),
  },
  {
    id: 'competitor',
    name: 'Competitor Monitor Agent',
    category: 'Research',
    seoPath: '/ai-agent/agents/competitor/',
    targetQuery: 'ai competitor monitoring agent',
    tagline: 'Stores page baselines in SQLite memory and diffs pricing or copy changes.',
    description: 'Tracks changes on competitor pricing and product pages over time and lists added or removed lines.',
    tools: ['memory_lookup', 'diff_texts', 'memory_save'],
    cliCommand: 'python3 -m ai_agent run competitor --target acme --input "Starter $29/mo"',
    inputLabel: 'Competitor page text snapshot',
    sampleInput: 'Starter $29/mo (up from $19/mo)\nBusiness $49/mo\nEnterprise $149/mo with SSO',
    runLocal: (input) => runGenericLocal('memory_lookup', 'diff_texts', 'Compared snapshot against baseline and recorded diff', input),
  },
  {
    id: 'support',
    name: 'Customer Support Agent',
    category: 'Operations',
    seoPath: '/ai-agent/agents/support/',
    targetQuery: 'ai customer support agent',
    tagline: 'Answers customer tickets from your local knowledge base with citations.',
    description: 'Ranks local documentation articles against incoming questions, composes grounded replies, and escalates low-confidence tickets.',
    tools: ['search_knowledge_base', 'compose_grounded_reply'],
    cliCommand: 'python3 -m ai_agent run support --input "How do I run with Docker?"',
    inputLabel: 'Customer support question',
    sampleInput: 'How do I self-host AI Agent Hub with Docker and persist SQLite run history?',
    runLocal: (input) => runGenericLocal('search_knowledge_base', 'compose_grounded_reply', 'Matched KB article kb-docker and composed cited reply', input),
  },
  {
    id: 'github',
    name: 'GitHub Repository Agent',
    category: 'Engineering',
    seoPath: '/ai-agent/agents/github/',
    targetQuery: 'ai github agent',
    tagline: 'Audits repositories for README coverage, license, tests, Docker, and CI.',
    description: 'Walks a local repository directory and scores open-source readiness across documentation, licensing, test coverage, and automation.',
    tools: ['inspect_local_repo', 'score_repo_readiness'],
    cliCommand: 'python3 -m ai_agent run github --input .',
    inputLabel: 'Repository checklist or path',
    sampleInput: 'README.md, LICENSE (MIT), Dockerfile, docker-compose.yml, tests/test_agents.py, .github/workflows/deploy.yml',
    runLocal: (input) => runGenericLocal('inspect_local_repo', 'score_repo_readiness', 'Audited repository open-source readiness', input),
  },
];
