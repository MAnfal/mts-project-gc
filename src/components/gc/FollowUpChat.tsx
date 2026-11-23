"use client";

import { CornerDownLeft, LoaderCircle } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { askFollowUp, type FollowUpContext } from "@/lib/runs/followup-context";
import type { ChatTurn } from "@/lib/runs/types";
import { getRunner } from "./useRun";

/**
 * Follow-up questions under a finished report (design/HiReport.dc.html): suggestion chips, the composer, and the
 * conversation so far. Answers stream in from /api/followup and use this report alone. Finished question-and-answer
 * pairs are saved in IndexedDB under `chatId` (`live:<id>` or `example:<id>`), so they come back after a reload; a failed
 * answer is not kept, and its question goes back into the composer. The request, stream and save are
 * src/lib/runs/followup-context.ts (askFollowUp); this component only renders them.
 */
export function FollowUpChat({ chatId, context, suggestions }: { chatId: string; context: FollowUpContext; suggestions: string[] }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState<{ question: string; answer: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputId = useId();

  useEffect(() => {
    let live = true;
    void getRunner().then(async (r) => {
      const chat = await r.store.getChat(chatId);
      if (live) setTurns(chat?.turns ?? []);
    });
    return () => {
      live = false;
    };
  }, [chatId]);

  async function ask(question: string) {
    if (pending || !question.trim()) return;
    setError(null);
    setDraft("");
    setPending({ question: question.trim(), answer: "" });
    const { store } = await getRunner();
    const result = await askFollowUp(
      { chatId, context, turns, question },
      { fetch: (input, init) => fetch(input, init), store, onText: (t) => setPending((p) => p && { ...p, answer: p.answer + t }), now: () => new Date().toISOString() },
    );
    setPending(null);
    if (result.ok) setTurns(result.turns);
    else {
      setError(result.message);
      setDraft(question);
    }
  }

  async function clear() {
    const { store } = await getRunner();
    await store.saveChat({ id: chatId, savedAt: new Date().toISOString(), turns: [] });
    setTurns([]);
    setError(null);
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(draft);
    }
  };

  return (
    <section aria-label="Follow-up questions" className="flex flex-col gap-3 pt-2">
      {turns.length || pending ? (
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {turns.map((t, i) => (
            <Turn key={i} turn={t} />
          ))}
          {pending ? (
            <>
              <Turn turn={{ role: "user", content: pending.question }} />
              <li aria-live="polite" className="max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-wrap">
                {pending.answer || (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <LoaderCircle aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
                    Reading the report…
                  </span>
                )}
              </li>
            </>
          ) : null}
        </ol>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 rounded-md bg-status-red-surface px-3 py-2 text-[13px] text-status-red-fg">
          {error}
        </p>
      ) : null}

      {suggestions.length ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending !== null}
              onClick={() => void ask(s)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-left hover:bg-background disabled:opacity-60"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
        className="rounded-lg border border-border bg-card shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask about this report
        </label>
        <textarea
          id={inputId}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about this report"
          className="block w-full resize-none border-0 bg-transparent px-3.5 pt-3 pb-1 outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-2 py-1.5 pr-2 pl-3.5">
          <span className="grow text-xs text-caption">Answers use this report and its sources only</span>
          {turns.length && !pending ? (
            <button type="button" onClick={() => void clear()} className="shrink-0 rounded-sm px-1.5 py-1 text-xs whitespace-nowrap text-muted-foreground hover:bg-nav-hover">
              Clear conversation
            </button>
          ) : null}
          <button
            type="submit"
            aria-label="Send"
            disabled={pending !== null}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <CornerDownLeft aria-hidden="true" className="size-[15px]" />
          </button>
        </div>
      </form>
    </section>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  return turn.role === "user" ? (
    <li className="max-w-[85%] self-end rounded-lg bg-secondary px-3.5 py-2 whitespace-pre-wrap">{turn.content}</li>
  ) : (
    <li className="max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-wrap">{turn.content}</li>
  );
}
