"use client";

// This imports React tools for local editor state and selection tracking
import { useEffect, useRef, useState } from "react";

// This returns the visual classes for active and inactive toolbar buttons
function getToolbarButtonClass(isActive, extraClass = "") {
  return `cursor-pointer rounded border px-3 py-1 text-sm transition ${
    isActive
      ? "border-black bg-black text-white"
      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
  } ${extraClass}`;
}

// This creates a unique id used for caret placement after inserting html
function createCaretId() {
  return `caret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// This creates the reusable rich text editor used across the app
export default function RichTextAnalysisEditor({
  // This is the current html value from the parent
  value,

  // This updates the parent whenever the editor content changes
  onChange,

  // This controls whether editing is enabled
  isEditable = true,

  // This controls the minimum editor height
  minHeightClass = "min-h-[180px]",

  // This controls the maximum editor height
  maxHeightClass = "",

  // This optionally changes the border styling
  borderClass = "border-gray-300",

  // This optionally changes the background styling
  backgroundClass = "bg-white",
}) {
  // This stores a ref to the contentEditable editor
  const editorRef = useRef(null);

  // This stores the latest valid selection range inside the editor
  const savedSelectionRangeRef = useRef(null);

  // This stores which toolbar buttons are visually active
  const [toolbarState, setToolbarState] = useState({
    bold: false,
    italic: false,
  });

  // This stores the table dialog state
  const [tableDialogState, setTableDialogState] = useState({
    isOpen: false,
    rows: "2",
    columns: "2",
  });

  // This keeps the DOM content in sync when the parent value changes
  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    if (editor.innerHTML !== (value || "")) {
      editor.innerHTML = value || "";
    }
  }, [value]);

  // This listens for selection changes so active toolbar states update correctly
  useEffect(() => {
    function handleSelectionChange() {
      const editor = editorRef.current;

      if (!editor) {
        return;
      }

      const selection = window.getSelection();

      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      const commonNode = range.commonAncestorContainer;

      const isInsideEditor =
        editor === commonNode || editor.contains(commonNode);

      if (!isInsideEditor) {
        return;
      }

      savedSelectionRangeRef.current = range.cloneRange();
      refreshToolbarState();
    }

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  // This refreshes the active toolbar states from the browser selection
  function refreshToolbarState() {
    setToolbarState({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
    });
  }

  // This saves the current selection if it is inside this editor
  function saveCurrentSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer;

    const isInsideEditor =
      editor === commonNode || editor.contains(commonNode);

    if (!isInsideEditor) {
      return;
    }

    savedSelectionRangeRef.current = range.cloneRange();
  }

  // This moves the caret inside a target element at the beginning
  function placeCaretInsideElement(element) {
    if (!element) {
      return;
    }

    const selection = window.getSelection();

    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    savedSelectionRangeRef.current = range.cloneRange();
  }

  // This moves the caret to the end of the editor if no valid selection exists
  function moveCaretToEndOfEditor() {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.focus();

    const selection = window.getSelection();

    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);

    savedSelectionRangeRef.current = range.cloneRange();
  }

  // This restores the most recent valid selection inside the editor
  function restoreSavedSelection() {
    const editor = editorRef.current;
    const savedRange = savedSelectionRangeRef.current;

    if (!editor) {
      return false;
    }

    editor.focus();

    const selection = window.getSelection();

    if (!selection) {
      return false;
    }

    if (savedRange) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
      return true;
    }

    moveCaretToEndOfEditor();
    return true;
  }

  // This sends the current html back to the parent
  function emitHtmlToParent() {
    const editor = editorRef.current;

    if (!editor || !onChange) {
      return;
    }

    onChange(editor.innerHTML);
  }

  // This inserts raw html at the saved caret and optionally places the caret into a target node
  function insertHtmlAtCaret(html, caretId = null) {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    restoreSavedSelection();

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      moveCaretToEndOfEditor();
    }

    const liveSelection = window.getSelection();

    if (!liveSelection || liveSelection.rangeCount === 0) {
      return;
    }

    const range = liveSelection.getRangeAt(0);
    range.deleteContents();

    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = html;

    const fragment = document.createDocumentFragment();
    let lastNode = null;

    while (tempContainer.firstChild) {
      lastNode = fragment.appendChild(tempContainer.firstChild);
    }

    range.insertNode(fragment);

    if (caretId) {
      const target = editor.querySelector(`[data-caret-id="${caretId}"]`);

      if (target) {
        target.removeAttribute("data-caret-id");
        placeCaretInsideElement(target);
      }
    } else if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);

      liveSelection.removeAllRanges();
      liveSelection.addRange(nextRange);
      savedSelectionRangeRef.current = nextRange.cloneRange();
    }

    emitHtmlToParent();
    refreshToolbarState();
  }

  // This runs a browser command without losing focus
  function runCommand(command) {
    if (!isEditable) {
      return;
    }

    restoreSavedSelection();
    document.execCommand(command, false, null);
    emitHtmlToParent();
    saveCurrentSelection();
    refreshToolbarState();
  }

  // This inserts a bullet list item at the cursor
  function insertBulletList() {
    if (!isEditable) {
      return;
    }

    const selectedText = window.getSelection()?.toString().trim() || "";
    const caretId = createCaretId();

    const listHtml = selectedText
      ? `<ul style="list-style-type: disc; padding-left: 24px; margin: 8px 0;"><li data-caret-id="${caretId}">${selectedText}</li></ul><div><br></div>`
      : `<ul style="list-style-type: disc; padding-left: 24px; margin: 8px 0;"><li data-caret-id="${caretId}"><br></li></ul><div><br></div>`;

    insertHtmlAtCaret(listHtml, caretId);
  }

  // This inserts a numbered list item at the cursor
  function insertNumberList() {
    if (!isEditable) {
      return;
    }

    const selectedText = window.getSelection()?.toString().trim() || "";
    const caretId = createCaretId();

    const listHtml = selectedText
      ? `<ol style="list-style-type: decimal; padding-left: 24px; margin: 8px 0;"><li data-caret-id="${caretId}">${selectedText}</li></ol><div><br></div>`
      : `<ol style="list-style-type: decimal; padding-left: 24px; margin: 8px 0;"><li data-caret-id="${caretId}"><br></li></ol><div><br></div>`;

    insertHtmlAtCaret(listHtml, caretId);
  }

  // This inserts only a checkbox at the cursor location
  function insertCheckbox() {
    if (!isEditable) {
      return;
    }

    insertHtmlAtCaret(`<input type="checkbox" />&nbsp;`);
  }

  // This opens the table dialog after preserving the current range
  function openTableDialog() {
    if (!isEditable) {
      return;
    }

    saveCurrentSelection();

    setTableDialogState({
      isOpen: true,
      rows: "2",
      columns: "2",
    });
  }

  // This closes the table dialog
  function closeTableDialog() {
    setTableDialogState({
      isOpen: false,
      rows: "2",
      columns: "2",
    });
  }

  // This inserts a table using the chosen row/column counts
  function confirmInsertTable() {
    const rowCount = Math.max(1, Number(tableDialogState.rows) || 1);
    const columnCount = Math.max(1, Number(tableDialogState.columns) || 1);
    const caretId = createCaretId();

    let tableHtml =
      '<table style="border-collapse: collapse; width: 100%; margin: 8px 0;">';

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      tableHtml += "<tr>";

      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        if (rowIndex === 0 && columnIndex === 0) {
          tableHtml += `<td data-caret-id="${caretId}" style="border: 1px solid #9ca3af; padding: 8px; min-width: 80px;"><br></td>`;
        } else {
          tableHtml += `<td style="border: 1px solid #9ca3af; padding: 8px; min-width: 80px;"><br></td>`;
        }
      }

      tableHtml += "</tr>";
    }

    tableHtml += "</table><div><br></div>";

    insertHtmlAtCaret(tableHtml, caretId);
    closeTableDialog();
  }

  // This handles typing and pushes html back up
  function handleInput() {
    emitHtmlToParent();
    saveCurrentSelection();
    refreshToolbarState();
  }

  // This handles Enter so normal text creates a clean next line
  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;
      const parentElement =
        anchorNode?.nodeType === 3 ? anchorNode.parentElement : anchorNode;

      const isInsideList = parentElement?.closest("li");
      const isInsideTable = parentElement?.closest("td, th");

      if (!isInsideList && !isInsideTable) {
        event.preventDefault();
        insertHtmlAtCaret("<div><br></div>");
      }
    }
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-gray-300 bg-gray-50 p-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("bold")}
          className={getToolbarButtonClass(toolbarState.bold, "font-medium")}
        >
          B
        </button>

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("italic")}
          className={getToolbarButtonClass(toolbarState.italic, "italic")}
        >
          I
        </button>

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertBulletList}
          className={getToolbarButtonClass(false)}
        >
          Bullets
        </button>

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertNumberList}
          className={getToolbarButtonClass(false)}
        >
          Numbers
        </button>

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertCheckbox}
          className={getToolbarButtonClass(false)}
        >
          Checkbox
        </button>

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openTableDialog}
          className={getToolbarButtonClass(false)}
        >
          Table
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={isEditable}
        suppressContentEditableWarning={true}
        dir="ltr"
        onFocus={() => {
          saveCurrentSelection();
          refreshToolbarState();
        }}
        onMouseUp={saveCurrentSelection}
        onKeyUp={saveCurrentSelection}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={`${minHeightClass} ${maxHeightClass} overflow-y-auto whitespace-pre-wrap rounded-lg border ${borderClass} ${backgroundClass} px-4 py-3 text-left text-sm text-gray-800 outline-none focus:border-black`}
        style={{ direction: "ltr", textAlign: "left", unicodeBidi: "plaintext" }}
      />

      {tableDialogState.isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900">Insert Table</h3>

            <p className="mt-2 text-sm text-gray-700">
              Choose how many rows and columns you want.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Rows
                </label>

                <input
                  type="number"
                  min="1"
                  value={tableDialogState.rows}
                  onChange={(event) =>
                    setTableDialogState((previousState) => ({
                      ...previousState,
                      rows: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Columns
                </label>

                <input
                  type="number"
                  min="1"
                  value={tableDialogState.columns}
                  onChange={(event) =>
                    setTableDialogState((previousState) => ({
                      ...previousState,
                      columns: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeTableDialog}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={confirmInsertTable}
                className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Insert Table
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
