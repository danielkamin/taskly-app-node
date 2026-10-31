#!/usr/bin/env node
// Condenses a `claude -p --output-format stream-json` log into summary.json for the PR comment,
// and surfaces permission denials as workflow warnings.
// Usage: node summarize-session.mjs <session.jsonl> <summary.json>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [sessionFile, summaryFile] = process.argv.slice(2);
const events = existsSync(sessionFile)
  ? readFileSync(sessionFile, 'utf8').split('\n').flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } })
  : [];
const result = events.findLast((e) => e.type === 'result');
const denials = (result?.permission_denials ?? []).map((d) => `${d.tool_name}: ${JSON.stringify(d.tool_input).slice(0, 160)}`);
const summary = {
  finished: Boolean(result),
  isError: result?.is_error ?? true,
  turns: result?.num_turns ?? null,
  costUsd: result?.total_cost_usd ?? null,
  durationMs: result?.duration_ms ?? null,
  finalMessage: (result?.result ?? '').slice(0, 3000),
  denials,
};
writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
for (const denial of denials) console.log(`::warning::Permission denied to the agent: ${denial.replace(/\r?\n/g, ' ')}`);
console.log(`Agent: ${summary.turns} turns, $${summary.costUsd}, ${denials.length} permission denials`);
