export type FunctionWorkspaceTab = "editor" | "runs" | "logs";

export function FunctionWorkspaceTabs({ activeTab, disabled, onChange }: { activeTab: FunctionWorkspaceTab; disabled: boolean; onChange: (tab: FunctionWorkspaceTab) => void }) {
  const tabs: Array<{ id: FunctionWorkspaceTab; label: string }> = [
    { id: "editor", label: "Editor" },
    { id: "runs", label: "Function runs" },
    { id: "logs", label: "Logs" }
  ];
  return <nav aria-label="Function workspace views" className="border-b border-slate-100 bg-white px-5 pt-4"><div className="flex gap-1 overflow-x-auto" role="tablist">{tabs.map((tab) => <button aria-controls={`function-${tab.id}-panel`} aria-selected={activeTab === tab.id} className={`shrink-0 rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-semibold transition ${activeTab === tab.id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800"} disabled:cursor-not-allowed disabled:text-slate-300`} disabled={disabled && tab.id !== "editor"} key={tab.id} onClick={() => onChange(tab.id)} role="tab" type="button">{tab.label}</button>)}</div></nav>;
}
