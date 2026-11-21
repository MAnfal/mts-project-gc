import fs from "node:fs";
import zlib from "node:zlib";
import { traceFile } from "@/lib/trace";

/** Raw execution trace (JSONL) for one run. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[\w.-]+$/.test(id)) return new Response("bad id", { status: 400 });
  const f = traceFile(id);
  if (!f) return new Response("no trace", { status: 404 });
  const body = f.endsWith(".gz") ? zlib.gunzipSync(fs.readFileSync(f)).toString("utf8") : fs.readFileSync(f, "utf8");
  return new Response(body, { headers: { "content-type": "application/x-ndjson", "content-disposition": `attachment; filename="${id}.jsonl"` } });
}
