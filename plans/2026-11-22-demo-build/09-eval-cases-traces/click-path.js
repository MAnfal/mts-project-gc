// Click-path check (chunk 09, SPEC metric "raw trace in ≤ 3 clicks"). Run in the page at /evals with
// chrome-devtools evaluate_script. Each step is a real click on a rendered <a>/<button>; the function counts them.
// Arguments are read from window.__clickPath = { via: "runs" | "cases", runId, iteration?, caseDoc?, repeat? }.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- an expression on purpose: evaluate_script calls it
async () => {
  const { via, runId, iteration, caseDoc, repeat } = window.__clickPath;
  // A failed step is returned as { ok: false, error } so the evidence file records it (rather than the tool erroring).
  const wait = async (pred, what, ms = 30000) => {
    const t0 = performance.now();
    for (;;) {
      const v = pred();
      if (v) return v;
      if (performance.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  const steps = [];
  const click = (el, label) => {
    steps.push(label);
    el.click();
  };
  try {
  if (location.pathname !== "/evals") throw new Error(`start at /evals, not ${location.pathname}`);
  const navLink = (text) => [...document.querySelectorAll('nav[aria-label="Evaluation"] a')].find((a) => a.textContent.trim() === text);
  if (via === "runs") {
    click(await wait(() => navLink("Runs"), "sidebar Runs"), "sidebar: Runs");
    const link = await wait(() => [...document.querySelectorAll("main a")].find((a) => a.getAttribute("href")?.endsWith(`/${runId}`)), `trace link for ${runId}`);
    click(link, `Runs page: "${link.textContent.trim()}" for ${runId}`);
  } else {
    click(await wait(() => navLink("Cases"), "sidebar Cases"), "sidebar: Cases");
    if (iteration) {
      const it = await wait(() => [...document.querySelectorAll('nav[aria-label="Iteration"] a')].find((a) => a.textContent.trim() === iteration), `iteration ${iteration}`);
      click(it, `Cases: iteration ${iteration}`);
      await wait(() => location.search.includes(`iteration=`), "iteration URL");
    }
    if (caseDoc) {
      const row = await wait(
        () => [...document.querySelectorAll("main tbody tr")].find((tr) => tr.textContent.includes(caseDoc))?.querySelector("button"),
        `case row ${caseDoc}`,
      );
      if (row.getAttribute("aria-current") !== "true") click(row, `Cases: row ${caseDoc}`);
    }
    const link = await wait(
      () => [...document.querySelectorAll('aside nav[aria-label="Raw traces"] a')].find((a) => a.textContent.startsWith(`Run ${repeat + 1} ·`) && a.getAttribute("href").endsWith(`/${runId}`)),
      `panel trace link Run ${repeat + 1}`,
    );
    click(link, `Run panel: "${link.textContent.trim()}"`);
  }
  const h = await wait(() => [...document.querySelectorAll("main h1")].find((x) => /^Raw trace · [\d,]+ events$/.test(x.textContent))?.textContent, "trace loaded");
  return { ok: true, clicks: steps.length, steps, url: location.pathname, heading: h };
  } catch (e) {
    return { ok: false, clicks: steps.length, steps, error: e.message };
  }
};
