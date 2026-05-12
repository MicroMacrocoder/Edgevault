// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import {
  supabase,
  uploadChartImage,
  deleteChartImage,
  getSingleWorkspace,
  getSingleJournalEntry,
  saveWorkspaceToSupabase,
  saveJournalEntryToSupabase,
} from "@/lib/supabase";

import FullscreenChartViewer from "@/components/FullscreenChartViewer";
import RichTextAnalysisEditor from "@/components/RichTextAnalysisEditor";

type NewEntryEditorWorkspaceProps = {
  workspaceIdFromDashboard?: string;
  workspaceTypeFromDashboard?: "general" | "strategy";
  journalSourceFromDashboard?: string;
  journalIdFromDashboard?: string;
  onBack?: () => void;
};
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

// This stores a rule guide for displacement quality
const DISPLACEMENT_RULES = [
  {
    title: "Type A",
    description:
      "Clean displacement with strong body candles and little or no wick rejection. This is the best quality displacement.",
  },
  {
    title: "Type B",
    description:
      "Displacement with some wicks in between, but price still shows clear directional movement.",
  },
  {
    title: "Type C",
    description:
      "Displacement where the final candle has a large wick, showing rejection near the end of the move.",
  },
  {
    title: "Type D",
    description:
      "Weak or unclear displacement. This is the lowest quality and should be treated carefully.",
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

// This removes the leading number from a checklist category title
function removeCategoryNumber(groupTitle) {
  return String(groupTitle || "").replace(/^\d+\.\s*/, "");
}

// This gets the next custom category number after built-in categories and saved custom categories
function getNextCategoryNumber(block) {
  const builtInGroups = getChecklistForBlockType(block?.blockType);

  const customCategories = normalizeCustomChecklistItems(
    block?.customChecklistItems
  );

  const customOnlyCategories = customCategories.filter(
    (category) =>
      !builtInGroups.some((group) => group.groupTitle === category.category)
  );

  return builtInGroups.length + customOnlyCategories.length + 1;
}

// This creates a numbered custom category title
function createNumberedCustomCategoryTitle(block, categoryText) {
  const cleanCategoryText = String(categoryText || "").trim();
  const categoryNumber = getNextCategoryNumber(block);

  return `${categoryNumber}. ${removeCategoryNumber(cleanCategoryText)}`;
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
      id:
        category.id ||
        `category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: category.category || "Custom Checklist",
      items: Array.isArray(category.items) ? category.items : [],
    }));
  }

  if (customChecklistItems.length === 0) {
    return [];
  }

  return [
    {
      id: `category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: "Custom Checklist",
      items: customChecklistItems,
    },
  ];
}

// This creates the default custom checklist categories for a new general workspace block
function createDefaultCustomChecklistCategories() {
  return [];
}

// This merges built-in checklist groups with custom categories so both display as one checklist flow
function getMergedChecklistGroups(block) {
  const builtInGroups = getChecklistForBlockType(block?.blockType);
  const customCategories = normalizeCustomChecklistItems(
    block?.customChecklistItems
  );

  const mergedBuiltInGroups = builtInGroups.map((group) => {
    const matchedCustomCategory = customCategories.find(
      (category) => category.category === group.groupTitle
    );

    return {
      ...group,
      customItems: matchedCustomCategory?.items || [],
    };
  });

  const customOnlyCategories = customCategories.filter(
    (category) =>
      !builtInGroups.some((group) => group.groupTitle === category.category)
  );

  const customGroups = customOnlyCategories.map((category) => ({
    groupTitle: category.category,
    items: [],
    customItems: Array.isArray(category.items) ? category.items : [],
    isCustomCategory: true,
  }));

  return [...mergedBuiltInGroups, ...customGroups];
}

// This gets checklist items based on all groups in a block
function getChecklistLabelsForPreview(block) {
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

  return [...checkedBuiltInItems, ...checkedCustomItems];
}

// This gets all available categories for the custom checklist category dropdown
function getAvailableChecklistCategories(block) {
  return getMergedChecklistGroups(block).map((group) => group.groupTitle);
}

// This creates a brand new analysis block
function createNewBlock(blockType = "general", sectionName = "") {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    blockType,
    sectionName,
    timeFrame: "",
    analysisHtml: "",
    chartImage: "",
    chartFileName: "",
    chartFilePath: "",
    checklistItems: [],
    customChecklistItems:
      blockType === "general" ? createDefaultCustomChecklistCategories() : [],
    isUploadingImage: false,
  };
}

// This creates the default strategy analysis blocks
function createDefaultStrategyBlocks() {
  return [
    createNewBlock("high_timeframe", "High Timeframe"),
    createNewBlock("medium_timeframe", "Medium Timeframe"),
    createNewBlock("entry_timeframe", "Entry Timeframe"),
  ];
}
export default function NewEntryEditorWorkspace({
  workspaceIdFromDashboard,
  workspaceTypeFromDashboard,
  journalSourceFromDashboard,
  journalIdFromDashboard,
  onBack,
}: NewEntryEditorWorkspaceProps) {
  const [workspaceId, setWorkspaceId] = useState(null);
  const workspaceIdRef = useRef(null);
  const [linkedJournalId, setLinkedJournalId] = useState(null);
  const [isJournalEdit, setIsJournalEdit] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [workspaceType, setWorkspaceType] = useState("general");
  const [workspaceTitle, setWorkspaceTitle] = useState("");
  const [instrument, setInstrument] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [analysisBlocks, setAnalysisBlocks] = useState([createNewBlock()]);
  const [customChecklistTextByBlock, setCustomChecklistTextByBlock] =
    useState({});
  const [customChecklistCategoryByBlock, setCustomChecklistCategoryByBlock] =
    useState({});
  const [
    customChecklistNewCategoryByBlock,
    setCustomChecklistNewCategoryByBlock,
  ] = useState({});
  const [limitMessage, setLimitMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaveError, setIsSaveError] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState(null);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlock, setPreviewBlock] = useState(null);
  const [fullscreenBlock, setFullscreenBlock] = useState(null);

  function setStatusMessage(message, isError = false) {
    setSaveMessage(message);
    setIsSaveError(isError);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      setIsPageLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;

      if (isMounted) {
        setCurrentUser(user);
      }

      const workspaceParam = workspaceIdFromDashboard || null;
      const workspaceTypeParam = workspaceTypeFromDashboard || null;
      const journalSource = journalSourceFromDashboard || null;
      const journalId = journalIdFromDashboard || null;

      if (user) {
        if (workspaceParam) {
          const { error, workspace } = await getSingleWorkspace(
            user.id,
            workspaceParam
          );

          if (!error && workspace && isMounted) {
            workspaceIdRef.current = workspace.id;
            setWorkspaceId(workspace.id);
            setLinkedJournalId(workspace.linkedJournalId || null);
            setWorkspaceType(workspace.workspaceType || "general");
            setWorkspaceTitle(workspace.workspaceTitle || "");
            setInstrument(workspace.instrument || "");
            setEntryDate(workspace.entryDate || "");
            setAnalysisBlocks(
              workspace.analysisBlocks?.length > 0
                ? workspace.analysisBlocks.map((block) => ({
                    ...block,
                    customChecklistItems: normalizeCustomChecklistItems(
                      block.customChecklistItems
                    ),
                  }))
                : workspace.workspaceType === "strategy"
                  ? createDefaultStrategyBlocks()
                  : [createNewBlock()]
            );
            setIsPageLoading(false);
            return;
          }

          if (isMounted) {
            workspaceIdRef.current = workspaceParam;
            setWorkspaceId(workspaceParam);

            if (workspaceTypeParam === "strategy") {
              setWorkspaceType("strategy");
              setAnalysisBlocks(createDefaultStrategyBlocks());
            } else {
              setWorkspaceType("general");
              setAnalysisBlocks([createNewBlock()]);
            }
          }
        }

        if (journalSource === "journal" && journalId) {
          const { error, entry } = await getSingleJournalEntry(
            user.id,
            journalId
          );

          if (!error && entry && isMounted) {
            setIsJournalEdit(true);
            setLinkedJournalId(entry.id);
            setWorkspaceType(entry.workspaceType || "general");
            setWorkspaceTitle(entry.entryTitle || "");
            setInstrument(entry.instrument || "");
            setEntryDate(entry.entryDate || "");
            setAnalysisBlocks(
              entry.analysisBlocks?.length > 0
                ? entry.analysisBlocks.map((block) => ({
                    ...block,
                    customChecklistItems: normalizeCustomChecklistItems(
                      block.customChecklistItems
                    ),
                  }))
                : [createNewBlock()]
            );
            setIsPageLoading(false);
            return;
          }
        }

        if (isMounted) {
          setIsPageLoading(false);
        }
        return;
      }

      if (workspaceTypeParam === "strategy") {
        if (isMounted) {
          setWorkspaceType("strategy");
          setLimitMessage(
            "Strategy Workspaces are account-only. Please log in to use and save this workspace type."
          );
          setAnalysisBlocks(createDefaultStrategyBlocks());
        }
      }

      if (workspaceParam) {
        const existingWorkspaces =
          typeof window !== "undefined"
            ? JSON.parse(localStorage.getItem("entryWorkspaces") || "[]")
            : [];

        const foundWorkspace = existingWorkspaces.find(
          (workspace) => String(workspace.id) === String(workspaceParam)
        );

        if (foundWorkspace && isMounted) {
          workspaceIdRef.current = foundWorkspace.id;
          setWorkspaceId(foundWorkspace.id);
          setLinkedJournalId(foundWorkspace.linkedJournalId || null);
          setWorkspaceType(foundWorkspace.workspaceType || "general");
          setWorkspaceTitle(foundWorkspace.workspaceTitle || "");
          setInstrument(foundWorkspace.instrument || "");
          setEntryDate(foundWorkspace.entryDate || "");
          setAnalysisBlocks(
            foundWorkspace.analysisBlocks?.length > 0
              ? foundWorkspace.analysisBlocks.map((block) => ({
                  ...block,
                  customChecklistItems: normalizeCustomChecklistItems(
                    block.customChecklistItems
                  ),
                }))
              : foundWorkspace.workspaceType === "strategy"
                ? createDefaultStrategyBlocks()
                : [createNewBlock()]
          );
        } else if (isMounted) {
          setWorkspaceId(workspaceParam);
        }
      }

      if (journalSource === "journal" && journalId) {
        const existingEntries =
          typeof window !== "undefined"
            ? JSON.parse(localStorage.getItem("journalEntries") || "[]")
            : [];

        const foundEntry = existingEntries.find(
          (entry) => String(entry.id) === String(journalId)
        );

        if (foundEntry && isMounted) {
          setIsJournalEdit(true);
          setLinkedJournalId(foundEntry.id);
          setWorkspaceType(foundEntry.workspaceType || "general");
          setWorkspaceTitle(foundEntry.entryTitle || "");
          setInstrument(foundEntry.instrument || "");
          setEntryDate(foundEntry.entryDate || "");
          setAnalysisBlocks(
            foundEntry.analysisBlocks?.length > 0
              ? foundEntry.analysisBlocks.map((block) => ({
                  ...block,
                  customChecklistItems: normalizeCustomChecklistItems(
                    block.customChecklistItems
                  ),
                }))
              : [createNewBlock()]
          );
        }
      }

      if (isMounted) {
        setIsPageLoading(false);
      }
    }

    loadInitialData();

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
  }, [
    workspaceIdFromDashboard,
    workspaceTypeFromDashboard,
    journalSourceFromDashboard,
    journalIdFromDashboard,
  ]);

  function getOrCreateWorkspaceId() {
    if (workspaceIdRef.current) {
      return workspaceIdRef.current;
    }

    if (workspaceId) {
      workspaceIdRef.current = workspaceId;
      return workspaceId;
    }

    const newWorkspaceId = `workspace-${Date.now()}`;
    workspaceIdRef.current = newWorkspaceId;
    setWorkspaceId(newWorkspaceId);
    return newWorkspaceId;
  }

  function updateSpecificBlock(blockId, updates) {
    setAnalysisBlocks((previousBlocks) =>
      previousBlocks.map((block) =>
        block.id === blockId ? { ...block, ...updates } : block
      )
    );

    setPreviewBlock((previousPreviewBlock) => {
      if (!previousPreviewBlock || previousPreviewBlock.id !== blockId) {
        return previousPreviewBlock;
      }

      return {
        ...previousPreviewBlock,
        ...updates,
      };
    });

    setFullscreenBlock((previousFullscreenBlock) => {
      if (!previousFullscreenBlock || previousFullscreenBlock.id !== blockId) {
        return previousFullscreenBlock;
      }

      return {
        ...previousFullscreenBlock,
        ...updates,
      };
    });
  }

  function handleBlockChange(blockId, fieldName, fieldValue) {
    updateSpecificBlock(blockId, {
      [fieldName]: fieldValue,
    });
  }

  function handleToggleChecklistItem(blockId, itemLabel) {
    const targetBlock = analysisBlocks.find((block) => block.id === blockId);

    if (!targetBlock) {
      return;
    }

    const currentItems = Array.isArray(targetBlock.checklistItems)
      ? targetBlock.checklistItems
      : [];

    const nextItems = currentItems.includes(itemLabel)
      ? currentItems.filter((item) => item !== itemLabel)
      : [...currentItems, itemLabel];

    updateSpecificBlock(blockId, {
      checklistItems: nextItems,
    });
  }

  function handleToggleCustomChecklistItem(blockId, itemId) {
    const targetBlock = analysisBlocks.find((block) => block.id === blockId);

    if (!targetBlock) {
      return;
    }

    const currentCategories = normalizeCustomChecklistItems(
      targetBlock.customChecklistItems
    );

    const nextCategories = currentCategories.map((category) => ({
      ...category,
      items: Array.isArray(category.items)
        ? category.items.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          )
        : [],
    }));

    updateSpecificBlock(blockId, {
      customChecklistItems: nextCategories,
    });
  }

  function handleCustomChecklistTextChange(blockId, value) {
    setCustomChecklistTextByBlock((previousValues) => ({
      ...previousValues,
      [blockId]: value,
    }));
  }

  function handleCustomChecklistCategoryChange(blockId, value) {
    setCustomChecklistCategoryByBlock((previousValues) => ({
      ...previousValues,
      [blockId]: value,
    }));
  }

  function handleCustomChecklistNewCategoryChange(blockId, value) {
    setCustomChecklistNewCategoryByBlock((previousValues) => ({
      ...previousValues,
      [blockId]: value,
    }));
  }

  function handleAddCustomChecklistItem(blockId) {
    const textValue = customChecklistTextByBlock[blockId] || "";
    const cleanTextValue = textValue.trim();

    if (!cleanTextValue) {
      setStatusMessage("Type a custom checkbox label first.", true);
      return;
    }

    const targetBlock = analysisBlocks.find((block) => block.id === blockId);

    if (!targetBlock) {
      return;
    }

    const currentCategories = normalizeCustomChecklistItems(
      targetBlock.customChecklistItems
    );

    const selectedCategory = customChecklistCategoryByBlock[blockId] || "";
    const newCategoryText = customChecklistNewCategoryByBlock[blockId] || "";
    const cleanNewCategoryText = newCategoryText.trim();

    if (!selectedCategory && !cleanNewCategoryText) {
      setStatusMessage(
        "Select an existing category or create a new one first.",
        true
      );
      return;
    }

    const finalCategoryName = cleanNewCategoryText
      ? createNumberedCustomCategoryTitle(targetBlock, cleanNewCategoryText)
      : selectedCategory;

    const existingCustomCategory = currentCategories.find(
      (category) => category.category === finalCategoryName
    );

    const newCustomItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: cleanTextValue,
      checked: false,
    };

    let nextCategories = [];

    if (existingCustomCategory) {
      nextCategories = currentCategories.map((category) =>
        category.category === finalCategoryName
          ? {
              ...category,
              items: [
                ...(Array.isArray(category.items) ? category.items : []),
                newCustomItem,
              ],
            }
          : category
      );
    } else {
      nextCategories = [
        ...currentCategories,
        {
          id: `category-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          category: finalCategoryName,
          items: [newCustomItem],
        },
      ];
    }

    updateSpecificBlock(blockId, {
      customChecklistItems: nextCategories,
    });

    setCustomChecklistTextByBlock((previousValues) => ({
      ...previousValues,
      [blockId]: "",
    }));

    setCustomChecklistNewCategoryByBlock((previousValues) => ({
      ...previousValues,
      [blockId]: "",
    }));

    setCustomChecklistCategoryByBlock((previousValues) => ({
      ...previousValues,
      [blockId]: finalCategoryName,
    }));

    setStatusMessage("Custom checkbox added. Use Update Workspace to save it.");
  }

  function handleDeleteCustomChecklistItem(blockId, itemId) {
    const targetBlock = analysisBlocks.find((block) => block.id === blockId);

    if (!targetBlock) {
      return;
    }

    const currentCategories = normalizeCustomChecklistItems(
      targetBlock.customChecklistItems
    );

    const nextCategories = currentCategories
      .map((category) => ({
        ...category,
        items: Array.isArray(category.items)
          ? category.items.filter((item) => item.id !== itemId)
          : [],
      }))
      .filter(
        (category) => Array.isArray(category.items) && category.items.length > 0
      );

    updateSpecificBlock(blockId, {
      customChecklistItems: nextCategories,
    });

    setStatusMessage(
      "Custom checkbox removed. Use Update Workspace to save changes."
    );
  }

  function handleAddAnalysisBlock(afterBlockId = null) {
    if (!currentUser && analysisBlocks.length >= 2) {
      setLimitMessage(
        "Guest users can only create 2 analysis blocks. Log in to unlock more analysis blocks."
      );
      return;
    }

    setLimitMessage("");

    const nextBlock =
      workspaceType === "strategy"
        ? createNewBlock("general", "Extra Analysis Block")
        : createNewBlock();

    if (!afterBlockId) {
      setAnalysisBlocks((previousBlocks) => [...previousBlocks, nextBlock]);
      return;
    }

    setAnalysisBlocks((previousBlocks) => {
      const targetIndex = previousBlocks.findIndex(
        (block) => block.id === afterBlockId
      );

      if (targetIndex === -1) {
        return [...previousBlocks, nextBlock];
      }

      return [
        ...previousBlocks.slice(0, targetIndex + 1),
        nextBlock,
        ...previousBlocks.slice(targetIndex + 1),
      ];
    });
  }

  function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleImageChange(blockId, event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    updateSpecificBlock(blockId, {
      isUploadingImage: true,
    });

    try {
      if (currentUser) {
        const finalWorkspaceId = getOrCreateWorkspaceId();

        const uploadResult = await uploadChartImage(
          file,
          currentUser.id,
          finalWorkspaceId,
          blockId
        );

        if (uploadResult.error) {
          updateSpecificBlock(blockId, {
            isUploadingImage: false,
          });

          setStatusMessage("Image upload failed.", true);
          return;
        }

        updateSpecificBlock(blockId, {
          chartImage: uploadResult.url,
          chartFileName: file.name,
          chartFilePath: uploadResult.path,
          isUploadingImage: false,
        });

        setStatusMessage("Image uploaded successfully.");
        return;
      }

      const base64Image = await convertFileToBase64(file);

      updateSpecificBlock(blockId, {
        chartImage: base64Image,
        chartFileName: file.name,
        chartFilePath: "",
        isUploadingImage: false,
      });

      setStatusMessage("Guest image stored locally for this device only.");
    } catch (error) {
      console.log("IMAGE CHANGE ERROR:", error);

      updateSpecificBlock(blockId, {
        isUploadingImage: false,
      });

      setStatusMessage("Something went wrong while handling the image.", true);
    }
  }

  function handleAskDeleteImage(blockId) {
    setImageToDelete(blockId);
  }

  async function handleConfirmDeleteImage() {
    if (!imageToDelete) {
      return;
    }

    const targetBlock = analysisBlocks.find(
      (block) => block.id === imageToDelete
    );

    if (currentUser && targetBlock?.chartFilePath) {
      await deleteChartImage(targetBlock.chartFilePath);
    }

    updateSpecificBlock(imageToDelete, {
      chartImage: "",
      chartFileName: "",
      chartFilePath: "",
    });

    setImageToDelete(null);
    setStatusMessage("Image removed from this analysis block only.");
  }

  function handleCancelDeleteImage() {
    setImageToDelete(null);
  }

  function handleAskDeleteBlock(blockId) {
    setBlockToDelete(blockId);
  }

  async function handleConfirmDeleteBlock() {
    if (!blockToDelete) {
      return;
    }

    const targetBlock = analysisBlocks.find(
      (block) => block.id === blockToDelete
    );

    if (currentUser && targetBlock?.chartFilePath) {
      await deleteChartImage(targetBlock.chartFilePath);
    }

    const updatedBlocks = analysisBlocks.filter(
      (block) => block.id !== blockToDelete
    );

    setAnalysisBlocks(updatedBlocks);
    setBlockToDelete(null);
    setLimitMessage("");
    setStatusMessage("Analysis block deleted.");
  }

  function handleCancelDeleteBlock() {
    setBlockToDelete(null);
  }
   function buildWorkspaceObject() {
    const finalWorkspaceId = getOrCreateWorkspaceId();

    const cleanBlocks = analysisBlocks.map((block) => ({
      ...block,
      blockType: block.blockType || "general",
      chartImage: block.chartImage || "",
      chartFileName: block.chartFileName || "",
      chartFilePath: block.chartFilePath || "",
      checklistItems: Array.isArray(block.checklistItems)
        ? block.checklistItems
        : [],
      customChecklistItems: normalizeCustomChecklistItems(
        block.customChecklistItems
      ),
    }));

    return {
      id: finalWorkspaceId,
      linkedJournalId,
      workspaceType,
      workspaceTitle,
      instrument,
      entryDate,
      analysisBlocks: cleanBlocks,
      createdAt: new Date().toISOString(),
    };
  }

  function handleOpenPreview() {
    setPreviewBlock(null);
    setIsPreviewOpen(true);
  }

  function handleOpenBlockPreview(block) {
    setPreviewBlock(block);
    setIsPreviewOpen(true);
  }

  function handleClosePreview() {
    setIsPreviewOpen(false);
    setPreviewBlock(null);
  }

  function handleOpenFullscreenChart(block) {
    setFullscreenBlock(block);
  }

  function handleCloseFullscreenChart() {
    setFullscreenBlock(null);
  }

  async function handleUpdateAnalysisFromViewer(updatedAnalysisHtml) {
    if (!fullscreenBlock) {
      return;
    }

    updateSpecificBlock(fullscreenBlock.id, {
      analysisHtml: updatedAnalysisHtml,
    });

    setStatusMessage(
      "Analysis text updated in this workspace. Use Update Workspace or Save to Journal Library to persist it."
    );
  }

  async function handleUpdateChecklistFromViewer() {
    const saveWorked = await handleUpdateWorkspace();

    if (saveWorked) {
      setStatusMessage("Checklist updated from chart preview.");
    }
  }

  async function handleUpdateWorkspace() {
    if (workspaceType === "strategy" && !currentUser) {
      setStatusMessage(
        "Strategy Workspaces are account-only. Please log in to save this workspace.",
        true
      );
      return false;
    }

    const workspaceObject = buildWorkspaceObject();

    if (currentUser) {
      const result = await saveWorkspaceToSupabase(
        currentUser.id,
        workspaceObject
      );

      if (result?.error) {
        setStatusMessage("Could not save workspace to your account.", true);
        return false;
      }

      workspaceIdRef.current = workspaceObject.id;
      setWorkspaceId(workspaceObject.id);
      setLinkedJournalId(workspaceObject.linkedJournalId || linkedJournalId);
      setStatusMessage("Workspace updated to your account.");
      return true;
    }

    const existingWorkspaces = JSON.parse(
      localStorage.getItem("entryWorkspaces") || "[]"
    );

    const workspaceExists = existingWorkspaces.some(
      (workspace) => workspace.id === workspaceObject.id
    );

    const updatedWorkspaces = workspaceExists
      ? existingWorkspaces.map((workspace) =>
          workspace.id === workspaceObject.id ? workspaceObject : workspace
        )
      : [workspaceObject, ...existingWorkspaces];

    localStorage.setItem("entryWorkspaces", JSON.stringify(updatedWorkspaces));
    setWorkspaceId(workspaceObject.id);
    setLinkedJournalId(workspaceObject.linkedJournalId || linkedJournalId);
    setStatusMessage("Workspace updated.");
    return true;
  }

  async function handleSaveToJournalLibrary() {
    if (workspaceType === "strategy" && !currentUser) {
      setStatusMessage(
        "Strategy Workspaces are account-only. Please log in to save this workspace.",
        true
      );
      return false;
    }

    const workspaceObject = buildWorkspaceObject();

    const journalId =
      linkedJournalId ||
      workspaceObject.linkedJournalId ||
      `journal-${Date.now()}`;

    const workspaceObjectWithJournalLink = {
      ...workspaceObject,
      linkedJournalId: journalId,
    };

    if (currentUser) {
      const workspaceResult = await saveWorkspaceToSupabase(
        currentUser.id,
        workspaceObjectWithJournalLink
      );

      if (workspaceResult?.error) {
        setStatusMessage("Could not save workspace before journal save.", true);
        return false;
      }
    }

    const journalEntry = {
      id: journalId,
      workspaceId: workspaceObjectWithJournalLink.id,
      workspaceType,
      entryTitle: workspaceTitle,
      instrument,
      entryDate,
      analysisBlocks: workspaceObjectWithJournalLink.analysisBlocks,
      createdAt: new Date().toISOString(),
    };

    if (currentUser) {
      const journalResult = await saveJournalEntryToSupabase(
        currentUser.id,
        journalEntry
      );

      if (journalResult?.error) {
        setStatusMessage("Could not save journal entry to your account.", true);
        return false;
      }

      workspaceIdRef.current = workspaceObjectWithJournalLink.id;
      setWorkspaceId(workspaceObjectWithJournalLink.id);
      setLinkedJournalId(journalId);
      setStatusMessage("Your journal has been saved to your account.");
      return true;
    }

    const existingEntries = JSON.parse(
      localStorage.getItem("journalEntries") || "[]"
    );

    const entryExists = existingEntries.some((entry) => entry.id === journalId);

    const updatedEntries = entryExists
      ? existingEntries.map((entry) =>
          entry.id === journalId ? journalEntry : entry
        )
      : [journalEntry, ...existingEntries];

    localStorage.setItem("journalEntries", JSON.stringify(updatedEntries));

    const guestWorkspaceObject = {
      ...workspaceObjectWithJournalLink,
      linkedJournalId: journalId,
    };

    const existingWorkspaces = JSON.parse(
      localStorage.getItem("entryWorkspaces") || "[]"
    );

    const workspaceExists = existingWorkspaces.some(
      (workspace) => workspace.id === guestWorkspaceObject.id
    );

    const updatedWorkspaces = workspaceExists
      ? existingWorkspaces.map((workspace) =>
          workspace.id === guestWorkspaceObject.id
            ? guestWorkspaceObject
            : workspace
        )
      : [guestWorkspaceObject, ...existingWorkspaces];

    localStorage.setItem("entryWorkspaces", JSON.stringify(updatedWorkspaces));

    workspaceIdRef.current = guestWorkspaceObject.id;
    setWorkspaceId(guestWorkspaceObject.id);
    setLinkedJournalId(journalId);
    setStatusMessage("Your journal has been saved.");
    return true;
  }

  async function handleSaveToJournalFromPreview() {
    const saveWorked = await handleSaveToJournalLibrary();

    if (saveWorked) {
      setIsPreviewOpen(false);
      setPreviewBlock(null);
    }
  }

  function renderAnalysisChecklist(block) {
    const mergedChecklistGroups = getMergedChecklistGroups(block);
    const checkedItems = Array.isArray(block.checklistItems)
      ? block.checklistItems
      : [];
    const availableCategories = getAvailableChecklistCategories(block);

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Analysis Checklist
          </summary>

          <div className="mt-4 space-y-5">
            {getChecklistForBlockType(block.blockType).length > 0 && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <p className="text-sm font-semibold text-cyan-300">
                  Displacement Type Rules
                </p>

                <div className="mt-3 space-y-2">
                  {DISPLACEMENT_RULES.map((rule) => (
                    <p key={rule.title} className="text-xs text-cyan-100">
                      <span className="font-semibold">{rule.title}:</span>{" "}
                      {rule.description}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {mergedChecklistGroups.map((group) => (
              <div key={group.groupTitle}>
                <p className="text-sm font-semibold text-white">
                  {group.groupTitle}
                </p>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {group.items.map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={checkedItems.includes(item)}
                        onChange={() =>
                          handleToggleChecklistItem(block.id, item)
                        }
                      />
                      <span>{item}</span>
                    </label>
                  ))}

                  {group.customItems?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(item.checked)}
                          onChange={() =>
                            handleToggleCustomChecklistItem(block.id, item.id)
                          }
                        />
                        <span>{item.label}</span>
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteCustomChecklistItem(block.id, item.id)
                        }
                        className="text-sm font-semibold text-red-400 hover:text-red-300"
                        title="Remove custom checklist item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-sm font-semibold text-white">
                Add Custom Checklist Item
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Existing Category
                  </label>

                  <select
                    value={customChecklistCategoryByBlock[block.id] || ""}
                    onChange={(event) =>
                      handleCustomChecklistCategoryChange(
                        block.id,
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  >
                    <option value="">Select category</option>
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    New Category
                  </label>

                  <input
                    type="text"
                    placeholder="Example: My Entry Rules"
                    value={customChecklistNewCategoryByBlock[block.id] || ""}
                    onChange={(event) =>
                      handleCustomChecklistNewCategoryChange(
                        block.id,
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Checkbox Label
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add checkbox..."
                      value={customChecklistTextByBlock[block.id] || ""}
                      onChange={(event) =>
                        handleCustomChecklistTextChange(
                          block.id,
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                    />

                    <button
                      type="button"
                      onClick={() => handleAddCustomChecklistItem(block.id)}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Select an existing checklist category to add a custom item under
                it, or create a new category that continues the checklist
                numbering.
              </p>
            </div>
          </div>
        </details>
      </div>
    );
  }

  function renderAnalysisTextEditor(block) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Analysis Text
          </summary>

          <div className="mt-4">
            <RichTextAnalysisEditor
              value={block.analysisHtml || ""}
              onChange={(nextHtml) =>
                handleBlockChange(block.id, "analysisHtml", nextHtml)
              }
              isEditable={true}
              minHeightClass="min-h-[180px]"
              borderClass="border-slate-700"
              backgroundClass="bg-slate-950"
            />

            <p className="mt-2 text-xs text-slate-500">
              You can type here and use the toolbar above to format your
              analysis.
            </p>
          </div>
        </details>
      </div>
    );
  }

  function renderChecklistPreview(block) {
    const allPreviewItems = getChecklistLabelsForPreview(block);

    if (allPreviewItems.length === 0) {
      return (
        <p className="mt-2 text-sm text-slate-400">
          No checklist items selected yet
        </p>
      );
    }

    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {allPreviewItems.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"
          >
            ✓ {item.label}
          </div>
        ))}
      </div>
    );
  }

  function renderPreviewBlockCard(block, index) {
    return (
      <div
        key={block.id}
        className="rounded-xl border border-slate-800 bg-slate-950/80 p-5"
      >
        <h3 className="text-xl font-bold text-white">
          {block.sectionName?.trim()
            ? block.sectionName
            : `Analysis Workspace ${index + 1}`}
        </h3>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-300">
            Chart Preview
          </p>

          {block.chartImage ? (
            <button
              type="button"
              onClick={() => handleOpenFullscreenChart(block)}
              className="block w-full cursor-pointer overflow-hidden rounded-lg border border-slate-800 text-left"
              title="Open fullscreen chart"
            >
              <img
                src={block.chartImage}
                alt={`Saved chart preview ${index + 1}`}
                className="h-[420px] w-full object-contain transition hover:scale-[1.01]"
              />
            </button>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
              No chart image selected yet
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-medium uppercase text-slate-500">
              Section Name
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {block.sectionName || "No section name yet"}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-medium uppercase text-slate-500">
              Time Frame
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {block.timeFrame || "No time frame yet"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium uppercase text-slate-500">
            Analysis Checklist
          </p>

          {renderChecklistPreview(block)}
        </div>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium uppercase text-slate-500">
            Analysis Text
          </p>

          {block.analysisHtml ? (
            <div
              className="mt-2 overflow-x-auto text-sm text-slate-300"
              dangerouslySetInnerHTML={{
                __html: block.analysisHtml,
              }}
            />
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              No analysis text yet
            </p>
          )}
        </div>
      </div>
    );
  }

  function renderBlockActionButtons(block) {
    return (
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => handleAddAnalysisBlock(block.id)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
        >
          Add Analysis Block
        </button>

        <button
          type="button"
          onClick={handleUpdateWorkspace}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
        >
          Update Workspace
        </button>

        <button
          type="button"
          onClick={() => handleOpenBlockPreview(block)}
          className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20"
        >
          Preview Block
        </button>
      </div>
    );
  }

  const previewBlocks = previewBlock ? [previewBlock] : analysisBlocks;

  const currentPreviewWorkspace = {
    workspaceTitle,
    instrument,
    entryDate,
    analysisBlocks: previewBlocks,
  };
   return (
    <div className="space-y-5">
      {isPageLoading ? (
        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-6 shadow-[0_0_35px_rgba(15,23,42,0.55)]">
          <h1 className="text-2xl font-bold text-white">Loading workspace...</h1>
          <p className="mt-2 text-sm text-slate-400">
            Please wait while your workspace data is being prepared.
          </p>
        </div>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/80 p-6 shadow-[0_0_35px_rgba(15,23,42,0.55)]">
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="relative">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="mb-5 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
                >
                  ← Back to Workspaces
                </button>
              ) : null}

              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-400">
                EdgeVault Trade Workspace
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
                {isJournalEdit ? "Edit Journal Entry" : "Workspace Editor"}
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
                Build one analysis workspace here by adding and organizing your
                analysis blocks.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-6 shadow-[0_0_35px_rgba(15,23,42,0.55)]">
            <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-xl font-bold text-white">
                {workspaceTitle?.trim()
                  ? workspaceTitle
                  : "New Entry Workspace"}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {currentUser
                  ? `Signed in as ${currentUser.email}`
                  : "You are currently using guest mode."}
              </p>

              <p className="mt-2 text-sm font-medium text-slate-300">
                Workspace Type:{" "}
                <span className="text-emerald-400">
                  {workspaceType === "strategy"
                    ? "Strategy Workspace"
                    : "General Workspace"}
                </span>
              </p>
            </div>

            <div className="mb-8 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-300">
                Save flow note
              </h3>

              <p className="mt-2 text-sm text-cyan-100">
                <span className="font-semibold">Update Workspace</span>{" "}
                refreshes this workspace and its preview.
              </p>

              <p className="mt-1 text-sm text-cyan-100">
                <span className="font-semibold">Save to Journal Library</span>{" "}
                saves or updates the final journal entry version.
              </p>

              <p className="mt-1 text-sm text-cyan-100">
                {currentUser
                  ? "Logged-in users now save workspace and journal data into Supabase."
                  : "Guest users still save locally on this device only."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Workspace Title
                </label>

                <input
                  type="text"
                  placeholder="Example: Gold"
                  value={workspaceTitle}
                  onChange={(event) => setWorkspaceTitle(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Pair / Instrument
                </label>

                <input
                  type="text"
                  placeholder="Example: XAUUSD"
                  value={instrument}
                  onChange={(event) => setInstrument(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Date
                </label>

                <input
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSaveToJournalLibrary}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400"
              >
                Save to Journal Library
              </button>

              <button
                type="button"
                onClick={handleOpenPreview}
                className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                Preview Workspace
              </button>
            </div>

            <div className="mt-8">
              {analysisBlocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
                  <h2 className="text-xl font-bold text-white">
                    No Analysis Workspaces Yet
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Click “Add Analysis Block” below to create one.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {analysisBlocks.map((block, index) => (
                    <div
                      key={block.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-bold text-white">
                            {block.sectionName?.trim()
                              ? block.sectionName
                              : `Analysis Workspace ${index + 1}`}
                          </h2>

                          <p className="mt-2 text-sm text-slate-400">
                            Add a section type, timeframe, image, analysis
                            checklist, and your written analysis.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAskDeleteBlock(block.id)}
                          className="cursor-pointer text-slate-500 transition hover:scale-110 hover:text-red-400"
                          title="Delete this analysis block"
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

                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Section Name
                          </label>

                          <input
                            type="text"
                            placeholder="Example: High Time Frame"
                            value={block.sectionName}
                            onChange={(event) =>
                              handleBlockChange(
                                block.id,
                                "sectionName",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Time Frame
                          </label>

                          <input
                            type="text"
                            placeholder="Example: Monthly"
                            value={block.timeFrame}
                            onChange={(event) =>
                              handleBlockChange(
                                block.id,
                                "timeFrame",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Chart Image
                          </label>

                          <input
                            id={`file-upload-${block.id}`}
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              handleImageChange(block.id, event)
                            }
                            className="hidden"
                          />

                          <label
                            htmlFor={`file-upload-${block.id}`}
                            className="inline-flex cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 hover:text-white"
                          >
                            {block.isUploadingImage
                              ? "Uploading..."
                              : "Choose Image"}
                          </label>

                          {block.chartFileName ? (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <p className="text-sm text-slate-400">
                                Selected file:{" "}
                                <span className="font-medium text-white">
                                  {block.chartFileName}
                                </span>
                              </p>

                              <button
                                type="button"
                                onClick={() => handleAskDeleteImage(block.id)}
                                className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                              >
                                Remove Image
                              </button>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">
                              No image selected yet
                            </p>
                          )}

                          <p className="mt-2 text-xs text-slate-500">
                            {currentUser
                              ? "Logged-in image uploads are saved to Supabase Storage."
                              : "Guest image uploads stay on this device only for now."}
                          </p>
                        </div>

                        {renderAnalysisChecklist(block)}

                        {renderAnalysisTextEditor(block)}
                      </div>

                      {renderBlockActionButtons(block)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {limitMessage ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                {limitMessage}
              </p>
            ) : null}

            {saveMessage ? (
              <p
                className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                  isSaveError
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {saveMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleAddAnalysisBlock()}
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Add Analysis Block
              </button>

              <button
                type="button"
                onClick={handleUpdateWorkspace}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                Update Workspace
              </button>

              <button
                type="button"
                onClick={handleSaveToJournalLibrary}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400"
              >
                Save to Journal Library
              </button>

              <button
                type="button"
                onClick={handleOpenPreview}
                className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                Preview Workspace
              </button>
            </div>
          </section>
        </>
      )}

      {isPreviewOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {previewBlock ? "Analysis Block Preview" : "Workspace Preview"}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {previewBlock
                    ? "Viewing a single analysis block."
                    : "Review the current workspace and click any image to open the fullscreen chart view."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClosePreview}
                title="Close"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1 text-lg font-semibold text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Workspace Title
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {currentPreviewWorkspace.workspaceTitle || "No title yet"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Pair / Instrument
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {currentPreviewWorkspace.instrument || "No instrument yet"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Date
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {currentPreviewWorkspace.entryDate || "No date yet"}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-8">
                {currentPreviewWorkspace.analysisBlocks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
                    <h3 className="text-xl font-bold text-white">
                      No Saved Analysis Blocks
                    </h3>

                    <p className="mt-2 text-sm text-slate-400">
                      Add a new analysis block if you want to preview one here.
                    </p>
                  </div>
                ) : (
                  currentPreviewWorkspace.analysisBlocks.map((block, index) =>
                    renderPreviewBlockCard(block, index)
                  )
                )}
              </div>
            </div>

            <div className="border-t border-slate-800 px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleUpdateWorkspace}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
                >
                  Update Workspace
                </button>

                <button
                  type="button"
                  onClick={handleSaveToJournalFromPreview}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:bg-emerald-400"
                >
                  Save to Journal Library
                </button>

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <FullscreenChartViewer
        isOpen={Boolean(fullscreenBlock)}
        onClose={handleCloseFullscreenChart}
        image={fullscreenBlock?.chartImage || ""}
        sectionName={fullscreenBlock?.sectionName || ""}
        timeFrame={fullscreenBlock?.timeFrame || ""}
        analysisHtml={fullscreenBlock?.analysisHtml || ""}
        onUpdateAnalysis={handleUpdateAnalysisFromViewer}
        checklistGroups={getMergedChecklistGroups(fullscreenBlock)}
        checklistItems={fullscreenBlock?.checklistItems || []}
        customChecklistItems={fullscreenBlock?.customChecklistItems || []}
        customChecklistText={
          customChecklistTextByBlock[fullscreenBlock?.id] || ""
        }
        customChecklistCategory={
          customChecklistCategoryByBlock[fullscreenBlock?.id] || ""
        }
        customChecklistNewCategory={
          customChecklistNewCategoryByBlock[fullscreenBlock?.id] || ""
        }
        onToggleChecklistItem={(itemLabel) =>
          fullscreenBlock &&
          handleToggleChecklistItem(fullscreenBlock.id, itemLabel)
        }
        onToggleCustomChecklistItem={(itemId) =>
          fullscreenBlock &&
          handleToggleCustomChecklistItem(fullscreenBlock.id, itemId)
        }
        onCustomChecklistTextChange={(value) =>
          fullscreenBlock &&
          handleCustomChecklistTextChange(fullscreenBlock.id, value)
        }
        onCustomChecklistCategoryChange={(value) =>
          fullscreenBlock &&
          handleCustomChecklistCategoryChange(fullscreenBlock.id, value)
        }
        onCustomChecklistNewCategoryChange={(value) =>
          fullscreenBlock &&
          handleCustomChecklistNewCategoryChange(fullscreenBlock.id, value)
        }
        onAddCustomChecklistItem={() =>
          fullscreenBlock && handleAddCustomChecklistItem(fullscreenBlock.id)
        }
        onDeleteCustomChecklistItem={(itemId) =>
          fullscreenBlock &&
          handleDeleteCustomChecklistItem(fullscreenBlock.id, itemId)
        }
        onSaveChecklist={handleUpdateChecklistFromViewer}
      />

      {blockToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white">
              Delete Analysis Block
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              Are you sure you want to delete this analysis block?
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCancelDeleteBlock}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteBlock}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imageToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white">Remove Image</h3>

            <p className="mt-3 text-sm text-slate-400">
              Are you sure you want to remove this image from this analysis
              block?
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCancelDeleteImage}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteImage}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

