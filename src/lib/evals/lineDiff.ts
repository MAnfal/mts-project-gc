/** One side of a side-by-side diff row: a line and whether it is unchanged, only in the old text, or only in the new. */
export type DiffCell = { text: string; kind: "same" | "removed" | "added" };
export type DiffRow = { left: DiffCell | null; right: DiffCell | null };

/**
 * A GitHub-style side-by-side line diff of two texts (longest common subsequence of lines). Unchanged lines sit on
 * one row; within each changed run, removed and added lines pair up row by row, and the longer side's extras get an
 * empty cell opposite. Client-safe; the prompts it compares are a few dozen lines, so O(n·m) is fine.
 */
export function lineDiff(oldText: string, newText: string): DiffRow[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  // lcs[i][j] = LCS length of a[i:] and b[j:]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const rows: DiffRow[] = [];
  let removed: string[] = [];
  let added: string[] = [];
  const flush = () => {
    for (let k = 0; k < Math.max(removed.length, added.length); k++)
      rows.push({
        left: k < removed.length ? { text: removed[k], kind: "removed" } : null,
        right: k < added.length ? { text: added[k], kind: "added" } : null,
      });
    removed = [];
    added = [];
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      rows.push({ left: { text: a[i], kind: "same" }, right: { text: b[j], kind: "same" } });
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) added.push(b[j++]);
    else removed.push(a[i++]);
  }
  flush();
  return rows;
}
