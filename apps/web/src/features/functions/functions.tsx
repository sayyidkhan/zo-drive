import { FunctionLogsPanel, FunctionWorkspace } from "./components/function-workspace.js";
import {
  FunctionsHero,
  FunctionsSidebar,
  NoMatchingFunctions
} from "./components/functions-overview.js";
import {
  supportsFunctions,
  type FunctionsClient,
  type ReadyFunctionsClient
} from "./functions-client.js";
import { useFunctionsWorkspace } from "./use-functions-workspace.js";

export function Functions({
  client,
  search
}: {
  client: FunctionsClient;
  search: string;
}) {
  if (!supportsFunctions(client)) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Functions are unavailable</h2>
        <p className="mt-2 text-sm text-slate-500">
          Update the Zo Drive API and browser workspace together to use Zo Functions.
        </p>
      </section>
    );
  }

  return <FunctionsWorkspace client={client} search={search} />;
}

function FunctionsWorkspace({
  client,
  search
}: {
  client: ReadyFunctionsClient;
  search: string;
}) {
  const workspace = useFunctionsWorkspace(client, search);

  return (
    <div className="space-y-5">
      {!workspace.normalizedSearch && <FunctionsHero />}
      <div className="grid gap-5 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <FunctionsSidebar search={search} workspace={workspace} />
        {workspace.normalizedSearch && workspace.functions.length === 0
          ? <NoMatchingFunctions />
          : <FunctionWorkspace workspace={workspace} />}
      </div>
      <FunctionLogsPanel workspace={workspace} />
    </div>
  );
}
