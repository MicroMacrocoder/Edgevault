// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import {
  supabase,
  getUserJournalEntries,
  deleteJournalAndLinkedWorkspaceFromSupabase,
} from "@/lib/supabase";
import NewEntryEditorWorkspace from "@/components/dashboard/NewEntryEditorWorkspace";
import FullscreenChartViewer from "@/components/FullscreenChartViewer";

type ReviewJournalWorkspaceProps = {
  onBack?: () => void;
};

type CurrentUser = {
  id: string;
  email?: string;
} | null;

type JournalEntry = {
  id: string;
  workspaceId?: string;
  workspaceType?: string;
  entryTitle?: string;
  instrument?: string;
  entryDate?: string;
  analysisBlocks?: any[];
  createdAt?: string;
};

type SortOption = "newest" | "oldest" | "az" | "za";
type ActiveMode = "list" | "view" | "edit";

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-cyan-400/10 bg-[#111827]/70 shadow-[0_0_40px_rgba(34,211,238,0.06)] " +
        className
      }
    >
      {children}
    </div>
  );
}

function normalizeCustomChecklistItems(customChecklistItems: any[]) {
  if (!Array.isArray(customChecklistItems)) {
    return [];
  }

  const hasCategoryShape = customChecklistItems.some((item) =>
    Object.prototype.hasOwnProperty.call(item || {}, "category")
  );

  if (hasCategoryShape) {
    return customChecklistItems;
  }

  return [
    {
      id: "legacy-custom-checklist",
      category: "Custom Checklist",
      items: customChecklistItems,
    },
  ];
}

function getCheckedChecklistItems(block: any) {
  const checkedBuiltInItems = Array.isArray(block?.checklistItems)
    ? block.checklistItems.map((item: string) => ({
        id: item,
        label: item,
      }))
    : [];

  const checkedCustomItems = normalizeCustomChecklistItems(
    block?.customChecklistItems
  ).flatMap((category) =>
    Array.isArray(category.items)
      ? category.items
          .filter((item: any) => item.checked)
          .map((item: any) => ({
            id: item.id,
            label: item.label,
          }))
      : []
  );

  return [...checkedBuiltInItems, ...checkedCustomItems];
}

function getEntryTitle(entry: JournalEntry) {
  return entry.entryTitle?.trim() ? entry.entryTitle : "Untitled Entry";
}

export default function ReviewJournalWorkspace({
  onBack,
}: ReviewJournalWorkspaceProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [activeMode, setActiveMode] = useState<ActiveMode>("list");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<string>("");
  const [fullscreenBlock, setFullscreenBlock] = useState<any>(null);

  async function loadEntries(user: CurrentUser) {
    setLoadingError("");
    setIsLoadingEntries(true);

    if (user) {
      const { error, entries: remoteEntries } = await getUserJournalEntries(
        user.id
      );

      if (error) {
        setLoadingError("Could not load your journal library.");
        setEntries([]);
        setIsLoadingEntries(false);
        return;
      }

      setEntries((remoteEntries || []) as JournalEntry[]);
      setIsLoadingEntries(false);
      return;
    }

    const savedEntries =
      typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("journalEntries") || "[]")
        : [];

    setEntries(savedEntries);
    setIsLoadingEntries(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSession() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;

      const safeUser = user
        ? {
            id: user.id,
            email: user.email,
          }
        : null;

      if (isMounted) {
        setCurrentUser(safeUser);
        setIsCheckingAuth(false);
      }

      if (isMounted) {
        await loadEntries(safeUser);
      }
    }

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;

      const safeUser = user
        ? {
            id: user.id,
            email: user.email,
          }
        : null;

      if (isMounted) {
        setCurrentUser(safeUser);
        setIsCheckingAuth(false);
        loadEntries(safeUser);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function formatDateTime(dateValue?: string) {
    if (!dateValue) {
      return "No time recorded";
    }

    return new Date(dateValue).toLocaleString();
  }

  function getSortedEntries() {
    const copiedEntries = [...entries];

    if (sortOption === "newest") {
      return copiedEntries.sort((a, b) => {
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
    }

    if (sortOption === "oldest") {
      return copiedEntries.sort((a, b) => {
        return (
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
        );
      });
    }

    if (sortOption === "az") {
      return copiedEntries.sort((a, b) =>
        getEntryTitle(a).localeCompare(getEntryTitle(b))
      );
    }

    if (sortOption === "za") {
      return copiedEntries.sort((a, b) =>
        getEntryTitle(b).localeCompare(getEntryTitle(a))
      );
    }

    return copiedEntries;
  }

  function handleOpenFullscreenChart(block: any) {
    setFullscreenBlock(block);
  }

  function handleCloseFullscreenChart() {
    setFullscreenBlock(null);
  }

  function handleOpenEntry(entry: JournalEntry) {
    setSelectedEntry(entry);
    setActiveMode("view");
  }

  function handleEditEntry(entry: JournalEntry) {
    setSelectedJournalId(entry.id);
    setActiveMode("edit");
  }

  async function handleBackFromEdit() {
    setSelectedJournalId("");
    setSelectedEntry(null);
    setFullscreenBlock(null);
    setActiveMode("list");
    await loadEntries(currentUser);
  }

  function handleAskDeleteEntry(
    event: MouseEvent<HTMLButtonElement>,
    entryId: string
  ) {
    event.stopPropagation();
    setEntryToDelete(entryId);
  }

  async function handleConfirmDeleteEntry() {
    if (!entryToDelete) {
      return;
    }

    if (currentUser) {
      const { error } = await deleteJournalAndLinkedWorkspaceFromSupabase(
        currentUser.id,
        entryToDelete
      );

      if (error) {
        setLoadingError(
          "Could not delete the journal entry and its linked workspace from your account."
        );
        setEntryToDelete(null);
        return;
      }

      await loadEntries(currentUser);
    } else {
      const guestJournalEntries: JournalEntry[] = JSON.parse(
        localStorage.getItem("journalEntries") || "[]"
      );
      const guestWorkspaces = JSON.parse(
        localStorage.getItem("entryWorkspaces") || "[]"
      );

      const matchedEntry = guestJournalEntries.find(
        (entry) => entry.id === entryToDelete
      );

      const updatedEntries = guestJournalEntries.filter(
        (entry) => entry.id !== entryToDelete
      );

      const updatedWorkspaces = matchedEntry?.workspaceId
        ? guestWorkspaces.filter(
            (workspace: any) => workspace.id !== matchedEntry.workspaceId
          )
        : guestWorkspaces;

      localStorage.setItem("journalEntries", JSON.stringify(updatedEntries));
      localStorage.setItem("entryWorkspaces", JSON.stringify(updatedWorkspaces));

      setEntries(updatedEntries);
    }

    setEntryToDelete(null);
  }

  function handleCancelDeleteEntry() {
    setEntryToDelete(null);
  }

  function handleUpdateAnalysisFromViewer(updatedAnalysisHtml: string) {
    if (!fullscreenBlock || !selectedEntry) {
      return;
    }

    const updatedBlocks = (selectedEntry.analysisBlocks || []).map((block) =>
      block.id === fullscreenBlock.id
        ? { ...block, analysisHtml: updatedAnalysisHtml }
        : block
    );

    const updatedEntry = {
      ...selectedEntry,
      analysisBlocks: updatedBlocks,
    };

    setSelectedEntry(updatedEntry);

    const updatedFullscreenBlock = {
      ...fullscreenBlock,
      analysisHtml: updatedAnalysisHtml,
    };

    setFullscreenBlock(updatedFullscreenBlock);
  }

  const sortedEntries = getSortedEntries();

  if (activeMode === "edit" && selectedJournalId) {
    return (
      <NewEntryEditorWorkspace
        journalSourceFromDashboard="journal"
        journalIdFromDashboard={selectedJournalId}
        onBack={handleBackFromEdit}
      />
    );
  }

  if (activeMode === "view" && selectedEntry) {
    return (
      <div className="space-y-5">
        <Panel className="relative overflow-hidden p-6">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSelectedEntry(null);
                setFullscreenBlock(null);
                setActiveMode("list");
              }}
              className="mb-5 rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/80 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
            >
              ← Back to Journal Entries
            </button>

            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
              Journal Entry Preview
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
              {getEntryTitle(selectedEntry)}
            </h1>

            <div className="mt-4 grid gap-3 text-sm text-slate-400 md:grid-cols-3">
              <p>
                Instrument:{" "}
                <span className="font-semibold text-white">
                  {selectedEntry.instrument || "No instrument"}
                </span>
              </p>

              <p>
                Date:{" "}
                <span className="font-semibold text-white">
                  {selectedEntry.entryDate || "No date"}
                </span>
              </p>

              <p>
                Saved:{" "}
                <span className="font-semibold text-white">
                  {formatDateTime(selectedEntry.createdAt)}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleEditEntry(selectedEntry)}
              className="mt-6 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-bold text-black transition hover:opacity-90"
            >
              Edit Entry
            </button>
          </div>
        </Panel>

        <div className="space-y-5">
          {(selectedEntry.analysisBlocks || []).length === 0 ? (
            <Panel className="p-6 text-center">
              <h2 className="text-xl font-bold text-white">
                No Analysis Blocks
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                This journal entry does not have any saved analysis blocks yet.
              </p>
            </Panel>
          ) : (
            selectedEntry.analysisBlocks?.map((block, index) => {
              const checkedItems = getCheckedChecklistItems(block);

              return (
                <Panel key={block.id || index} className="p-6">
                  <h2 className="text-2xl font-bold text-white">
                    {block.sectionName?.trim()
                      ? block.sectionName
                      : `Analysis Block ${index + 1}`}
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Time Frame:{" "}
                    <span className="font-semibold text-slate-200">
                      {block.timeFrame || "No timeframe"}
                    </span>
                  </p>

                  <div className="mt-5">
                    {block.chartImage ? (
                      <button
                        type="button"
                        onClick={() => handleOpenFullscreenChart(block)}
                        className="block w-full cursor-pointer overflow-hidden rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 text-left transition hover:border-cyan-400/40"
                        title="Open fullscreen chart"
                      >
                        <img
                          src={block.chartImage}
                          alt={`Chart ${index + 1}`}
                          className="max-h-[480px] w-full object-contain transition hover:scale-[1.01]"
                        />
                      </button>
                    ) : (
                      <div className="rounded-xl border border-dashed border-cyan-400/20 bg-[#0F0F1F]/70 px-6 py-10 text-center text-sm text-slate-500">
                        No chart image saved
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                      Checklist
                    </p>

                    {checkedItems.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-400">
                        No checklist items selected.
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {checkedItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-cyan-400/10 bg-[#111827]/70 px-3 py-2 text-sm text-slate-300"
                          >
                            ✓ {item.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                      Analysis Text
                    </p>

                    {block.analysisHtml ? (
                      <div
                        className="mt-3 overflow-x-auto text-sm leading-relaxed text-slate-300"
                        dangerouslySetInnerHTML={{
                          __html: block.analysisHtml,
                        }}
                      />
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        No analysis text saved.
                      </p>
                    )}
                  </div>
                </Panel>
              );
            })
          )}
        </div>

        <FullscreenChartViewer
          isOpen={Boolean(fullscreenBlock)}
          onClose={handleCloseFullscreenChart}
          image={fullscreenBlock?.chartImage || ""}
          sectionName={fullscreenBlock?.sectionName || ""}
          timeFrame={fullscreenBlock?.timeFrame || ""}
          analysisHtml={fullscreenBlock?.analysisHtml || ""}
          onUpdateAnalysis={handleUpdateAnalysisFromViewer}
          checklistGroups={[]}
          checklistItems={fullscreenBlock?.checklistItems || []}
          customChecklistItems={fullscreenBlock?.customChecklistItems || []}
          customChecklistText=""
          customChecklistCategory=""
          customChecklistNewCategory=""
          onToggleChecklistItem={() => {}}
          onToggleCustomChecklistItem={() => {}}
          onCustomChecklistTextChange={() => {}}
          onCustomChecklistCategoryChange={() => {}}
          onCustomChecklistNewCategoryChange={() => {}}
          onAddCustomChecklistItem={() => {}}
          onDeleteCustomChecklistItem={() => {}}
          onSaveChecklist={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-5 rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/80 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
            >
              ← Back to Journal Hub
            </button>
          ) : null}

          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
            EdgeVault Journal Library
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Review Journal Entries
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            View, open, edit, and manage your saved journal entries inside the
            dashboard.
          </p>

          <p className="mt-5 text-sm font-medium text-slate-300">
            {isCheckingAuth
              ? "Checking access..."
              : currentUser
                ? `Logged in as ${
                    currentUser.email || "your account"
                  } — using your account journal library`
                : "Guest mode — using local journal library only"}
          </p>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Saved Entries</h2>
            <p className="mt-1 text-sm text-slate-400">
              Open saved journal entries or edit them from the workspace editor.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Sort by
            </label>

            <select
              value={sortOption}
              onChange={(event) =>
                setSortOption(event.target.value as SortOption)
              }
              className="rounded-xl border border-slate-700 bg-[#0F0F1F] px-4 py-2 text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="az">A - Z</option>
              <option value="za">Z - A</option>
            </select>
          </div>
        </div>

        {isLoadingEntries ? (
          <div className="rounded-xl border border-dashed border-cyan-400/20 bg-[#0F0F1F]/70 px-6 py-10 text-center">
            <h3 className="text-xl font-bold text-white">
              Loading Journal Entries...
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Please wait while your journal library is being loaded.
            </p>
          </div>
        ) : (
          <>
            {loadingError ? (
              <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                {loadingError}
              </p>
            ) : null}

            {sortedEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-cyan-400/20 bg-[#0F0F1F]/70 px-6 py-10 text-center">
                <h3 className="text-xl font-bold text-white">
                  No Journal Entries Yet
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  Save a workspace to your journal library to see it here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => handleOpenEntry(entry)}
                    className="cursor-pointer rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-5 transition duration-200 hover:border-cyan-400/40 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,211,238,0.10)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-white">
                          {getEntryTitle(entry)}
                        </h2>

                        <p className="mt-2 text-sm text-slate-400">
                          Instrument: {entry.instrument || "No instrument yet"}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          Date: {entry.entryDate || "No date yet"}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          Blocks: {entry.analysisBlocks?.length || 0}
                        </p>

                        <p className="mt-2 text-xs text-slate-500">
                          Saved: {formatDateTime(entry.createdAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(event) =>
                          handleAskDeleteEntry(event, entry.id)
                        }
                        className="cursor-pointer text-slate-500 transition duration-200 hover:scale-110 hover:text-red-400"
                        title="Delete this journal entry"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-6 w-6"
                        >
                          <path d="M9 3.75A2.25 2.25 0 0 1 11.25 1.5h1.5A2.25 2.25 0 0 1 15 3.75V4.5h4.125a.75.75 0 0 1 0 1.5h-.678l-.69 12.418A2.25 2.25 0 0 1 15.51 20.5H8.49a2.25 2.25 0 0 1-2.247-2.082L5.553 6H4.875a.75.75 0 0 1 0-1.5H9V3.75Zm1.5.75h3v-.75a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v.75ZM8.25 9a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6A.75.75 0 0 1 8.25 9Zm4.5 0a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6A.75.75 0 0 1 12.75 9Zm3.75.75a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6Z" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenEntry(entry);
                        }}
                        className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-bold text-black transition hover:opacity-90"
                      >
                        Open Entry
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEditEntry(entry);
                        }}
                        className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
                      >
                        Edit Entry
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Panel>

      {entryToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/10 bg-[#0F0F1F] p-6 shadow-[0_0_50px_rgba(34,211,238,0.12)]">
            <h3 className="text-xl font-bold text-white">
              Delete Journal Entry
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              Deleting this journal entry will also delete its linked workspace
              analysis.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCancelDeleteEntry}
                className="rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteEntry}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
