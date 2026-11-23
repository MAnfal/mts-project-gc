import { HomeChooser } from "@/components/home/HomeChooser";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";

/** `/`: choose the GC's app (a new run) or the reviewer's eval results. */
export default function Home() {
  const { appName } = readYaml("app.yaml", AppConfigSchema);
  return <HomeChooser appName={appName} />;
}
