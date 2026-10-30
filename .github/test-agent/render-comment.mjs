#!/usr/bin/env node
// Builds the sticky PR comment from the agent report and the independently verified test results.
// Inputs (env): AGENT_DIR, RESULTS_DIR, PATCH_STATUS (none|applied|rejected), AGENT_OUTCOME, RUN_URL.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const { AGENT_DIR, RESULTS_DIR, PATCH_STATUS, AGENT_OUTCOME, RUN_URL } = process.env;
const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8').trim() : '');
const json = (file) => { try { return JSON.parse(read(file)); } catch { return null; } };

const results = ['backend', 'frontend'].map((project) => ({ project, r: json(path.join(RESULTS_DIR, `${project}.json`)) }));
const testsOk = results.every(({ r }) => r?.ok);
const files = read(path.join(RESULTS_DIR, 'files.txt')).split('\n').filter(Boolean);

const verdict =
  AGENT_OUTCOME !== 'success' ? `⚠️ The agent did not finish (${AGENT_OUTCOME}). Test results below are for the PR as is.`
  : PATCH_STATUS === 'rejected' ? '⛔ The agent changed files other than tests. Its changes were discarded.'
  : !testsOk ? '❌ Tests fail. The agent changes were **not** committed.'
  : PATCH_STATUS === 'applied' ? '✅ The agent created/updated tests. They pass and will be committed to this branch.'
  : '✅ No test changes were needed. All tests pass.';

const pct = (v) => (v === undefined ? 'n/a' : `${v}%`);
const rows = results.map(({ project, r }) => !r
  ? `| ${project} | ⚠️ not run | | | | | |`
  : `| ${project} | ${r.ok ? '✅' : '❌'} | ${r.tests ? `${r.tests.passed}/${r.tests.total}` : 'n/a'} | ${pct(r.coverage?.statements)} | ${pct(r.coverage?.branches)} | ${pct(r.coverage?.functions)} | ${pct(r.coverage?.lines)} |`);
const failures = results.flatMap(({ r }) => r?.failures ?? []).slice(0, 10)
  .map((f) => `- \`${f.file}\` › ${f.test}\n  \`\`\`\n  ${f.message.split('\n').slice(0, 6).join('\n  ')}\n  \`\`\``);
const typeErrors = results.filter(({ r }) => r?.typecheck && !r.typecheck.ok)
  .map(({ project, r }) => `**${project} typecheck failed**\n\`\`\`\n${r.typecheck.errors}\n\`\`\``);
const logs = results.filter(({ r }) => r?.log).map(({ project, r }) => `<details><summary>${project} log</summary>\n\n\`\`\`\n${r.log}\n\`\`\`\n</details>`);

// The report is LLM output: neutralize @mentions so it can never ping people.
const report = read(path.join(AGENT_DIR, 'report.md')).replace(/@(?=[\w-])/g, '@​');

const body = [
  '<!-- test-agent-report -->',
  '## 🧪 Test agent',
  verdict,
  '',
  '### Verified by CI (independent of the agent)',
  '| Project | Tests + typecheck | Tests | Statements | Branches | Functions | Lines |',
  '|---|---|---|---|---|---|---|',
  ...rows,
  ...(failures.length ? ['', '**Failures**', ...failures] : []),
  ...typeErrors,
  ...logs,
  '',
  `**Changed by the agent:** ${files.length ? files.map((f) => `\`${f.replace('\t', ' ')}\``).join(', ') : 'nothing'}`,
  '',
  report ? `<details><summary>Agent report (decisions, notes)</summary>\n\n${report}\n</details>` : '_No agent report._',
  '',
  `<sub>[Workflow run](${RUN_URL}) · agent: \`test-engineer\` · skills: analyze-pr-changes, backend-unit-tests, frontend-unit-tests, run-unit-tests</sub>`,
].join('\n');

// GitHub caps comment bodies at 65536 characters.
console.log(body.length > 60000 ? `${body.slice(0, 60000)}\n\n…(truncated, see workflow run)` : body);
