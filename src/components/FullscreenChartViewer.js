"use client";

// This imports React tools for local popup state, dragging, and resizing
import { useEffect, useRef, useState } from "react";

// This imports the shared rich text editor component
import RichTextAnalysisEditor from "./RichTextAnalysisEditor";

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

// This gets the merged checklist groups so custom categories behave like normal categories
function getMergedChecklistGroups(checklistGroups, customChecklistItems) {
  const normalizedCustomChecklistItems =
    normalizeCustomChecklistItems(customChecklistItems);

  const mergedGroups = checklistGroups.map((group) => {
    const matchedCustomCategory = normalizedCustomChecklistItems.find(
      (category) => category.category === group.groupTitle
    );

    return {
      ...group,
      items: Array.isArray(group.items) ? group.items : [],
      customItems:
        group.customItems || matchedCustomCategory?.items || [],
    };
  });

  const customOnlyCategories = normalizedCustomChecklistItems.filter(
    (category) =>
      !mergedGroups.some((group) => group.groupTitle === category.category)
  );

  const customGroups = customOnlyCategories.map((category) => ({
    groupTitle: category.category,
    items: [],
    customItems: Array.isArray(category.items) ? category.items : [],
    isCustomCategory: true,
  }));

  return [...mergedGroups, ...customGroups];
}

// This creates the reusable fullscreen chart viewer
export default function FullscreenChartViewer({
  isOpen,
  onClose,
  image,
  sectionName,
  timeFrame,
  analysisHtml,
  onUpdateAnalysis,
  checklistGroups = [],
  checklistItems = [],
  customChecklistItems = [],
  customChecklistText = "",
  customChecklistCategory = "",
  customChecklistNewCategory = "",
  onToggleChecklistItem,
  onToggleCustomChecklistItem,
  onCustomChecklistTextChange,
  onCustomChecklistCategoryChange,
  onCustomChecklistNewCategoryChange,
  onAddCustomChecklistItem,
  onDeleteCustomChecklistItem,
  onSaveChecklist,
}) {
  const [localAnalysisHtml, setLocalAnalysisHtml] = useState(analysisHtml || "");
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [activeTool, setActiveTool] = useState("analysis");
  const [isEditing, setIsEditing] = useState(false);
  const [isChecklistEditing, setIsChecklistEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [panelPosition, setPanelPosition] = useState({
    x: 0,
    y: 0,
  });

  const [panelSize, setPanelSize] = useState({
    width: 420,
    height: 420,
  });

  const [hasInitializedPosition, setHasInitializedPosition] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeDirection, setResizeDirection] = useState("");

  const dragOffsetRef = useRef({
    x: 0,
    y: 0,
  });

  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    startWidth: 420,
    startHeight: 420,
    startX: 0,
    startY: 0,
  });

  const normalizedCustomChecklistItems =
    normalizeCustomChecklistItems(customChecklistItems);

  const mergedChecklistGroups = getMergedChecklistGroups(
    checklistGroups,
    customChecklistItems
  );

  useEffect(() => {
    setLocalAnalysisHtml(analysisHtml || "");
    setIsEditing(false);
  }, [analysisHtml, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setHasInitializedPosition(false);
      setIsNotebookOpen(false);
      return;
    }

    if (hasInitializedPosition) {
      return;
    }

    const defaultWidth = 420;
    const defaultHeight = 420;

    setPanelSize({
      width: defaultWidth,
      height: defaultHeight,
    });

    setPanelPosition({
      x: Math.max(12, window.innerWidth - defaultWidth - 24),
      y: Math.max(12, window.innerHeight - defaultHeight - 24),
    });

    setHasInitializedPosition(true);
  }, [isOpen, hasInitializedPosition]);

  useEffect(() => {
    if (!isDragging && !resizeDirection) {
      return;
    }

    function handleMouseMove(event) {
      if (isDragging) {
        const nextX = event.clientX - dragOffsetRef.current.x;
        const nextY = event.clientY - dragOffsetRef.current.y;

        const clampedX = Math.min(
          Math.max(12, nextX),
          Math.max(12, window.innerWidth - panelSize.width - 12)
        );

        const clampedY = Math.min(
          Math.max(12, nextY),
          Math.max(
            12,
            window.innerHeight -
              (isPanelMinimized ? 54 : panelSize.height) -
              12
          )
        );

        setPanelPosition({
          x: clampedX,
          y: clampedY,
        });
      }

      if (resizeDirection) {
        const minWidth = 300;
        const minHeight = 180;
        const maxWidth = window.innerWidth - 24;
        const maxHeight = window.innerHeight - 24;

        let nextWidth = resizeStartRef.current.startWidth;
        let nextHeight = resizeStartRef.current.startHeight;
        let nextX = resizeStartRef.current.startX;
        let nextY = resizeStartRef.current.startY;

        const deltaX = event.clientX - resizeStartRef.current.mouseX;
        const deltaY = event.clientY - resizeStartRef.current.mouseY;

        if (resizeDirection.includes("right")) {
          nextWidth = resizeStartRef.current.startWidth + deltaX;
        }

        if (resizeDirection.includes("bottom")) {
          nextHeight = resizeStartRef.current.startHeight + deltaY;
        }

        if (resizeDirection.includes("left")) {
          nextWidth = resizeStartRef.current.startWidth - deltaX;
          nextX = resizeStartRef.current.startX + deltaX;
        }

        if (resizeDirection.includes("top")) {
          nextHeight = resizeStartRef.current.startHeight - deltaY;
          nextY = resizeStartRef.current.startY + deltaY;
        }

        nextWidth = Math.max(minWidth, Math.min(maxWidth, nextWidth));
        nextHeight = Math.max(minHeight, Math.min(maxHeight, nextHeight));
        nextX = Math.max(12, Math.min(window.innerWidth - nextWidth - 12, nextX));
        nextY = Math.max(
          12,
          Math.min(window.innerHeight - nextHeight - 12, nextY)
        );

        setPanelSize({
          width: nextWidth,
          height: nextHeight,
        });

        setPanelPosition({
          x: nextX,
          y: nextY,
        });
      }
    }

    function handleMouseUp() {
      setIsDragging(false);
      setResizeDirection("");
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    resizeDirection,
    panelSize.width,
    panelSize.height,
    isPanelMinimized,
  ]);

  async function handleSaveNotes() {
    if (!onUpdateAnalysis) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onUpdateAnalysis(localAnalysisHtml);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveChecklist() {
    if (!onSaveChecklist) {
      setIsChecklistEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onSaveChecklist();
      setIsChecklistEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleStartDrag(event) {
    if (
      event.target.closest("button") ||
      event.target.closest("input") ||
      event.target.closest("select")
    ) {
      return;
    }

    const panelElement = event.currentTarget.parentElement;

    if (!panelElement) {
      return;
    }

    const rect = panelElement.getBoundingClientRect();

    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    setIsDragging(true);
  }

  function handleTogglePanel() {
    setIsPanelMinimized((previousValue) => !previousValue);
  }

  function handleToggleNotebook() {
    setIsNotebookOpen((previousValue) => !previousValue);
    setIsPanelMinimized(false);
  }

  function startResize(direction, event) {
    event.preventDefault();
    event.stopPropagation();

    resizeStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      startWidth: panelSize.width,
      startHeight: panelSize.height,
      startX: panelPosition.x,
      startY: panelPosition.y,
    };

    setResizeDirection(direction);
  }

  if (!isOpen || !image) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/90">
      <button
        type="button"
        onClick={onClose}
        title="Close"
        className="absolute right-4 top-4 z-[320] cursor-pointer rounded-md border border-white/30 bg-black/40 px-3 py-1 text-xl font-semibold text-white transition hover:bg-white/10"
      >
        ✕
      </button>

      <div className="flex h-full w-full items-center justify-center p-4 md:p-8">
        <img
          src={image}
          alt="Fullscreen chart view"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="absolute left-4 top-4 z-[315] max-w-xs rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
        <p className="text-sm font-semibold">
          {sectionName?.trim() ? sectionName : "Untitled Section"}
        </p>

        <p className="mt-1 text-xs text-white/80">
          {timeFrame?.trim() ? timeFrame : "No Time Frame"}
        </p>

        <button
          type="button"
          onClick={handleToggleNotebook}
          className="mt-3 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
        >
          📒 Notes
        </button>
      </div>

      {isNotebookOpen && (
        <div
          className="absolute z-[315] overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"
          style={{
            left: `${panelPosition.x}px`,
            top: `${panelPosition.y}px`,
            width: `${panelSize.width}px`,
            height: isPanelMinimized ? "54px" : `${panelSize.height}px`,
          }}
        >
          <div
            onMouseDown={handleStartDrag}
            className="flex cursor-move select-none items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2"
            title="Drag notebook panel"
          >
            <div className="text-sm font-semibold text-gray-900">
              Notebook Tools
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTool("analysis")}
                className={`cursor-pointer rounded-md border px-2 py-1 text-xs ${
                  activeTool === "analysis"
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-gray-800"
                }`}
              >
                Text
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("checklist")}
                className={`cursor-pointer rounded-md border px-2 py-1 text-xs ${
                  activeTool === "checklist"
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-gray-800"
                }`}
              >
                Checklist
              </button>

              <button
                type="button"
                onClick={handleTogglePanel}
                title={isPanelMinimized ? "Restore" : "Minimize"}
                className="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-50"
              >
                {isPanelMinimized ? "▢" : "─"}
              </button>

              {activeTool === "analysis" && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Edit"
                  className="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-50"
                >
                  ✎
                </button>
              )}

              {activeTool === "checklist" && (
                <button
                  type="button"
                  onClick={() => setIsChecklistEditing(true)}
                  title="Edit Checklist"
                  className="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-50"
                >
                  ✎
                </button>
              )}

              <button
                type="button"
                onClick={
                  activeTool === "analysis"
                    ? handleSaveNotes
                    : handleSaveChecklist
                }
                title="Save"
                disabled={isSaving}
                className="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                💾
              </button>
            </div>
          </div>

          {!isPanelMinimized && (
            <div className="h-[calc(100%-45px)] overflow-y-auto bg-white p-3">
              {activeTool === "analysis" && (
                <RichTextAnalysisEditor
                  value={localAnalysisHtml}
                  onChange={setLocalAnalysisHtml}
                  isEditable={isEditing}
                  minHeightClass="min-h-full"
                  maxHeightClass="max-h-full"
                  borderClass={isEditing ? "border-black" : "border-gray-200"}
                  backgroundClass={isEditing ? "bg-white" : "bg-gray-50"}
                />
              )}

              {activeTool === "checklist" && (
                <div className="space-y-5">
                  {mergedChecklistGroups.length === 0 ? (
                    <p className="text-sm text-gray-700">
                      No checklist available for this block.
                    </p>
                  ) : (
                    mergedChecklistGroups.map((group, groupIndex) => (
                      <details key={`${group.groupTitle}-${groupIndex}`} open>
                        <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                          {group.groupTitle}
                        </summary>

                        <div className="mt-2 grid gap-2">
                          {Array.isArray(group.items) &&
                            group.items.map((item) => (
                              <label
                                key={item}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                              >
                                <input
                                  type="checkbox"
                                  disabled={!isChecklistEditing}
                                  checked={checklistItems.includes(item)}
                                  onChange={() =>
                                    onToggleChecklistItem &&
                                    onToggleChecklistItem(item)
                                  }
                                />
                                <span>{item}</span>
                              </label>
                            ))}

                          {Array.isArray(group.customItems) &&
                            group.customItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                              >
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                                  <input
                                    type="checkbox"
                                    disabled={!isChecklistEditing}
                                    checked={Boolean(item.checked)}
                                    onChange={() =>
                                      onToggleCustomChecklistItem &&
                                      onToggleCustomChecklistItem(item.id)
                                    }
                                  />
                                  <span>{item.label}</span>
                                </label>

                                {isChecklistEditing && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDeleteCustomChecklistItem &&
                                      onDeleteCustomChecklistItem(item.id)
                                    }
                                    className="text-sm font-semibold text-red-600 hover:text-red-800"
                                    title="Remove custom checklist item"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      </details>
                    ))
                  )}

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-900">
                      Add Custom Checklist Item
                    </p>

                    {isChecklistEditing && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-700">
                            Existing Category
                          </label>

                          <select
                            value={customChecklistCategory}
                            onChange={(event) =>
                              onCustomChecklistCategoryChange &&
                              onCustomChecklistCategoryChange(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                          >
                            <option value="">Create New Category</option>
                            {mergedChecklistGroups.map((group, groupIndex) => (
                              <option
                                key={`${group.groupTitle}-${groupIndex}`}
                                value={group.groupTitle}
                              >
                                {group.groupTitle}
                              </option>
                            ))}
                          </select>
                        </div>

                        {!customChecklistCategory && (
                          <div>
                            <label className="mb-2 block text-xs font-medium text-gray-700">
                              New Category
                            </label>

                            <input
                              type="text"
                              placeholder="Create new category..."
                              value={customChecklistNewCategory}
                              onChange={(event) =>
                                onCustomChecklistNewCategoryChange &&
                                onCustomChecklistNewCategoryChange(
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                            />
                          </div>
                        )}

                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-700">
                            Checkbox Label
                          </label>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Add custom checkbox..."
                              value={customChecklistText}
                              onChange={(event) =>
                                onCustomChecklistTextChange &&
                                onCustomChecklistTextChange(event.target.value)
                              }
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                onAddCustomChecklistItem &&
                                onAddCustomChecklistItem()
                              }
                              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isChecklistEditing && (
                      <p className="mt-2 text-xs text-gray-600">
                        Click the edit button to add custom checklist items.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isPanelMinimized && (
            <>
              <div
                onMouseDown={(event) => startResize("right", event)}
                className="absolute right-0 top-2 h-[calc(100%-16px)] w-2 cursor-ew-resize"
                title="Resize width"
              />

              <div
                onMouseDown={(event) => startResize("bottom", event)}
                className="absolute bottom-0 left-2 h-2 w-[calc(100%-16px)] cursor-ns-resize"
                title="Resize height"
              />

              <div
                onMouseDown={(event) => startResize("left", event)}
                className="absolute left-0 top-2 h-[calc(100%-16px)] w-2 cursor-ew-resize"
                title="Resize width"
              />

              <div
                onMouseDown={(event) => startResize("top", event)}
                className="absolute left-2 top-0 h-2 w-[calc(100%-16px)] cursor-ns-resize"
                title="Resize height"
              />

              <div
                onMouseDown={(event) => startResize("bottom-right", event)}
                className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
                title="Resize panel"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
