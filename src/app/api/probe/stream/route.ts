import { parseSeconds } from "./seconds";

// Deploy probe: proves a streamed response stays open for the length of a live run inside the function.
// Vercel Hobby (Fluid compute) allows up to 300 s; the POC's worst-case run took 87 s.
export const runtime = "nodejs";
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET /api/probe/stream?seconds=N — writes `tick 1` … `tick N`, one per second, then `done`. */
export async function GET(req: Request): Promise<Response> {
  const seconds = parseSeconds(new URL(req.url).searchParams.get("seconds"));
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let i = 1; i <= seconds; i++) {
        await sleep(1000);
        if (cancelled) return;
        controller.enqueue(encoder.encode(`tick ${i}\n`));
      }
      controller.enqueue(encoder.encode("done\n"));
      controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
