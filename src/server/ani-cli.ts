/**
 * Everything that talks to ani-cli lives here. The rest of the server (API
 * routes etc.) should only call the exported functions, never spawn ani-cli
 * itself.
 *
 * How we drive an interactive tool from a server:
 *
 *   ani-cli always pipes its choices (search results, episode lists) into a
 *   picker (fzf, rofi or dmenu) and waits for a selection. We put a directory
 *   at the front of ani-cli's PATH holding a fake `fzf`/`rofi`/`dmenu` that
 *   writes the menu it was given to a file and selects nothing, so ani-cli
 *   quits and we read the menu back. All three names are faked because ani-cli
 *   switches to rofi/dmenu by itself when stdin isn't a terminal.
 *
 *   To avoid menus entirely, pass everything up front: `-S <n>` picks the nth
 *   search result and `-e <ep>` picks the episode. With ANI_CLI_PLAYER=debug,
 *   ani-cli then prints the stream links instead of opening a video player.
 *
 *   The stream host rejects requests without the right Referer, which ani-cli
 *   works out per episode but doesn't print in debug mode. For stream links we
 *   run ani-cli under `sh -x` and read the `refr=...` assignment from the trace.
 *
 * Results are identified by (query, index): ani-cli has no stable IDs, it just
 * numbers the search results for a query.
 */
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SearchResult, StreamLinks, TranslationMode } from "@shared/types";
import { run, stripAnsi } from "./lib/shell";

const ANI_CLI = process.env.ANI_CLI_BIN ?? "ani-cli";
const TIMEOUT_MS = 30_000;

export class AniCliError extends Error {
  /** HTTP status the API should answer with: 400 for bad input, 502 when ani-cli itself failed. */
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** Search for anime. Each result's `index` is what the other commands take. */
export async function search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  query = checkQuery(query);
  const { menu, stderr } = await exec([query], { signal });

  if (!menu) {
    if (/no results found/i.test(stderr)) return [];
    throw new AniCliError(stderr || "ani-cli exited without showing results");
  }

  if (/select episode/i.test(menu.prompt)) {
    // Exactly one match: ani-cli auto-selects it and jumps straight to the
    // episode menu, so the anime's real title never reaches us.
    // TODO: get the real title (e.g. by doing the search request in TS).
    return [{ index: 1, title: query }];
  }

  // Menu lines look like "<index> <title>".
  return menu.items.flatMap((line) => {
    const match = /^(\d+) (.+)$/.exec(line);
    return match ? [{ index: Number(match[1]), title: match[2]! }] : [];
  });
}

export interface AnimeOptions {
  mode?: TranslationMode;
  signal?: AbortSignal;
}

/** List the episode numbers of the `index`th result for `query`. */
export async function episodes(
  query: string,
  index: number,
  { mode = "sub", signal }: AnimeOptions = {},
): Promise<string[]> {
  const args = [...selectArgs(query, index), ...modeArgs(mode)];
  const { menu, stdout, stderr } = await exec(args, { signal });

  if (menu && /select episode/i.test(menu.prompt)) return menu.items;

  // With a single episode ani-cli skips the menu and goes straight to
  // "playing" it, which in debug mode prints the links and exits cleanly.
  // The episode number isn't printed; single-episode releases are numbered 1.
  if (stdout.includes("Selected link:")) return ["1"];

  throw new AniCliError(stderr || "ani-cli exited without listing episodes");
}

/** Stream links plus the Referer the stream host expects (server-side only). */
export interface StreamLinksWithReferer extends StreamLinks {
  referer: string | null;
}

export interface StreamOptions extends AnimeOptions {
  /** "best", "worst" or a resolution like "720". Defaults to best. */
  quality?: string;
}

/** Get the video (HLS .m3u8) and subtitle URLs for one episode. */
export async function streamLinks(
  query: string,
  index: number,
  episode: string,
  { mode = "sub", quality, signal }: StreamOptions = {},
): Promise<StreamLinksWithReferer> {
  if (!/^\d+(\.\d+)?$/.test(episode)) throw new AniCliError("Invalid episode number", 400);
  if (quality !== undefined && !/^(best|worst|\d{3,4}p?)$/.test(quality)) {
    throw new AniCliError("Invalid quality", 400);
  }

  const args = [
    ...selectArgs(query, index),
    ...modeArgs(mode),
    "-e",
    episode,
    ...(quality ? ["-q", quality] : []),
  ];
  const { stdout, stderr, exitCode, trace } = await exec(args, { signal, trace: true });
  if (exitCode !== 0 || !stdout.includes("Selected link:")) {
    throw new AniCliError(stderr || "ani-cli didn't return any links");
  }
  return { ...parseDebugOutput(stdout), referer: parseReferer(trace) };
}

/** The installed ani-cli version, e.g. "5.1.0". */
export async function version(): Promise<string> {
  const { stdout } = await run(ANI_CLI, ["--version"], { timeoutMs: 5_000 });
  return stripAnsi(stdout).trim();
}

// ---------------------------------------------------------------------------
// Argument helpers
// ---------------------------------------------------------------------------

function checkQuery(query: string): string {
  query = query.trim();
  if (!query) throw new AniCliError("Search query is empty", 400);
  // ani-cli parses every argument starting with "-" as a flag (e.g. -D wipes
  // history) and has no "--" terminator, so never hand it one.
  if (query.startsWith("-")) throw new AniCliError("Search query can't start with '-'", 400);
  return query;
}

function selectArgs(query: string, index: number): string[] {
  if (!Number.isInteger(index) || index < 1) throw new AniCliError("Invalid result index", 400);
  return ["-S", String(index), checkQuery(query)];
}

function modeArgs(mode: TranslationMode): string[] {
  return mode === "dub" ? ["--dub"] : [];
}

// ---------------------------------------------------------------------------
// Running ani-cli
// ---------------------------------------------------------------------------

interface Menu {
  /** Arguments ani-cli passed to the picker; includes the prompt text. */
  prompt: string;
  items: string[];
}

interface ExecOptions {
  signal?: AbortSignal;
  /** Run under `sh -x` and return the trace (see `parseReferer`). */
  trace?: boolean;
}

interface ExecResult {
  stdout: string;
  /** ANSI codes stripped; ani-cli's error messages end up here. */
  stderr: string;
  /** Raw `sh -x` trace when `trace` was set, otherwise "". */
  trace: string;
  exitCode: number | null;
  /** The first menu ani-cli tried to show, or null if it never showed one. */
  menu: Menu | null;
}

/** Runs ani-cli non-interactively in a throwaway directory. */
async function exec(args: string[], { signal, trace = false }: ExecOptions = {}): Promise<ExecResult> {
  let cmd = ANI_CLI;
  if (trace) {
    // `sh -x` needs a path, not a bare command name.
    const path = Bun.which(ANI_CLI);
    if (!path) throw new AniCliError(`${ANI_CLI} not found on PATH`);
    cmd = "sh";
    args = ["-x", path, ...args];
  }

  const shimDir = await getMenuShimDir();
  const workDir = await mkdtemp(join(tmpdir(), "keithwatch-run-"));
  const menuFile = join(workDir, "menu.txt");

  try {
    const result = await run(cmd, args, {
      cwd: workDir,
      env: {
        PATH: `${shimDir}:${process.env.PATH ?? ""}`,
        KEITHWATCH_MENU_CAPTURE: menuFile,
        ANI_CLI_MENU: "fzf",
        // Print links instead of launching a player (also skips the check
        // that a video player is installed).
        ANI_CLI_PLAYER: "debug",
        // Debug "playback" still records watch history; keep it out of the
        // user's real ani-cli history.
        ANI_CLI_HIST_DIR: workDir,
        // Marks trace lines so they can be told apart from real stderr.
        PS4: TRACE_PREFIX,
      },
      timeoutMs: TIMEOUT_MS,
      signal,
    });

    const captured = await readFile(menuFile, "utf8").catch(() => null);
    let menu: Menu | null = null;
    if (captured !== null) {
      const [prompt = "", ...items] = captured.split("\n");
      menu = { prompt, items: items.filter(Boolean) };
    }

    const stderr = stripAnsi(result.stderr);
    return {
      stdout: stripAnsi(result.stdout),
      stderr: trace ? lastErrorLine(stderr) : stderr.trim(),
      trace: trace ? stderr : "",
      exitCode: result.exitCode,
      menu,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Parses ani-cli's debug-player output:
 *
 *   All links:
 *   1080 >https://.../1080/index.m3u8
 *   720 >https://.../720/index.m3u8
 *   Selected link:
 *   https://.../1080/index.m3u8
 *   Subtitles:
 *   https://.../subs/en.vtt
 */
function parseDebugOutput(stdout: string): StreamLinks {
  const section = (name: string, next?: string) => {
    const start = stdout.indexOf(`${name}:\n`);
    if (start === -1) return [];
    const from = start + name.length + 2;
    const end = next ? stdout.indexOf(`${next}:\n`, from) : -1;
    return stdout
      .slice(from, end === -1 ? undefined : end)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  };

  const links = section("All links", "Selected link").flatMap((line) => {
    const [quality, url] = line.split(" >");
    return quality && url ? [{ quality, url }] : [];
  });

  return {
    links,
    selected: section("Selected link", "Subtitles")[0] ?? links[0]?.url ?? "",
    subtitles: section("Subtitles")[0] ?? null,
  };
}

/** PS4 for traced runs. Nested subshells repeat the first character ("++kw-trace "). */
const TRACE_PREFIX = "+kw-trace ";
const TRACE_LINE = /^\++kw-trace /;

/**
 * Reads the Referer from an `sh -x` trace. ani-cli sets it with
 * `refr="$(... embed url ...)"`, which the trace prints as `+kw-trace refr=https://host/`
 * (possibly quoted). The last assignment wins, as in the script.
 */
function parseReferer(trace: string): string | null {
  let referer: string | null = null;
  for (const line of trace.split("\n")) {
    const match = /^\+kw-trace refr='?(https?:\/\/[^'\s]+)'?$/.exec(line);
    if (match) referer = match[1]!;
  }
  return referer;
}

/**
 * With tracing on, stderr is mostly trace output (some of it multi-line). ani-cli's
 * `die` prints its message and exits, so the last non-trace line is the error.
 */
function lastErrorLine(stderr: string): string {
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !TRACE_LINE.test(line) && !line.startsWith("tput:"));
  return lines.at(-1) ?? "";
}

const MENU_SHIM = `#!/bin/sh
# keithwatch: stand-in for fzf/rofi/dmenu. Record the menu, select nothing.
{ printf '%s\\n' "$*"; cat; } > "$KEITHWATCH_MENU_CAPTURE"
exit 1
`;

let shimDir: Promise<string> | undefined;

/** Directory with the fake pickers. Created once per server process. */
function getMenuShimDir(): Promise<string> {
  shimDir ??= (async () => {
    const dir = await mkdtemp(join(tmpdir(), "keithwatch-menu-"));
    const script = join(dir, "menu-shim");
    await writeFile(script, MENU_SHIM);
    await chmod(script, 0o755);
    await Promise.all(["fzf", "rofi", "dmenu"].map((name) => symlink(script, join(dir, name))));
    return dir;
  })();
  return shimDir;
}
