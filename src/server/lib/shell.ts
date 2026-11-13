/**
 * Thin wrapper around Bun.spawn for running external commands.
 *
 * Commands are always spawned with an argv array, never through a shell, so
 * user input passed in `args` can't be interpreted as shell syntax.
 */

export interface RunOptions {
  /** Extra environment variables, merged over the server's own environment. */
  env?: Record<string, string | undefined>;
  /** Text written to the process's stdin. Defaults to no stdin (/dev/null). */
  stdin?: string;
  /** Kill the process if it runs longer than this. */
  timeoutMs?: number;
  /** Kill the process when this signal aborts (e.g. the HTTP request was cancelled). */
  signal?: AbortSignal;
  cwd?: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  /** Set when the process was killed by a signal (timeout, abort, ...). */
  signalCode: NodeJS.Signals | null;
}

export async function run(
  cmd: string,
  args: string[] = [],
  options: RunOptions = {},
): Promise<RunResult> {
  const proc = Bun.spawn([cmd, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdin: options.stdin !== undefined ? new Blob([options.stdin]) : "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: options.timeoutMs,
    signal: options.signal,
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode: proc.exitCode, signalCode: proc.signalCode as NodeJS.Signals | null };
}

/** Removes ANSI colour/cursor escape sequences (ani-cli prints plenty of them). */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]|\r/g, "");
}
