import Link from "next/link";

export type CarlRow = { title: string; text: string; href: string; linkLabel: string };

/** Context | Action | Result | Learning, each with one link down (design/HiEvalSummary.dc.html). Text arrives filled. */
export function CarlTable({ rows }: { rows: CarlRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[560px] border-collapse leading-relaxed">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.title} className={i ? "border-t border-row-border" : undefined}>
              <th scope="row" className="w-[110px] bg-secondary px-4 py-3.5 text-left align-top font-semibold">
                {r.title}
              </th>
              <td className="px-4 py-3.5">{r.text}</td>
              <td className="px-4 py-3.5 align-top whitespace-nowrap">
                <Link href={r.href}>{r.linkLabel}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
