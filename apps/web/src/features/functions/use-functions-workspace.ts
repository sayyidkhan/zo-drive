import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DriveFunction,
  FunctionRuntime,
  FunctionVisibility
} from "@zo-drive/types";
import { normalizeAppBasePath } from "../../app-urls.js";
import { matchesSearch } from "../../shared/lib/matches-search.js";
import type { FunctionWorkspaceTab } from "./components/function-workspace-tabs.js";
import type { ReadyFunctionsClient } from "./functions-client.js";

const defaultInput = "{\n  \"name\": \"Zo\"\n}";
const emptyFunctions: DriveFunction[] = [];
const appBasePath = normalizeAppBasePath(import.meta.env.BASE_URL);

function defaultFunctionSource(runtime: FunctionRuntime): string {
  return runtime === "javascript"
    ? `export default async function handler(input) {\n  return { message: \`Hello, \${input.name ?? "world"}!\`, input };\n}`
    : `def handler(input):\n    return {"message": f"Hello, {input.get('name', 'world')}!", "input": input}`;
}

export function useFunctionsWorkspace(
  client: ReadyFunctionsClient,
  search: string
) {
  const queryClient = useQueryClient();
  const functionsQuery = useQuery({
    queryKey: ["functions"],
    queryFn: () => client.listFunctions()
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<FunctionWorkspaceTab>("editor");
  const [name, setName] = useState("hello-world");
  const [runtime, setRuntime] = useState<FunctionRuntime>("javascript");
  const [source, setSource] = useState(defaultFunctionSource("javascript"));
  const [visibility, setVisibility] = useState<FunctionVisibility>("private");
  const [cron, setCron] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [input, setInput] = useState(defaultInput);
  const normalizedSearch = search.trim().toLowerCase();
  const allFunctions = functionsQuery.data ?? emptyFunctions;
  const functions = useMemo(
    () => allFunctions.filter((fn) => matchesSearch(
      normalizedSearch,
      fn.name,
      fn.runtime,
      fn.source,
      fn.visibility,
      fn.cron,
      fn.enabled ? "enabled" : "paused"
    )),
    [allFunctions, normalizedSearch]
  );
  const selected = useMemo(
    () => allFunctions.find((fn) => fn.id === selectedId) ?? null,
    [allFunctions, selectedId]
  );
  const runsQuery = useQuery({
    queryKey: ["function-runs", selectedId],
    queryFn: () => client.listFunctionRuns(selectedId!),
    enabled: Boolean(selectedId)
  });

  const loadFunction = useCallback((fn: DriveFunction) => {
    setSelectedId(fn.id);
    setWorkspaceTab("editor");
    setName(fn.name);
    setRuntime(fn.runtime);
    setSource(fn.source);
    setVisibility(fn.visibility);
    setCron(fn.cron ?? "");
    setEnabled(fn.enabled);
  }, []);

  const newFunction = useCallback(() => {
    setSelectedId(null);
    setWorkspaceTab("editor");
    setName("hello-world");
    setRuntime("javascript");
    setSource(defaultFunctionSource("javascript"));
    setVisibility("private");
    setCron("");
    setEnabled(true);
    setInput(defaultInput);
  }, []);

  useEffect(() => {
    if (selected && (!normalizedSearch || functions.some((fn) => fn.id === selected.id))) return;
    if (selectedId && !normalizedSearch) return;
    const first = functions[0];
    if (first) loadFunction(first);
  }, [functions, loadFunction, normalizedSearch, selected, selectedId]);

  const saveMutation = useMutation({
    mutationFn: () => selectedId
      ? client.updateFunction({
        id: selectedId,
        name: name.trim(),
        runtime,
        source,
        visibility,
        cron: cron.trim() || null,
        enabled
      })
      : client.createFunction({
        name: name.trim(),
        runtime,
        source,
        visibility,
        cron: cron.trim() || null,
        enabled
      }),
    onSuccess: async (fn) => {
      const wasExisting = Boolean(selectedId);
      loadFunction(fn);
      await queryClient.invalidateQueries({ queryKey: ["functions"] });
      toast.success(wasExisting ? "Function saved" : "Function created");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save function");
    }
  });

  const runMutation = useMutation({
    mutationFn: () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        throw new Error("Input must be valid JSON");
      }
      return client.runFunction(selectedId!, parsed);
    },
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: ["function-runs", selectedId] });
      await queryClient.invalidateQueries({ queryKey: ["functions"] });
      setWorkspaceTab("runs");
      if (run.status === "success") toast.success("Function completed");
      else toast.error(`Function ${run.status}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not run function");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => client.deleteFunction(selectedId!),
    onSuccess: async () => {
      newFunction();
      await queryClient.invalidateQueries({ queryKey: ["functions"] });
      toast.success("Function deleted");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not delete function");
    }
  });

  const changeRuntime = useCallback((nextRuntime: FunctionRuntime) => {
    setRuntime(nextRuntime);
    if (!selected) setSource(defaultFunctionSource(nextRuntime));
  }, [selected]);

  const endpoint = selectedId && visibility === "public"
    ? `${window.location.origin}${appBasePath === "/" ? "" : appBasePath}/public/functions/${selectedId}/invoke`
    : null;

  return {
    allFunctions,
    changeRuntime,
    cron,
    deleteMutation,
    enabled,
    endpoint,
    functions,
    functionsQuery,
    input,
    loadFunction,
    name,
    newFunction,
    normalizedSearch,
    runMutation,
    runs: runsQuery.data ?? [],
    runsQuery,
    runtime,
    saveMutation,
    selected,
    selectedId,
    setCron,
    setEnabled,
    setInput,
    setName,
    setSource,
    setVisibility,
    setWorkspaceTab,
    source,
    visibility,
    workspaceTab
  };
}

export type FunctionsWorkspaceModel = ReturnType<typeof useFunctionsWorkspace>;
