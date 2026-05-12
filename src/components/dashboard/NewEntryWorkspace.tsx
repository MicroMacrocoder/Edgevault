"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import {
  supabase,
  getUserWorkspaces,
  deleteWorkspaceAndLinkedJournalFromSupabase,
} from "@/lib/supabase";
import NewEntryEditorWorkspace from "@/components/dashboard/NewEntryEditorWorkspace";

type CurrentUser = {
  id: string;
  email?: string;
} | null;

type Workspace = {
  id: string;
  workspaceTitle?: string;
  workspaceType?: string;
  instrument?: string;
  entryDate?: string;
  createdAt?: string;
  linkedJournalId?: string;
  analysisBlocks?: unknown[];
};

type SortOption = "newest" | "oldest" | "az" | "za";

type EditorState = {
  workspaceId: string;
  workspaceType?: "general" | "strategy";
} | null;

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

function getWorkspaceTitle(workspace: Workspace) {
  return workspace.workspaceTitle?.trim()
    ? workspace.workspaceTitle
    : "New Entry Workspace";
}

export default function NewEntryWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [workspaceLimitMessage, setWorkspaceLimitMessage] = useState("");
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(
    null
  );
  const [isWorkspaceTypeModalOpen, setIsWorkspaceTypeModalOpen] =
    useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [editorState, setEditorState] = useState<EditorState>(null);

  async function loadWorkspaces(user: CurrentUser) {
    setLoadingError("");
    setIsLoadingWorkspaces(true);

    if (user) {
      const { error, workspaces: remoteWorkspaces } = await getUserWorkspaces(
        user.id
      );

      if (error) {
        setLoadingError("Could not load your saved workspaces.");
        setWorkspaces([]);
        setIsLoadingWorkspaces(false);
        return;
      }

      setWorkspaces((remoteWorkspaces || []) as Workspace[]);
      setIsLoadingWorkspaces(false);
      return;
    }

    const savedWorkspaces =
      typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("entryWorkspaces") || "[]")
        : [];

    setWorkspaces(savedWorkspaces);
    setIsLoadingWorkspaces(false);
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
        await loadWorkspaces(safeUser);
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
        loadWorkspaces(safeUser);
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

  function getSortedWorkspaces() {
    const copiedWorkspaces = [...workspaces];

    if (sortOption === "newest") {
      return copiedWorkspaces.sort((a, b) => {
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
    }

    if (sortOption === "oldest") {
      return copiedWorkspaces.sort((a, b) => {
        return (
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
        );
      });
    }

    if (sortOption === "az") {
      return copiedWorkspaces.sort((a, b) =>
        getWorkspaceTitle(a).localeCompare(getWorkspaceTitle(b))
      );
    }

    if (sortOption === "za") {
      return copiedWorkspaces.sort((a, b) =>
        getWorkspaceTitle(b).localeCompare(getWorkspaceTitle(a))
      );
    }

    return copiedWorkspaces;
  }

  function handleCreateWorkspace() {
    if (!currentUser) {
      setWorkspaceLimitMessage(
        "You must log in to create a saved workspace. Strategy workspaces are account-only."
      );
      return;
    }

    setWorkspaceLimitMessage("");
    setIsWorkspaceTypeModalOpen(true);
  }

  function handleCreateWorkspaceByType(workspaceType: "general" | "strategy") {
    if (!currentUser) {
      setWorkspaceLimitMessage("You must log in to create a saved workspace.");
      return;
    }

    setWorkspaceLimitMessage("");
    setIsWorkspaceTypeModalOpen(false);

    const newWorkspaceId = `workspace-${Date.now()}`;

    setEditorState({
      workspaceId: newWorkspaceId,
      workspaceType,
    });
  }

  function handleOpenWorkspace(workspace: Workspace) {
    setEditorState({
      workspaceId: workspace.id,
      workspaceType:
        workspace.workspaceType === "strategy" ? "strategy" : "general",
    });
  }

  async function handleBackFromEditor() {
    setEditorState(null);
    await loadWorkspaces(currentUser);
  }

  function handleAskDeleteWorkspace(
    event: MouseEvent<HTMLButtonElement>,
    workspaceId: string
  ) {
    event.stopPropagation();
    setWorkspaceToDelete(workspaceId);
  }

  async function handleConfirmDeleteWorkspace() {
    if (!workspaceToDelete) {
      return;
    }

    if (currentUser) {
      const { error } = await deleteWorkspaceAndLinkedJournalFromSupabase(
        currentUser.id,
        workspaceToDelete
      );

      if (error) {
        setWorkspaceLimitMessage(
          "Could not delete the workspace and its linked journal entry from your account."
        );

        setWorkspaceToDelete(null);
        return;
      }

      await loadWorkspaces(currentUser);
    } else {
      const guestWorkspaces: Workspace[] = JSON.parse(
        localStorage.getItem("entryWorkspaces") || "[]"
      );
      const guestJournalEntries = JSON.parse(
        localStorage.getItem("journalEntries") || "[]"
      );

      const matchedWorkspace = guestWorkspaces.find(
        (workspace) => workspace.id === workspaceToDelete
      );

      const updatedWorkspaces = guestWorkspaces.filter(
        (workspace) => workspace.id !== workspaceToDelete
      );

      const updatedJournalEntries = matchedWorkspace?.linkedJournalId
        ? guestJournalEntries.filter(
            (entry: { id: string }) =>
              entry.id !== matchedWorkspace.linkedJournalId
          )
        : guestJournalEntries;

      localStorage.setItem("entryWorkspaces", JSON.stringify(updatedWorkspaces));
      localStorage.setItem(
        "journalEntries",
        JSON.stringify(updatedJournalEntries)
      );

      setWorkspaces(updatedWorkspaces);
    }

    setWorkspaceToDelete(null);
    setWorkspaceLimitMessage("");
  }

  function handleCancelDeleteWorkspace() {
    setWorkspaceToDelete(null);
  }

  const sortedWorkspaces = getSortedWorkspaces();

  if (editorState) {
    return (
      <NewEntryEditorWorkspace
        workspaceIdFromDashboard={editorState.workspaceId}
        workspaceTypeFromDashboard={editorState.workspaceType || "general"}
        onBack={handleBackFromEditor}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
            EdgeVault Trade Workspace
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Analysis Workspaces
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Create separate workspaces for different pairs, setups, ideas, and
            strategy reviews.
          </p>

          <p className="mt-5 text-sm font-medium text-slate-300">
            {isCheckingAuth
              ? "Checking access..."
              : currentUser
                ? `Logged in as ${
                    currentUser.email || "your account"
                  } — using your account workspaces`
                : "Please log in to create and save workspaces"}
          </p>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Saved Workspaces</h2>
            <p className="mt-1 text-sm text-slate-400">
              Open existing analysis spaces or create a new one.
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

        {isLoadingWorkspaces ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-[#0F0F1F]/70 px-6 py-10 text-center">
            <h3 className="text-xl font-bold text-white">
              Loading Workspaces...
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Please wait while your workspaces are being loaded.
            </p>
          </div>
        ) : (
          <>
            {loadingError ? (
              <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                {loadingError}
              </p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                onClick={handleCreateWorkspace}
                title="Create new entry workspace"
                className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-400/20 bg-[#0F0F1F]/70 p-6 text-center transition duration-200 hover:border-cyan-400/60 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,211,238,0.12)]"
              >
                <div className="text-5xl font-light text-cyan-300">+</div>
                <p className="mt-3 text-lg font-bold text-white">
                  Create New Workspace
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Start a new analysis workspace for a different pair or setup.
                </p>
              </button>

              {sortedWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  onClick={() => handleOpenWorkspace(workspace)}
                  className="cursor-pointer rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-5 transition duration-200 hover:border-emerald-400/40 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,197,94,0.10)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {getWorkspaceTitle(workspace)}
                      </h2>

                      <p className="mt-2 text-sm text-slate-400">
                        Type:{" "}
                        <span className="font-semibold text-slate-300">
                          {workspace.workspaceType === "strategy"
                            ? "Strategy Workspace"
                            : "General Workspace"}
                        </span>
                      </p>

                      <p className="mt-2 text-sm text-slate-400">
                        Instrument: {workspace.instrument || "No instrument yet"}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        Date: {workspace.entryDate || "No date yet"}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        Blocks: {workspace.analysisBlocks?.length || 0}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Created: {formatDateTime(workspace.createdAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(event) =>
                        handleAskDeleteWorkspace(event, workspace.id)
                      }
                      className="cursor-pointer text-slate-500 transition duration-200 hover:scale-110 hover:text-red-400"
                      title="Delete this workspace"
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

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenWorkspace(workspace);
                      }}
                      className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-bold text-black transition hover:opacity-90"
                    >
                      Open Workspace
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {workspaceLimitMessage ? (
              <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                {workspaceLimitMessage}
              </p>
            ) : null}

            {sortedWorkspaces.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-cyan-400/20 bg-[#0F0F1F]/70 px-6 py-10 text-center">
                <h3 className="text-xl font-bold text-white">
                  No Workspaces Yet
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  Use the create card above to start your first workspace.
                </p>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      {isWorkspaceTypeModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/10 bg-[#0F0F1F] p-6 shadow-[0_0_50px_rgba(34,211,238,0.12)]">
            <h3 className="text-xl font-bold text-white">
              Choose Workspace Type
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              Choose the type of analysis workspace you want to create.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => handleCreateWorkspaceByType("general")}
                className="rounded-xl border border-cyan-400/10 bg-[#111827]/70 p-4 text-left transition hover:border-cyan-400/40 hover:bg-[#111827]"
              >
                <p className="text-base font-bold text-white">
                  General Workspace
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Use the normal free-text analysis workspace.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleCreateWorkspaceByType("strategy")}
                className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-left transition hover:bg-emerald-400/15"
              >
                <p className="text-base font-bold text-emerald-300">
                  Strategy Workspace
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Use structured HTF, MTF, and Entry checklists.
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsWorkspaceTypeModalOpen(false)}
              className="mt-5 rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {workspaceToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/10 bg-[#0F0F1F] p-6 shadow-[0_0_50px_rgba(34,211,238,0.12)]">
            <h3 className="text-xl font-bold text-white">Delete Workspace</h3>

            <p className="mt-3 text-sm text-slate-400">
              Deleting this workspace will also delete its linked journal entry.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCancelDeleteWorkspace}
                className="rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteWorkspace}
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
