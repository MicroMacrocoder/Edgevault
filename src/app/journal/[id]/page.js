"use client";

// This imports React hooks for state and effects
import { useEffect, useState } from "react";

// This imports Link for navigation links
import Link from "next/link";

// This imports route params so we can read the journal id from the URL
import { useParams } from "next/navigation";

// This imports Supabase so we can check the current session
import { supabase } from "../../../lib/supabase";

// This imports helper functions used for loading and saving related journal/workspace data
import {
  getSingleJournalEntry,
  saveWorkspaceToSupabase,
} from "../../../lib/supabase";

// This imports the reusable fullscreen chart viewer popup
import FullscreenChartViewer from "../../../components/FullscreenChartViewer";

// This stores the shared displacement quality items
const DISPLACEMENT_QUALITY_ITEMS = [
  "Displacement Quality: Type A",
  "Displacement Quality: Type B",
  "Displacement Quality: Type C",
  "Displacement Quality: Type D",
];

// This stores the shared PDRA condition items
const SHARED_PDRA_CONDITION_ITEMS = [
  "Not Reached",
  "Respected",
  "Disrespected",
  "Valid",
  "Invalidated",
];

// This stores the high timeframe checklist items
const HIGH_TIMEFRAME_CHECKLIST = [
  {
    groupTitle: "1. Displacement - Market Direction",
    items: [
      "Market Direction Displacement: Present",
      "Market Direction Displacement: Not Present",
      "Market Direction Displacement Type: Bullish",
      "Market Direction Displacement Type: Bearish",
      ...DISPLACEMENT_QUALITY_ITEMS,
    ],
  },
  {
    groupTitle: "2. Displacement - Market Opposition",
    items: [
      "Market Opposition Displacement: Present",
      "Market Opposition Displacement: Not Present",
      "Market Opposition Displacement Type: Bullish",
      "Market Opposition Displacement Type: Bearish",
      ...DISPLACEMENT_QUALITY_ITEMS,
    ],
  },
  {
    groupTitle: "3. Structure Break",
    items: [
      "Swing High Broken",
      "Swing Low Broken",
      "Break Type: Body Close Break",
      "Break Type: Wick Break",
      "No Structure Break",
    ],
  },
  {
    groupTitle: "4. Market Context",
    items: ["Trending", "Retracement", "Reversal", "Consolidation"],
  },
  {
    groupTitle: "5. PDRA Identification - Market Direction",
    items: [
      "Market Direction Fair Value Gap (FVG)",
      "Market Direction Order Block (OB)",
      "Market Direction Liquidity",
      "Market Direction New Day Opening Gap",
      "Market Direction New Week Opening Gap",
      "Market Direction Other",
    ],
  },
  {
    groupTitle: "6. PDRA Identification - Market Opposition",
    items: [
      "Market Opposition Fair Value Gap (FVG)",
      "Market Opposition Order Block (OB)",
      "Market Opposition Liquidity",
      "Market Opposition New Day Opening Gap",
      "Market Opposition New Week Opening Gap",
      "Market Opposition Other",
    ],
  },
  {
    groupTitle: "7. PDRA Interaction - FVG",
    items: SHARED_PDRA_CONDITION_ITEMS.map((item) => `FVG: ${item}`),
  },
  {
    groupTitle: "8. PDRA Interaction - Order Block",
    items: SHARED_PDRA_CONDITION_ITEMS.map((item) => `Order Block: ${item}`),
  },
  {
    groupTitle: "9. PDRA Interaction - Liquidity",
    items: [
      "Liquidity: Not Reached",
      "Liquidity: Swept",
      "Liquidity: Reacted",
      "Liquidity: Valid",
    ],
  },
  {
    groupTitle: "10. PDRA Interaction - New Day Opening Gap",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `New Day Opening Gap: ${item}`
    ),
  },
  {
    groupTitle: "11. PDRA Interaction - New Week Opening Gap",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `New Week Opening Gap: ${item}`
    ),
  },
  {
    groupTitle: "12. Opposition PDRA Interaction - FVG",
    items: SHARED_PDRA_CONDITION_ITEMS.map((item) => `Opposition FVG: ${item}`),
  },
  {
    groupTitle: "13. Opposition PDRA Interaction - Order Block",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `Opposition Order Block: ${item}`
    ),
  },
  {
    groupTitle: "14. Opposition PDRA Interaction - Liquidity",
    items: [
      "Opposition Liquidity: Not Reached",
      "Opposition Liquidity: Swept",
      "Opposition Liquidity: Reacted",
      "Opposition Liquidity: Valid",
    ],
  },
  {
    groupTitle: "15. Opposition PDRA Interaction - New Day Opening Gap",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `Opposition New Day Opening Gap: ${item}`
    ),
  },
  {
    groupTitle: "16. Opposition PDRA Interaction - New Week Opening Gap",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `Opposition New Week Opening Gap: ${item}`
    ),
  },
  {
    groupTitle: "17. Current Price Condition",
    items: ["Price has interacted with PDRA", "No interaction yet"],
  },
  {
    groupTitle: "18. Action",
    items: ["Wait", "Go to Lower Timeframe"],
  },
  {
    groupTitle: "19. Final Bias",
    items: ["Bullish", "Bearish", "Range"],
  },
];

// This stores the medium timeframe checklist items
const MEDIUM_TIMEFRAME_CHECKLIST = [
  {
    groupTitle: "1. Market Direction",
    items: ["Bullish", "Bearish", "Range"],
  },
  {
    groupTitle: "2. Displacement - Market Direction",
    items: [
      "Market Direction Displacement: Present",
      "Market Direction Displacement: Not Present",
      "Market Direction Displacement Type: Bullish",
      "Market Direction Displacement Type: Bearish",
      ...DISPLACEMENT_QUALITY_ITEMS,
    ],
  },
  {
    groupTitle: "3. Displacement - Market Opposition",
    items: [
      "Market Opposition Displacement: Present",
      "Market Opposition Displacement: Not Present",
      "Market Opposition Displacement Type: Bullish",
      "Market Opposition Displacement Type: Bearish",
      ...DISPLACEMENT_QUALITY_ITEMS,
    ],
  },
  {
    groupTitle: "4. Structure Break",
    items: [
      "Swing High Broken",
      "Swing Low Broken",
      "Break Type: Body Close Break",
      "Break Type: Wick Break",
      "No Structure Break",
    ],
  },
  {
    groupTitle: "5. HTF Alignment",
    items: ["Aligned", "Not Aligned"],
  },
  {
    groupTitle: "6. PDRA Identification - Market Direction",
    items: [
      "Market Direction Fair Value Gap (FVG)",
      "Market Direction Order Block (OB)",
      "Market Direction Liquidity",
      "Market Direction New Day Opening Gap",
      "Market Direction New Week Opening Gap",
      "Market Direction Other",
    ],
  },
  {
    groupTitle: "7. PDRA Identification - Market Opposition",
    items: [
      "Market Opposition Fair Value Gap (FVG)",
      "Market Opposition Order Block (OB)",
      "Market Opposition Liquidity",
      "Market Opposition New Day Opening Gap",
      "Market Opposition New Week Opening Gap",
      "Market Opposition Other",
    ],
  },
  {
    groupTitle: "8. PDRA Condition - FVG",
    items: [
      "FVG: Created",
      ...SHARED_PDRA_CONDITION_ITEMS.map((item) => `FVG: ${item}`),
    ],
  },
  {
    groupTitle: "9. PDRA Condition - Order Block",
    items: [
      "Order Block: Created",
      ...SHARED_PDRA_CONDITION_ITEMS.map((item) => `Order Block: ${item}`),
    ],
  },
  {
    groupTitle: "10. PDRA Condition - Liquidity",
    items: [
      "Liquidity: Not Reached",
      "Liquidity: Swept",
      "Liquidity: Reacted",
      "Liquidity: Valid",
    ],
  },
  {
    groupTitle: "11. PDRA Condition - New Day Opening Gap",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `New Day Opening Gap: ${item}`
    ),
  },
  {
    groupTitle: "12. PDRA Condition - New Week Opening Gap",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `New Week Opening Gap: ${item}`
    ),
  },
  {
    groupTitle: "13. Opposition PDRA Condition - FVG",
    items: [
      "Opposition FVG: Created",
      ...SHARED_PDRA_CONDITION_ITEMS.map((item) => `Opposition FVG: ${item}`),
    ],
  },
  {
    groupTitle: "14. Opposition PDRA Condition - Order Block",
    items: [
      "Opposition Order Block: Created",
      ...SHARED_PDRA_CONDITION_ITEMS.map(
        (item) => `Opposition Order Block: ${item}`
      ),
    ],
  },
  {
    groupTitle: "15. Opposition PDRA Condition - Liquidity",
    items: [
      "Opposition Liquidity: Not Reached",
      "Opposition Liquidity: Swept",
      "Opposition Liquidity: Reacted",
      "Opposition Liquidity: Valid",
    ],
  },
  {
    groupTitle: "16. Opposition PDRA Condition - New Day Opening Gap",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `Opposition New Day Opening Gap: ${item}`
    ),
  },
  {
    groupTitle: "17. Opposition PDRA Condition - New Week Opening Gap",
    items: SHARED_PDRA_CONDITION_ITEMS.map(
      (item) => `Opposition New Week Opening Gap: ${item}`
    ),
  },
  {
    groupTitle: "18. Setup Status",
    items: ["No Setup", "Setup Valid", "Setup Not Ready"],
  },
  {
    groupTitle: "19. Stop Loss Logic",
    items: [
      "SL = High/Low of Displacement",
      "SL = High/Low of Order Block",
      "SL = High/Low of Reversal Gap",
      "SL = High/Low of Rejection",
      "SL = High/Low of Previous Day",
      "SL = High/Low of Previous Week",
      "SL = High/Low of Previous Month",
      "SL = High/Low of Previous Session",
      "Invalidation = Opposite Structure Break",
    ],
  },
  {
    groupTitle: "20. Take Profit Logic",
    items: [
      "TP = Previous Structure High/Low",
      "TP = High/Low of Displacement",
      "TP = High/Low of Order Block",
      "TP = High/Low of Reversal Gap",
      "TP = High/Low of Rejection",
      "TP = High/Low of Previous Day",
      "TP = High/Low of Previous Week",
      "TP = High/Low of Previous Month",
      "TP = High/Low of Previous Session",
    ],
  },
  {
    groupTitle: "21. Action",
    items: ["Wait", "Go to Lower Timeframe"],
  },
];

// This stores the entry timeframe checklist items
const ENTRY_TIMEFRAME_CHECKLIST = [
  {
    groupTitle: "1. Alignment",
    items: ["Aligned with MTF Setup", "Not Aligned"],
  },
  {
    groupTitle: "2. Displacement - Market Direction",
    items: [
      "Market Direction Displacement: Present",
      "Market Direction Displacement: Not Present",
      "Market Direction Displacement Direction: Bullish",
      "Market Direction Displacement Direction: Bearish",
      ...DISPLACEMENT_QUALITY_ITEMS,
    ],
  },
  {
    groupTitle: "3. Displacement - Market Opposition",
    items: [
      "Market Opposition Displacement: Present",
      "Market Opposition Displacement: Not Present",
      "Market Opposition Displacement Direction: Bullish",
      "Market Opposition Displacement Direction: Bearish",
      ...DISPLACEMENT_QUALITY_ITEMS,
    ],
  },
  {
    groupTitle: "4. Structure Shift",
    items: [
      "Swing High Broken",
      "Swing Low Broken",
      "Break Type: Body Close Break",
      "Break Type: Wick Break",
      "No Structure Break",
    ],
  },
  {
    groupTitle: "5. Entry PDRA - Market Direction",
    items: ["Fair Value Gap Entry", "Order Block Entry", "Liquidity Entry"],
  },
  {
    groupTitle: "6. Entry PDRA - Market Opposition",
    items: [
      "Opposition Fair Value Gap Entry",
      "Opposition Order Block Entry",
      "Opposition Liquidity Entry",
    ],
  },
  {
    groupTitle: "7. Entry Condition",
    items: ["Entry Valid", "Entry Not Valid"],
  },
  {
    groupTitle: "8. Action",
    items: ["Enter Trade", "Wait", "No Trade"],
  },
];

// This gets checklist items based on the block type
function getChecklistForBlockType(blockType) {
  if (blockType === "high_timeframe") {
    return HIGH_TIMEFRAME_CHECKLIST;
  }

  if (blockType === "medium_timeframe") {
    return MEDIUM_TIMEFRAME_CHECKLIST;
  }

  if (blockType === "entry_timeframe") {
    return ENTRY_TIMEFRAME_CHECKLIST;
  }

  return [];
}

// This normalizes old flat custom checklist data and new category checklist data
function normalizeCustomChecklistItems(customChecklistItems) {
  if (!Array.isArray(customChecklistItems)) {
    return [];
  }

  const hasCategoryShape = customChecklistItems.some((item) =>
    Object.prototype.hasOwnProperty.call(item || {}, "category")
  );

  if (hasCategoryShape) {
    return customChecklistItems.map((category) => ({
      id: category.id || category.category || `category-${Math.random()}`,
      category: category.category || "Custom Checklist",
      items: Array.isArray(category.items) ? category.items : [],
    }));
  }

  if (customChecklistItems.length === 0) {
    return [];
  }

  return [
    {
      id: "custom-checklist",
      category: "Custom Checklist",
      items: customChecklistItems,
    },
  ];
}

// This creates the journal entry detail page
export default function JournalEntryDetailPage() {
  // This reads the dynamic route id
  const params = useParams();

  // This stores the journal entry id from the URL
  const entryId = params?.id;

  // This stores the logged-in user
  const [currentUser, setCurrentUser] = useState(null);

  // This stores the journal entry data
  const [entry, setEntry] = useState(null);

  // This tells us if the page is still loading
  const [isLoading, setIsLoading] = useState(true);

  // This stores any loading error
  const [loadingError, setLoadingError] = useState("");

  // This stores normal save/update status messages for this page
  const [statusMessage, setStatusMessage] = useState("");

  // This stores whether the status message is an error
  const [isStatusError, setIsStatusError] = useState(false);

  // This stores which block image is currently open in fullscreen mode
  const [fullscreenBlock, setFullscreenBlock] = useState(null);

  // This updates the page status message cleanly
  function setPageStatus(message, isError = false) {
    setStatusMessage(message);
    setIsStatusError(isError);
  }

  // This gets the correct checklist group for the fullscreen chart preview
  function getAnalysisChecklistGroups(block) {
    if (!block) {
      return [];
    }

    return getChecklistForBlockType(block.blockType);
  }

  // This renders selected checklist items in the journal preview
  function renderChecklistPreview(block) {
  const checkedBuiltInItems = Array.isArray(block?.checklistItems)
    ? block.checklistItems.map((item) => ({
        id: item,
        label: item,
      }))
    : [];

  const checkedCustomItems = normalizeCustomChecklistItems(
    block?.customChecklistItems
  ).flatMap((category) =>
    Array.isArray(category.items)
      ? category.items
          .filter((item) => item.checked)
          .map((item) => ({
            id: item.id,
            label: item.label,
          }))
      : []
  );

  const allItems = [...checkedBuiltInItems, ...checkedCustomItems];

  if (allItems.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-700">
        No checklist items selected yet
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {allItems.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
        >
          ✓ {item.label}
        </div>
      ))}
    </div>
  );
}


  // This loads the correct journal entry source
  useEffect(() => {
    let isMounted = true;

    async function loadEntry() {
      if (isMounted) {
        setLoadingError("");
        setIsLoading(true);
        setStatusMessage("");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;

      if (isMounted) {
        setCurrentUser(user);
      }

      // This loads from Supabase for logged-in users
      if (user) {
        const { error, entry: remoteEntry } = await getSingleJournalEntry(
          user.id,
          entryId
        );

        if (error) {
          if (isMounted) {
            setLoadingError("Could not load this journal entry.");
            setEntry(null);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setEntry(
            remoteEntry
              ? {
                  ...remoteEntry,
                  analysisBlocks: Array.isArray(remoteEntry.analysisBlocks)
                    ? remoteEntry.analysisBlocks.map((block) => ({
                        ...block,
                        customChecklistItems: normalizeCustomChecklistItems(
                          block.customChecklistItems
                        ),
                      }))
                    : [],
                }
              : null
          );
          setIsLoading(false);
        }

        return;
      }

      // This loads guest entry from localStorage if no user is logged in
      const savedEntries =
        JSON.parse(localStorage.getItem("journalEntries")) || [];

      const foundEntry = savedEntries.find(
        (item) => String(item.id) === String(entryId)
      );

      if (isMounted) {
        setEntry(
          foundEntry
            ? {
                ...foundEntry,
                analysisBlocks: Array.isArray(foundEntry.analysisBlocks)
                  ? foundEntry.analysisBlocks.map((block) => ({
                      ...block,
                      customChecklistItems: normalizeCustomChecklistItems(
                        block.customChecklistItems
                      ),
                    }))
                  : [],
              }
            : null
        );
        setIsLoading(false);
      }
    }

    loadEntry();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setCurrentUser(session?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [entryId]);

  // This opens one chart image in fullscreen mode
  function handleOpenFullscreenChart(block) {
    setFullscreenBlock(block);
  }

  // This closes the fullscreen chart image popup
  function handleCloseFullscreenChart() {
    setFullscreenBlock(null);
  }

  // This updates the same analysis text for the selected block and persists it
  async function handleUpdateAnalysisFromViewer(updatedAnalysisHtml) {
    if (!entry || !fullscreenBlock) {
      return;
    }

    const updatedBlocks = (entry.analysisBlocks || []).map((block) =>
      block.id === fullscreenBlock.id
        ? {
            ...block,
            analysisHtml: updatedAnalysisHtml,
          }
        : block
    );

    const updatedEntry = {
      ...entry,
      analysisBlocks: updatedBlocks,
    };

    setEntry(updatedEntry);

    // This keeps the fullscreen viewer panel in sync immediately
    setFullscreenBlock((previousFullscreenBlock) => {
      if (!previousFullscreenBlock) {
        return previousFullscreenBlock;
      }

      return {
        ...previousFullscreenBlock,
        analysisHtml: updatedAnalysisHtml,
      };
    });

    try {
      // This saves to Supabase by updating the linked workspace, because journal previews use workspace blocks
      if (currentUser) {
        const workspacePayload = {
          id: entry.workspaceId,
          linkedJournalId: entry.id,
          workspaceType: entry.workspaceType || "general",
          workspaceTitle: entry.entryTitle || "",
          instrument: entry.instrument || "",
          entryDate: entry.entryDate || "",
          analysisBlocks: updatedBlocks,
        };

        const result = await saveWorkspaceToSupabase(
          currentUser.id,
          workspacePayload
        );

        if (result?.error) {
          setPageStatus("Could not update this journal block.", true);
          return;
        }

        setPageStatus("Journal block updated successfully.");
        return;
      }

      // This updates guest journal entries stored locally
      const existingEntries =
        JSON.parse(localStorage.getItem("journalEntries")) || [];

      const updatedEntries = existingEntries.map((savedEntry) =>
        String(savedEntry.id) === String(entry.id)
          ? {
              ...savedEntry,
              analysisBlocks: updatedBlocks,
            }
          : savedEntry
      );

      localStorage.setItem("journalEntries", JSON.stringify(updatedEntries));

      // This also updates the linked guest workspace so both places stay in sync
      const existingWorkspaces =
        JSON.parse(localStorage.getItem("entryWorkspaces")) || [];

      const updatedWorkspaces = existingWorkspaces.map((workspace) =>
        String(workspace.id) === String(entry.workspaceId)
          ? {
              ...workspace,
              workspaceTitle: entry.entryTitle || "",
              instrument: entry.instrument || "",
              entryDate: entry.entryDate || "",
              linkedJournalId: entry.id,
              analysisBlocks: updatedBlocks,
            }
          : workspace
      );

      localStorage.setItem("entryWorkspaces", JSON.stringify(updatedWorkspaces));

      setPageStatus("Guest journal block updated successfully.");
    } catch (error) {
      console.log("UPDATE JOURNAL BLOCK ERROR:", error);
      setPageStatus(
        "Something went wrong while updating the journal block.",
        true
      );
    }
  }

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
            href="/new-entry"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Analysis Workspaces
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="mb-6">
            <h1 className="app-page-title text-3xl md:text-4xl">
              Journal Entry Preview
            </h1>

            <p className="mt-2 text-sm text-gray-700 md:text-base">
              View your saved journal entry in full detail.
            </p>

            <p className="mt-2 text-sm font-medium text-gray-800">
              {currentUser
                ? `Logged in as ${currentUser.email}`
                : "Viewing guest journal entry"}
            </p>

            {statusMessage && (
              <p
                className={`mt-3 text-sm font-medium ${
                  isStatusError ? "text-red-600" : "text-green-600"
                }`}
              >
                {statusMessage}
              </p>
            )}
          </section>

          {isLoading ? (
            <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <h2 className="app-section-title text-xl">Loading Entry...</h2>

              <p className="mt-2 text-sm text-gray-700">
                Please wait while your journal entry is being loaded.
              </p>
            </section>
          ) : loadingError ? (
            <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <h2 className="app-section-title text-xl text-red-600">
                Loading Error
              </h2>

              <p className="mt-2 text-sm text-red-600">{loadingError}</p>
            </section>
          ) : !entry ? (
            <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <h2 className="app-section-title text-xl">Entry Not Found</h2>

              <p className="mt-2 text-sm text-gray-700">
                This journal entry could not be found.
              </p>
            </section>
          ) : (
            <>
              <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-medium uppercase text-gray-600">
                      Entry Title
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {entry.entryTitle || "Untitled Entry"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-medium uppercase text-gray-600">
                      Instrument
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {entry.instrument || "No instrument yet"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-medium uppercase text-gray-600">
                      Date
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {entry.entryDate || "No date yet"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
                <h2 className="app-page-title text-2xl">Saved Analysis Blocks</h2>

                <p className="mt-2 text-sm text-gray-700">
                  This is the full saved view of the journal entry.
                </p>

                <div className="mt-8 space-y-8">
                  {entry.analysisBlocks?.length > 0 ? (
                    entry.analysisBlocks.map((block, index) => (
                      <div
                        key={block.id}
                        className="rounded-xl border border-gray-200 p-5"
                      >
                        <h3 className="app-section-title text-xl">
                          {block.sectionName?.trim()
                            ? block.sectionName
                            : `Analysis Workspace ${index + 1}`}
                        </h3>

                        <div className="mt-4 space-y-4">
                          <div>
                            <p className="mb-2 text-sm font-medium text-gray-800">
                              Chart Preview
                            </p>

                            {block.chartImage ? (
                              <button
                                type="button"
                                onClick={() => handleOpenFullscreenChart(block)}
                                className="block w-full overflow-hidden rounded-lg border border-gray-200 text-left"
                                title="Open fullscreen chart"
                              >
                                <img
                                  src={block.chartImage}
                                  alt={`Saved chart preview ${index + 1}`}
                                  className="h-[420px] w-full object-contain transition hover:scale-[1.01]"
                                />
                              </button>
                            ) : (
                              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center text-sm text-gray-600">
                                No chart image selected yet
                              </div>
                            )}
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg bg-gray-50 p-4">
                              <p className="text-xs font-medium uppercase text-gray-600">
                                Section Name
                              </p>
                              <p className="mt-2 text-sm font-semibold text-gray-900">
                                {block.sectionName || "No section name yet"}
                              </p>
                            </div>

                            <div className="rounded-lg bg-gray-50 p-4">
                              <p className="text-xs font-medium uppercase text-gray-600">
                                Time Frame
                              </p>
                              <p className="mt-2 text-sm font-semibold text-gray-900">
                                {block.timeFrame || "No time frame yet"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg bg-gray-50 p-4">
                            <p className="text-xs font-medium uppercase text-gray-600">
                              Analysis Checklist
                            </p>

                            {renderChecklistPreview(block)}
                          </div>

                          <div className="rounded-lg bg-gray-50 p-4">
                            <p className="text-xs font-medium uppercase text-gray-600">
                              Analysis Text
                            </p>

                            {block.analysisHtml ? (
                              <div
                                className="mt-2 overflow-x-auto text-sm text-gray-800"
                                dangerouslySetInnerHTML={{
                                  __html: block.analysisHtml,
                                }}
                              />
                            ) : (
                              <p className="mt-2 text-sm text-gray-700">
                                No analysis text yet
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                      <h3 className="app-section-title text-xl">
                        No Saved Analysis Blocks
                      </h3>

                      <p className="mt-2 text-sm text-gray-700">
                        This journal entry does not contain any saved blocks yet.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* This is the fullscreen chart image popup with the linked analysis text panel */}
      <FullscreenChartViewer
        isOpen={Boolean(fullscreenBlock)}
        onClose={handleCloseFullscreenChart}
        image={fullscreenBlock?.chartImage || ""}
        sectionName={fullscreenBlock?.sectionName || ""}
        timeFrame={fullscreenBlock?.timeFrame || ""}
        analysisHtml={fullscreenBlock?.analysisHtml || ""}
        onUpdateAnalysis={handleUpdateAnalysisFromViewer}
        checklistGroups={getAnalysisChecklistGroups(fullscreenBlock)}
        checklistItems={fullscreenBlock?.checklistItems || []}
        customChecklistItems={fullscreenBlock?.customChecklistItems || []}
      />
    </main>
  );
}
