"use client";

// This imports React hooks for state and effects
import { useEffect, useState } from "react";

// This imports Link for navigation links
import Link from "next/link";

// This imports the router for page navigation
import { useRouter } from "next/navigation";

// This imports Supabase auth checking
import { supabase } from "../../lib/supabase";

// This imports workspace loading and delete helpers
import {
  getUserWorkspaces,
  deleteWorkspaceAndLinkedJournalFromSupabase,
} from "../../lib/supabase";

// This creates the workspace hub page
export default function WorkspaceHubPage() {
  // This gives router navigation control
  const router = useRouter();

  // This stores the visible workspace list
  const [workspaces, setWorkspaces] = useState([]);

  // This stores the current sort option
  const [sortOption, setSortOption] = useState("newest");

  // This stores the workspace limit warning message
  const [workspaceLimitMessage, setWorkspaceLimitMessage] = useState("");

  // This stores the workspace waiting for delete confirmation
  const [workspaceToDelete, setWorkspaceToDelete] = useState(null);

  // This stores whether the workspace type modal is open
  const [isWorkspaceTypeModalOpen, setIsWorkspaceTypeModalOpen] = useState(false);

  // This stores the currently logged-in user
  const [currentUser, setCurrentUser] = useState(null);

  // This tells us whether auth is still being checked
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // This tells us whether workspace loading is still in progress
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);

  // This stores any loading error
  const [loadingError, setLoadingError] = useState("");

  // This loads the correct workspace source for guest or logged-in user
  async function loadWorkspaces(user) {
    // This clears any old loading error
    setLoadingError("");

    // This turns on loading state
    setIsLoadingWorkspaces(true);

    // This loads from Supabase for logged-in users
    if (user) {
      // This fetches the user's remote workspaces
      const { error, workspaces: remoteWorkspaces } = await getUserWorkspaces(
        user.id
      );

      // This handles loading errors
      if (error) {
        // This stores a readable loading error
        setLoadingError("Could not load your saved workspaces.");

        // This clears the visible workspace list
        setWorkspaces([]);

        // This ends loading
        setIsLoadingWorkspaces(false);

        // This stops the function here
        return;
      }

      // This stores the remote workspace list
      setWorkspaces(remoteWorkspaces);

      // This ends loading
      setIsLoadingWorkspaces(false);

      // This stops the function here
      return;
    }

    // This loads guest workspaces from localStorage
    const savedWorkspaces =
      JSON.parse(localStorage.getItem("entryWorkspaces")) || [];

    // This stores the guest workspace list
    setWorkspaces(savedWorkspaces);

    // This ends loading
    setIsLoadingWorkspaces(false);
  }

  // This checks auth and listens for auth changes without getUser lock clashes
  useEffect(() => {
    // This helps prevent state updates after unmount
    let isMounted = true;

    // This loads the current session once
    async function loadInitialSession() {
      // This loads the current session from Supabase
      const { data: sessionData } = await supabase.auth.getSession();

      // This gets the user from the session
      const user = sessionData?.session?.user ?? null;

      // This stores auth state if still mounted
      if (isMounted) {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      }

      // This loads workspaces from the correct source
      if (isMounted) {
        await loadWorkspaces(user);
      }
    }

    // This runs the initial auth/session load
    loadInitialSession();

    // This listens for login and logout changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // This gets the updated user
      const user = session?.user ?? null;

      // This stores the updated auth state
      if (isMounted) {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      }

      // This reloads workspaces from the correct source
      if (isMounted) {
        loadWorkspaces(user);
      }
    });

    // This cleans up the listener
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // This formats saved times into a readable local format
  function formatDateTime(dateValue) {
    // This returns a fallback if no date exists
    if (!dateValue) {
      return "No time recorded";
    }

    // This converts the date into readable local text
    return new Date(dateValue).toLocaleString();
  }

  // This sorts the current workspace list
  function getSortedWorkspaces() {
    // This copies the workspace list so we do not mutate state directly
    const copiedWorkspaces = [...workspaces];

    // This sorts newest first
    if (sortOption === "newest") {
      return copiedWorkspaces.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    // This sorts oldest first
    if (sortOption === "oldest") {
      return copiedWorkspaces.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    }

    // This sorts alphabetically A to Z
    if (sortOption === "az") {
      return copiedWorkspaces.sort((a, b) =>
        (a.workspaceTitle || "New Entry Workspace").localeCompare(
          b.workspaceTitle || "New Entry Workspace"
        )
      );
    }

    // This sorts alphabetically Z to A
    if (sortOption === "za") {
      return copiedWorkspaces.sort((a, b) =>
        (b.workspaceTitle || "New Entry Workspace").localeCompare(
          a.workspaceTitle || "New Entry Workspace"
        )
      );
    }

    // This returns unchanged if no special sort is selected
    return copiedWorkspaces;
  }

  // This creates a new workspace
  function handleCreateWorkspace() {
    // This blocks users who are not logged in from creating saved workspaces
    if (!currentUser) {
      setWorkspaceLimitMessage(
        "You must log in to create a saved workspace. Strategy workspaces are account-only."
      );
      return;
    }

    // This clears any old limit warning
    setWorkspaceLimitMessage("");

    // This opens the workspace type choice modal
    setIsWorkspaceTypeModalOpen(true);
  }

  // This creates a new workspace based on the selected workspace type
  function handleCreateWorkspaceByType(workspaceType) {
    // This blocks users who are not logged in from creating saved workspaces
    if (!currentUser) {
      setWorkspaceLimitMessage("You must log in to create a saved workspace.");
      return;
    }

    // This clears any old limit warning
    setWorkspaceLimitMessage("");

    // This closes the workspace type modal
    setIsWorkspaceTypeModalOpen(false);

    // This creates a new frontend workspace id
    const newWorkspaceId = `workspace-${Date.now()}`;

    // This opens the workspace editor for the new workspace and sends the selected type in the URL
    router.push(
      `/new-entry/workspace?workspace=${newWorkspaceId}&type=${workspaceType}`
    );
  }

  // This prepares a workspace for delete confirmation
  function handleAskDeleteWorkspace(event, workspaceId) {
    // This prevents card click from also opening the workspace
    event.stopPropagation();

    // This stores the selected workspace id
    setWorkspaceToDelete(workspaceId);
  }

  // This confirms workspace deletion
  async function handleConfirmDeleteWorkspace() {
    // This stops if nothing is selected
    if (!workspaceToDelete) {
      return;
    }

    // This deletes remote workspaces for logged-in users
    if (currentUser) {
      // This deletes the workspace and any linked journal entry from Supabase
      const { error } = await deleteWorkspaceAndLinkedJournalFromSupabase(
        currentUser.id,
        workspaceToDelete
      );

      // This handles delete errors
      if (error) {
        // This shows a delete error
        setWorkspaceLimitMessage(
          "Could not delete the workspace and its linked journal entry from your account."
        );

        // This closes the modal
        setWorkspaceToDelete(null);

        // This stops the function
        return;
      }

      // This reloads the remote workspace list
      await loadWorkspaces(currentUser);
    } else {
      // This gets the guest workspaces and journal entries
      const guestWorkspaces =
        JSON.parse(localStorage.getItem("entryWorkspaces")) || [];
      const guestJournalEntries =
        JSON.parse(localStorage.getItem("journalEntries")) || [];

      // This finds the selected workspace before removing it
      const matchedWorkspace = guestWorkspaces.find(
        (workspace) => workspace.id === workspaceToDelete
      );

      // This removes the selected guest workspace locally
      const updatedWorkspaces = guestWorkspaces.filter(
        (workspace) => workspace.id !== workspaceToDelete
      );

      // This also removes the linked guest journal entry if one exists
      const updatedJournalEntries = matchedWorkspace?.linkedJournalId
        ? guestJournalEntries.filter(
            (entry) => entry.id !== matchedWorkspace.linkedJournalId
          )
        : guestJournalEntries;

      // This stores the updated guest workspace list
      localStorage.setItem("entryWorkspaces", JSON.stringify(updatedWorkspaces));

      // This stores the updated guest journal entry list
      localStorage.setItem("journalEntries", JSON.stringify(updatedJournalEntries));

      // This updates local state
      setWorkspaces(updatedWorkspaces);
    }

    // This closes the delete modal
    setWorkspaceToDelete(null);

    // This clears any limit message
    setWorkspaceLimitMessage("");
  }

  // This cancels workspace deletion
  function handleCancelDeleteWorkspace() {
    // This clears the selected workspace
    setWorkspaceToDelete(null);
  }

  // This stores the sorted workspace list
  const sortedWorkspaces = getSortedWorkspaces();

  // This returns the page UI
  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/journal"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Journal Library
          </Link>

          <Link
            href="/"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Home
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="mb-6">
            <h1 className="app-page-title text-3xl md:text-4xl">
              Analysis Workspaces
            </h1>

            <p className="mt-2 text-sm text-gray-700 md:text-base">
              Create separate workspaces for different pairs, setups, or ideas.
            </p>

            <p className="mt-2 text-sm font-medium text-gray-800">
              {isCheckingAuth
                ? "Checking access..."
                : currentUser
                ? `Logged in as ${currentUser.email} — using your account workspaces`
                : "Please log in to create and save workspaces"}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="app-section-title text-xl">Saved Workspaces</h2>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-800">
                  Sort by
                </label>

                <select
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:border-black"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="az">A - Z</option>
                  <option value="za">Z - A</option>
                </select>
              </div>
            </div>

            {isLoadingWorkspaces ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                <h3 className="app-section-title text-xl">
                  Loading Workspaces...
                </h3>

                <p className="mt-2 text-sm text-gray-700">
                  Please wait while your workspaces are being loaded.
                </p>
              </div>
            ) : (
              <>
                {loadingError && (
                  <p className="mb-6 text-sm font-medium text-red-600">
                    {loadingError}
                  </p>
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <button
                    onClick={handleCreateWorkspace}
                    title="Create new entry workspace"
                    className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition duration-200 hover:border-black hover:bg-white hover:shadow-lg"
                  >
                    <div className="text-5xl font-light text-gray-700">+</div>
                    <p className="app-card-title mt-3 text-lg">
                      Create New Workspace
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      Start a new analysis workspace for a different pair or setup.
                    </p>
                  </button>

                  {sortedWorkspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      onClick={() =>
                        router.push(
                          `/new-entry/workspace?workspace=${workspace.id}`
                        )
                      }
                      className="cursor-default rounded-xl border border-gray-200 bg-gray-50 p-5 transition duration-200 hover:bg-white hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="app-card-title text-lg">
                            {workspace.workspaceTitle?.trim()
                              ? workspace.workspaceTitle
                              : "New Entry Workspace"}
                          </h2>

                          <p className="mt-2 text-sm text-gray-700">
                            Type:{" "}
                            {workspace.workspaceType === "strategy"
                              ? "Strategy Workspace"
                              : "General Workspace"}
                          </p>

                          <p className="mt-2 text-sm text-gray-700">
                            Instrument: {workspace.instrument || "No instrument yet"}
                          </p>

                          <p className="mt-1 text-sm text-gray-700">
                            Date: {workspace.entryDate || "No date yet"}
                          </p>

                          <p className="mt-1 text-sm text-gray-700">
                            Blocks: {workspace.analysisBlocks?.length || 0}
                          </p>

                          <p className="mt-2 text-xs text-gray-600">
                            Created: {formatDateTime(workspace.createdAt)}
                          </p>
                        </div>

                        <button
                          onClick={(event) =>
                            handleAskDeleteWorkspace(event, workspace.id)
                          }
                          className="cursor-pointer text-gray-800 transition duration-200 hover:scale-125 hover:text-black"
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

                      <div className="mt-4">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(
                              `/new-entry/workspace?workspace=${workspace.id}`
                            );
                          }}
                          className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                          Open Workspace
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {workspaceLimitMessage && (
                  <p className="mt-6 text-sm font-medium text-red-600">
                    {workspaceLimitMessage}
                  </p>
                )}

                {sortedWorkspaces.length === 0 && (
                  <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                    <h3 className="app-section-title text-xl">No Workspaces Yet</h3>

                    <p className="mt-2 text-sm text-gray-700">
                      Use the create card above to start your first workspace.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {isWorkspaceTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="app-section-title text-xl">Choose Workspace Type</h3>

            <p className="mt-3 text-sm text-gray-700">
              Choose the type of analysis workspace you want to create.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => handleCreateWorkspaceByType("general")}
                className="cursor-pointer rounded-xl border border-gray-300 bg-white p-4 text-left hover:bg-gray-50"
              >
                <p className="app-card-title text-base">General Workspace</p>
                <p className="mt-1 text-sm text-gray-700">
                  Use the normal free-text analysis workspace.
                </p>
              </button>

              <button
                onClick={() => handleCreateWorkspaceByType("strategy")}
                className="cursor-pointer rounded-xl border border-black bg-black p-4 text-left text-white hover:opacity-90"
              >
                <p className="app-card-title text-base">Strategy Workspace</p>
                <p className="mt-1 text-sm text-gray-200">
                  Use structured HTF, MTF, and Entry checklists.
                </p>
              </button>
            </div>

            <button
              onClick={() => setIsWorkspaceTypeModalOpen(false)}
              className="mt-5 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {workspaceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="app-section-title text-xl">Delete Workspace</h3>

            <p className="mt-3 text-sm text-gray-700">
              Deleting this workspace will also delete its linked journal entry.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCancelDeleteWorkspace}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmDeleteWorkspace}
                className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
