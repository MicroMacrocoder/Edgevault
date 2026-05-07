"use client";

// This imports React hooks for state and effects
import { useEffect, useState } from "react";

// This imports Link for navigation links
import Link from "next/link";

// This imports the router for page navigation
import { useRouter } from "next/navigation";

// This imports Supabase auth checking
import { supabase } from "../../lib/supabase";

// This imports journal delete and load helpers
import {
  getUserJournalEntries,
  deleteJournalAndLinkedWorkspaceFromSupabase,
} from "../../lib/supabase";

// This creates the journal library page
export default function JournalLibraryPage() {
  // This gives router navigation control
  const router = useRouter();

  // This stores the visible journal entries
  const [entries, setEntries] = useState([]);

  // This stores the current sort option
  const [sortOption, setSortOption] = useState("newest");

  // This stores the journal entry waiting for delete confirmation
  const [entryToDelete, setEntryToDelete] = useState(null);

  // This stores the currently logged-in user
  const [currentUser, setCurrentUser] = useState(null);

  // This tells us whether auth is still being checked
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // This tells us whether journal loading is still in progress
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);

  // This stores any loading error
  const [loadingError, setLoadingError] = useState("");

  // This loads journal entries from the correct source
  async function loadEntries(user) {
    // This clears any old loading error
    setLoadingError("");

    // This turns on loading state
    setIsLoadingEntries(true);

    // This loads remote journal entries for logged-in users
    if (user) {
      // This fetches the logged-in user's journal entries
      const { error, entries: remoteEntries } = await getUserJournalEntries(
        user.id
      );

      // This handles loading errors
      if (error) {
        // This stores a readable error
        setLoadingError("Could not load your journal library.");

        // This clears visible entries
        setEntries([]);

        // This ends loading
        setIsLoadingEntries(false);

        // This stops the function
        return;
      }

      // This stores the remote journal entries
      setEntries(remoteEntries);

      // This ends loading
      setIsLoadingEntries(false);

      // This stops the function
      return;
    }

    // This loads guest journal entries from localStorage
    const savedEntries = JSON.parse(localStorage.getItem("journalEntries")) || [];

    // This stores guest journal entries
    setEntries(savedEntries);

    // This ends loading
    setIsLoadingEntries(false);
  }

  // This checks auth and listens for auth changes without creating lock clashes
  useEffect(() => {
    // This helps prevent state updates after unmount
    let isMounted = true;

    // This loads the current session one time
    async function loadInitialSession() {
      // This loads the current session from Supabase
      const { data: sessionData } = await supabase.auth.getSession();

      // This gets the current user from the session
      const user = sessionData?.session?.user ?? null;

      // This stores the user if the component is still mounted
      if (isMounted) {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      }

      // This loads entries from the correct source
      if (isMounted) {
        await loadEntries(user);
      }
    }

    // This runs the initial session load
    loadInitialSession();

    // This listens for login and logout changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // This gets the updated user from the new session
      const user = session?.user ?? null;

      // This updates local auth state if still mounted
      if (isMounted) {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      }

      // This reloads journal entries for the new auth state
      if (isMounted) {
        loadEntries(user);
      }
    });

    // This cleans up the listener on unmount
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // This formats saved times into readable local text
  function formatDateTime(dateValue) {
    // This returns a fallback if no date exists
    if (!dateValue) {
      return "No time recorded";
    }

    // This converts the saved value into local time
    return new Date(dateValue).toLocaleString();
  }

  // This sorts the visible journal entries
  function getSortedEntries() {
    // This copies the entry list so we do not mutate state directly
    const copiedEntries = [...entries];

    // This sorts newest first
    if (sortOption === "newest") {
      return copiedEntries.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    // This sorts oldest first
    if (sortOption === "oldest") {
      return copiedEntries.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    }

    // This sorts alphabetically A to Z
    if (sortOption === "az") {
      return copiedEntries.sort((a, b) =>
        (a.entryTitle || "Untitled Entry").localeCompare(
          b.entryTitle || "Untitled Entry"
        )
      );
    }

    // This sorts alphabetically Z to A
    if (sortOption === "za") {
      return copiedEntries.sort((a, b) =>
        (b.entryTitle || "Untitled Entry").localeCompare(
          a.entryTitle || "Untitled Entry"
        )
      );
    }

    // This returns unchanged if no special sort is selected
    return copiedEntries;
  }

  // This prepares one journal entry for delete confirmation
  function handleAskDeleteEntry(event, entryId) {
    // This stops the card click from also opening the entry
    event.stopPropagation();

    // This stores the selected entry id
    setEntryToDelete(entryId);
  }

  // This confirms deleting one journal entry
  async function handleConfirmDeleteEntry() {
    // This stops if nothing is selected
    if (!entryToDelete) {
      return;
    }

    // This deletes the journal entry from Supabase for logged-in users
    if (currentUser) {
      // This deletes the matching remote entry and its linked workspace
      const { error } = await deleteJournalAndLinkedWorkspaceFromSupabase(
        currentUser.id,
        entryToDelete
      );

      // This handles delete errors
      if (error) {
        // This stores a readable error
        setLoadingError(
          "Could not delete the journal entry and its linked workspace from your account."
        );

        // This closes the modal
        setEntryToDelete(null);

        // This stops the function
        return;
      }

      // This reloads the journal entries from Supabase
      await loadEntries(currentUser);
    } else {
      // This gets the guest journal entries and workspaces
      const guestJournalEntries =
        JSON.parse(localStorage.getItem("journalEntries")) || [];
      const guestWorkspaces =
        JSON.parse(localStorage.getItem("entryWorkspaces")) || [];

      // This finds the selected entry before removing it
      const matchedEntry = guestJournalEntries.find(
        (entry) => entry.id === entryToDelete
      );

      // This removes the guest journal entry locally
      const updatedEntries = guestJournalEntries.filter(
        (entry) => entry.id !== entryToDelete
      );

      // This also removes the linked guest workspace if one exists
      const updatedWorkspaces = matchedEntry?.workspaceId
        ? guestWorkspaces.filter(
            (workspace) => workspace.id !== matchedEntry.workspaceId
          )
        : guestWorkspaces;

      // This stores the updated guest journal list
      localStorage.setItem("journalEntries", JSON.stringify(updatedEntries));

      // This stores the updated guest workspace list
      localStorage.setItem("entryWorkspaces", JSON.stringify(updatedWorkspaces));

      // This updates state
      setEntries(updatedEntries);
    }

    // This closes the modal
    setEntryToDelete(null);
  }

  // This cancels journal deletion
  function handleCancelDeleteEntry() {
    // This clears the selected entry
    setEntryToDelete(null);
  }

  // This stores the sorted entry list
  const sortedEntries = getSortedEntries();

  // This returns the page UI
  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/new-entry"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Analysis Workspaces
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
            <Link
              href="/"
              className="app-page-title block text-3xl hover:opacity-80 md:text-4xl"
            >
              Journal Library
            </Link>

            <p className="mt-2 text-sm text-gray-700 md:text-base">
              View and manage your saved journal entries.
            </p>

            <p className="mt-2 text-sm font-medium text-gray-800">
              {isCheckingAuth
                ? "Checking access..."
                : currentUser
                ? `Logged in as ${currentUser.email} — using your account journal library`
                : "Guest mode — using local journal library only"}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="app-section-title text-xl">Saved Entries</h2>

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

            {isLoadingEntries ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                <h3 className="app-section-title text-xl">
                  Loading Journal Entries...
                </h3>

                <p className="mt-2 text-sm text-gray-700">
                  Please wait while your journal library is being loaded.
                </p>
              </div>
            ) : (
              <>
                {loadingError && (
                  <p className="mb-6 text-sm font-medium text-red-600">
                    {loadingError}
                  </p>
                )}

                {sortedEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                    <h3 className="app-section-title text-xl">
                      No Journal Entries Yet
                    </h3>

                    <p className="mt-2 text-sm text-gray-700">
                      Save a workspace to your journal library to see it here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sortedEntries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => router.push(`/journal/${entry.id}`)}
                        className="cursor-default rounded-xl border border-gray-200 bg-gray-50 p-5 transition duration-200 hover:bg-white hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="app-card-title text-lg">
                              {entry.entryTitle?.trim()
                                ? entry.entryTitle
                                : "Untitled Entry"}
                            </h2>

                            <p className="mt-2 text-sm text-gray-700">
                              Instrument: {entry.instrument || "No instrument yet"}
                            </p>

                            <p className="mt-1 text-sm text-gray-700">
                              Date: {entry.entryDate || "No date yet"}
                            </p>

                            <p className="mt-1 text-sm text-gray-700">
                              Blocks: {entry.analysisBlocks?.length || 0}
                            </p>

                            <p className="mt-2 text-xs text-gray-600">
                              Saved: {formatDateTime(entry.createdAt)}
                            </p>
                          </div>

                          <button
                            onClick={(event) =>
                              handleAskDeleteEntry(event, entry.id)
                            }
                            className="cursor-pointer text-gray-800 transition duration-200 hover:scale-125 hover:text-black"
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

                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/journal/${entry.id}`);
                            }}
                            className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                          >
                            Open Entry
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/new-entry/workspace?source=journal&id=${entry.id}`);
                            }}
                            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
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
          </section>
        </div>
      </div>

      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="app-section-title text-xl">Delete Journal Entry</h3>

            <p className="mt-3 text-sm text-gray-700">
              Deleting this journal entry will also delete its linked workspace analysis.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCancelDeleteEntry}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmDeleteEntry}
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
