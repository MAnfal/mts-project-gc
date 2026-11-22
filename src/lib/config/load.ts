import "server-only";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { z } from "zod";

/**
 * Reads `config/<relPath>` (under `process.cwd()`, resolved per call), parses it as YAML and
 * validates it with `schema`. Every failure — missing file, YAML syntax, schema mismatch — throws
 * `Config error in config/<relPath>: <field path>: <message>`, so a bad edit names the file and field.
 *
 * `opts.configDir` points at another directory; tests use it for temp fixtures.
 * On Vercel the files ship inside the function bundle via `outputFileTracingIncludes` (next.config.ts).
 */
export function readYaml<S extends z.ZodType>(
  relPath: string,
  schema: S,
  opts: { configDir?: string } = {},
): z.infer<S> {
  // The default path stays statically scoped to config/ so the bundler traces that folder, not the
  // whole project; a caller-supplied dir (tests only) is opted out of tracing.
  const file = opts.configDir
    ? path.join(/*turbopackIgnore: true*/ opts.configDir, relPath)
    : path.join(process.cwd(), "config", relPath);
  const label = `config/${relPath}`;
  const fail = (detail: string): never => {
    throw new Error(`Config error in ${label}: ${detail}`);
  };

  let data: unknown;
  try {
    data = YAML.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return fail((e as Error).message);
  }

  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.length ? issue.path.map(String).join(".") : "(root)";
  return fail(`${field}: ${issue.message}`);
}
