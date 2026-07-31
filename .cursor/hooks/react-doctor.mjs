import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --verbose scans on large diffs can exceed spawnSync's 1 MiB default.
const SPAWN_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'ApplyPatch']);

const readFileOrEmpty = (filePath) => {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

/**
 * Consume hook JSON from stdin without `readFileSync(0)`, which blocks until
 * EOF and can hang the hook when stdin is not a ready pipe.
 */
const readStdin = async () => {
  if (process.stdin.isTTY) {
    return '';
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const hookEventName = (input) =>
  input.hook_event_name || input.eventName || input.event_name;

const shouldScan = (input) => {
  const eventName = hookEventName(input);
  if (eventName === 'PostToolBatch') {
    const toolCalls = Array.isArray(input.tool_calls) ? input.tool_calls : [];
    return toolCalls.some((toolCall) => EDIT_TOOL_NAMES.has(toolCall.tool_name));
  }
  const toolName = input.tool_name || input.toolName || input.tool;
  // hooks.json matcher already limits invocation. If the payload omits toolName,
  // scan conservatively rather than silently skipping. If toolName is present
  // but not an edit tool, skip.
  if (toolName == null || toolName === '') {
    return true;
  }
  return EDIT_TOOL_NAMES.has(toolName);
};

const runReactDoctor = (outputPath) => {
  // Each candidate is a single shell command string (not an args array):
  // `shell: true` is required to run the Windows `.cmd` shims, and an args
  // array with `shell: true` trips Node's DEP0190. A missing command exits
  // 127 via a POSIX shell (no ENOENT error) and 9009 via cmd.exe, so fall
  // through on those. The local bin is probed with existsSync (its `./`
  // prefix form is not runnable by cmd.exe at all). With no runner found,
  // exit 0 silently — stdout is parsed as the hook's JSON.
  const localBin = process.platform === 'win32'
    ? 'node_modules\\.bin\\react-doctor.cmd'
    : './node_modules/.bin/react-doctor';
  const commands = [
    ...(existsSync(localBin)
      ? [localBin + ' --verbose --scope changed --blocking warning --no-score']
      : []),
    'react-doctor --verbose --scope changed --blocking warning --no-score',
    'pnpm dlx react-doctor@latest --verbose --scope changed --blocking warning --no-score',
    'npx --yes react-doctor@latest --verbose --scope changed --blocking warning --no-score',
  ];

  for (const command of commands) {
    const result = spawnSync(command, { encoding: 'utf8', shell: true, maxBuffer: SPAWN_MAX_BUFFER_BYTES });
    if (result.error?.code === 'ENOENT' || result.status === 127 || result.status === 9009) continue;
    try {
      writeFileSync(outputPath, (result.stdout || '') + (result.stderr || ''));
    } catch {}
    return result.status;
  }

  return 0;
};

const cleanup = (...paths) => {
  for (const path of paths) {
    try { unlinkSync(path); } catch {}
  }
};

const fail = (error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  // stderr only — stdout is reserved for hook JSON the agent parses.
  console.error(`[react-doctor hook] ${message}`);
  process.exit(1);
};

const main = async () => {
  let input;
  try {
    input = JSON.parse((await readStdin()) || '{}');
  } catch (error) {
    fail(error instanceof Error ? error : new Error(`invalid hook stdin JSON: ${String(error)}`));
  }

  if (!shouldScan(input)) {
    process.exit(0);
  }

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || join(__dirname, '../..');
  const outputPath = join(tmpdir(), `react-doctor-agent-hook-output-${process.pid}.txt`);

  try {
    process.chdir(projectRoot);
  } catch (error) {
    fail(error);
  }

  const scanResult = runReactDoctor(outputPath);
  if (scanResult === 0) {
    cleanup(outputPath);
    process.exit(0);
  }

  // Scan findings are reported via stdout JSON below. Missing scan output
  // (e.g. unwritable tmpdir) is a soft skip — not a hook runtime failure.
  const scanOutput = readFileOrEmpty(outputPath).trim();
  cleanup(outputPath);

  if (!scanOutput) {
    process.exit(0);
  }

  const message = `React Doctor found issues in the changed files. Review this output and fix the regressions before finishing. For confirmed issues that cannot be fixed now, create GitHub issues with the rule, file/line, confidence, impact, and proposed fix.\n\n${scanOutput}`;

  if (hookEventName(input) === 'PostToolBatch') {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolBatch', additionalContext: message } }));
  } else {
    console.log(JSON.stringify({ additional_context: message }));
  }
};

main().catch(fail);
