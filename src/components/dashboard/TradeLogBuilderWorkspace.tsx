// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  supabase,
  saveTradeLogTemplateToSupabase,
  getSingleTradeLogTemplate,
  getUserTradeLogTemplates,
} from "@/lib/supabase";

type TradeLogBuilderWorkspaceProps = {
  editLogIdFromDashboard?: string;
  onBack?: () => void;
  onSavedLog?: (logId: string) => void;
};

function Panel({ children, className = "" }) {
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

export default function TradeLogBuilderWorkspace({
  editLogIdFromDashboard = "",
  onBack,
  onSavedLog,
}: TradeLogBuilderWorkspaceProps) {
  const editLogId = editLogIdFromDashboard || "";

  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isCreatingLog, setIsCreatingLog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const requiredHeaders = useMemo(
    () => [
      {
        id: "required-sn",
        name: "S/N",
        group: "required",
        type: "auto_serial",
        locked: true,
        lockedPosition: true,
      },
      {
        id: "required-entry-date",
        name: "Ent Date",
        group: "required",
        type: "datetime",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-exit-date",
        name: "Ext Date",
        group: "required",
        type: "datetime",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-symbol",
        name: "Symbol",
        group: "required",
        type: "text",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-status",
        name: "Status",
        group: "required",
        type: "text",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-direction",
        name: "Direction",
        group: "required",
        type: "text",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-lot",
        name: "Lot",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-entry",
        name: "Entry",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-stop-loss",
        name: "Stop Loss",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-take-profit",
        name: "Take Profit",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-exit",
        name: "Exit",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-profit-loss-dollar",
        name: "P/L($)",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-profit-loss-percent",
        name: "P/L(%)",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
    ],
    []
  );

  const defaultManualHeaderOptions = useMemo(
    () => [
      {
        id: "manual-notes",
        name: "Notes",
        type: "text",
        isCustom: false,
      },
      {
        id: "manual-setup-type",
        name: "Setup Type",
        type: "text",
        isCustom: false,
      },
      {
        id: "manual-trade-comment",
        name: "Trade Comment",
        type: "text",
        isCustom: false,
      },
      {
        id: "manual-before-trade-screenshot",
        name: "Before Trade Screenshot",
        type: "image",
        isCustom: false,
      },
      {
        id: "manual-after-trade-screenshot",
        name: "After Trade Screenshot",
        type: "image",
        isCustom: false,
      },
      {
        id: "manual-entry-model",
        name: "Entry Model",
        type: "text",
        isCustom: false,
      },
      {
        id: "manual-exit-reason",
        name: "Exit Reason",
        type: "text",
        isCustom: false,
      },
    ],
    []
  );

  const [manualHeaderOptions, setManualHeaderOptions] = useState(
    defaultManualHeaderOptions
  );

  const automaticHeaderOptions = useMemo(
    () => [
      {
        id: "auto-entry-market-session",
        name: "Entry Market Session",
        type: "auto",
        formulaKey: "entry_market_session",
        description: "Auto-detects regular market session from Ent Date.",
      },
      {
        id: "auto-exit-market-session",
        name: "Exit Market Session",
        type: "auto",
        formulaKey: "exit_market_session",
        description: "Auto-detects regular market session from Ext Date.",
      },
      {
        id: "auto-entry-ict-session",
        name: "Entry ICT Session",
        type: "auto",
        formulaKey: "entry_ict_session",
        description: "Auto-detects ICT session from Ent Date.",
      },
      {
        id: "auto-exit-ict-session",
        name: "Exit ICT Session",
        type: "auto",
        formulaKey: "exit_ict_session",
        description: "Auto-detects ICT session from Ext Date.",
      },
      {
        id: "auto-trade-duration",
        name: "Trade Duration",
        type: "auto",
        formulaKey: "trade_duration",
        description: "Uses Ent Date and Ext Date.",
      },
      {
        id: "auto-sl-pips",
        name: "SL Pips",
        type: "auto",
        formulaKey: "sl_pips",
        description: "Entry to Stop Loss distance.",
      },
      {
        id: "auto-tp-pips",
        name: "TP Pips",
        type: "auto",
        formulaKey: "tp_pips",
        description: "Entry to Take Profit distance.",
      },
      {
        id: "auto-result-pips",
        name: "Result Pips",
        type: "auto",
        formulaKey: "result_pips",
        description: "Entry to Exit distance.",
      },
      {
        id: "auto-planned-rr",
        name: "Planned R:R",
        type: "auto",
        formulaKey: "planned_rr",
        description: "TP Pips divided by SL Pips.",
      },
      {
        id: "auto-actual-rr",
        name: "Actual R:R",
        type: "auto",
        formulaKey: "actual_rr",
        description: "Result Pips divided by SL Pips.",
      },
    ],
    []
  );

  const [logName, setLogName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [accountCurrency, setAccountCurrency] = useState("USD");
  const [selectedHeaders, setSelectedHeaders] = useState(requiredHeaders);
  const [customManualHeaderName, setCustomManualHeaderName] = useState("");

  const [customAutoHeaderName, setCustomAutoHeaderName] = useState("");
  const [customAutoSourceField, setCustomAutoSourceField] = useState("");
  const [customAutoDefaultValue, setCustomAutoDefaultValue] = useState("");
  const [editingCustomAutoHeaderId, setEditingCustomAutoHeaderId] =
    useState("");

  const fallbackTimezones = [
    "UTC",
    "Africa/Lagos",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Athens",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Dubai",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Kolkata",
    "Australia/Sydney",
  ];

  const availableRuleTimezones =
    typeof Intl !== "undefined" &&
    typeof Intl.supportedValuesOf === "function"
      ? ["UTC", ...Intl.supportedValuesOf("timeZone")]
      : fallbackTimezones;

  const [customAutoRules, setCustomAutoRules] = useState([
    {
      id: `rule-${Date.now()}`,
      ruleType: "time_range",
      ruleTimezone: "UTC",
      startTime: "",
      endTime: "",
      startDate: "",
      anchorTime: "",
      offsetDirection: "plus",
      offsetHours: "",
      offsetMinutes: "",
      offsetSeconds: "",
      outputValue: "",
    },
  ]);

  const [builderMessage, setBuilderMessage] = useState("");
  const [isBuilderError, setIsBuilderError] = useState(false);
  const [checkedManualHeaderIds, setCheckedManualHeaderIds] = useState([]);
  const [checkedAutomaticHeaderIds, setCheckedAutomaticHeaderIds] = useState([]);

  function normalizeHeaderName(headerName) {
    if (headerName === "Lot Size" || headerName === "Volume") return "Lot";
    if (headerName === "Entry Date" || headerName === "Entry Time") return "Ent Date";
    if (headerName === "Exit Date" || headerName === "Exit Time") return "Ext Date";
    if (headerName === "Entry Price") return "Entry";
    if (headerName === "Exit Price") return "Exit";
    if (headerName === "Profit/Loss Amount") return "P/L($)";

    return headerName;
  }

  function createSafeHeaderId(prefix, headerName, index = 0) {
    const safeName = String(headerName || "header")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${prefix}-${safeName || "header"}-${index}`;
  }

  function normalizeRule(rule) {
    return {
      id:
        rule?.id ||
        `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ruleType: rule?.ruleType || "time_range",
      ruleTimezone: rule?.ruleTimezone || "UTC",
      startTime: rule?.startTime || "",
      endTime: rule?.endTime || "",
      startDate: rule?.startDate || "",
      anchorTime: rule?.anchorTime || "",
      offsetDirection: rule?.offsetDirection || "plus",
      offsetHours: rule?.offsetHours || "",
      offsetMinutes: rule?.offsetMinutes || "",
      offsetSeconds: rule?.offsetSeconds || "",
      outputValue: rule?.outputValue || "",
    };
  }

  function normalizeHeader(header, index = 0) {
    const fallbackName = normalizeHeaderName(
      header?.name || `Header ${index + 1}`
    );
    const fallbackGroup = header?.group || "manual";
    const fallbackType = header?.type || "text";

    return {
      ...header,
      id:
        header?.id ||
        createSafeHeaderId(fallbackGroup || "header", fallbackName, index),
      name: fallbackName,
      group: fallbackGroup,
      type: fallbackType,
      formulaKey: header?.formulaKey || "",
      rules: (header?.rules || []).map((rule) => normalizeRule(rule)),
      locked: Boolean(header?.locked),
      lockedPosition: Boolean(header?.lockedPosition),
    };
  }

  function normalizeHeaders(headersArray) {
    const normalized = (headersArray || []).map((header, index) =>
      normalizeHeader(header, index)
    );

    const seen = new Set();

    return normalized.filter((header) => {
      const key = `${header.group}-${header.name.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function getDayNameFromDate(dateValue) {
    if (!dateValue) return "";

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "";

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    return dayNames[date.getDay()];
  }

  function formatOffsetResult(rule) {
    if (rule.ruleType !== "time_offset_range") return "";

    if (!rule.startDate || !rule.anchorTime) return "";

    const baseDate = new Date(`${rule.startDate}T${rule.anchorTime}:00`);

    if (Number.isNaN(baseDate.getTime())) return "";

    const hours = Number(rule.offsetHours || 0);
    const minutes = Number(rule.offsetMinutes || 0);
    const seconds = Number(rule.offsetSeconds || 0);

    const totalMs = (hours * 60 * 60 + minutes * 60 + seconds) * 1000;

    const resultDate =
      rule.offsetDirection === "minus"
        ? new Date(baseDate.getTime() - totalMs)
        : new Date(baseDate.getTime() + totalMs);

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const resultDay = dayNames[resultDate.getDay()];
    const resultDateText = resultDate.toISOString().slice(0, 10);
    const resultTimeText = resultDate.toTimeString().slice(0, 5);

    return `${resultDay}, ${resultDateText} ${resultTimeText}`;
  }

  function createBlankCustomAutoRule() {
    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ruleType: "time_range",
      ruleTimezone: "UTC",
      startTime: "",
      endTime: "",
      startDate: "",
      anchorTime: "",
      offsetDirection: "plus",
      offsetHours: "",
      offsetMinutes: "",
      offsetSeconds: "",
      outputValue: "",
    };
  }

  async function tradeLogNameExists(nameToCheck) {
    const cleanName = nameToCheck.trim().toLowerCase();

    if (!cleanName) {
      return false;
    }

    if (currentUser) {
      const { templates } = await getUserTradeLogTemplates(currentUser.id);
      const existingLogs = templates || [];

      return existingLogs.some((log) => {
        const sameName =
          String(log.logName || "").trim().toLowerCase() === cleanName;
        const sameLog = String(log.id) === String(editLogId);
        return sameName && !sameLog;
      });
    }

    const guestLogs = JSON.parse(localStorage.getItem("guestTradeLogs") || "[]");

    return guestLogs.some((log) => {
      const sameName =
        String(log.logName || "").trim().toLowerCase() === cleanName;
      const sameLog = String(log.id) === String(editLogId);
      return sameName && !sameLog;
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSession() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;

      if (isMounted) {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      }
    }

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setCurrentUser(session?.user ?? null);
        setIsCheckingAuth(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadEditLog() {
      if (!editLogId) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;

      if (user) {
        const { template } = await getSingleTradeLogTemplate(user.id, editLogId);

        if (template && mounted) {
          setIsEditMode(true);
          setLogName(template.logName || "");
          setInitialBalance(
            template.initialBalance !== undefined && template.initialBalance !== null
              ? String(template.initialBalance)
              : ""
          );
          setAccountCurrency(template.accountCurrency || "USD");
          setSelectedHeaders(
            normalizeHeaders(template.headers || requiredHeaders)
          );
        }

        return;
      }

      const guestLogs = JSON.parse(localStorage.getItem("guestTradeLogs") || "[]");
      const found = guestLogs.find(
        (item) => String(item.id) === String(editLogId)
      );

      if (found && mounted) {
        setIsEditMode(true);
        setLogName(found.logName || "");
        setInitialBalance(
          found.initialBalance !== undefined && found.initialBalance !== null
            ? String(found.initialBalance)
            : ""
        );
        setAccountCurrency(found.accountCurrency || "USD");
        setSelectedHeaders(normalizeHeaders(found.headers || requiredHeaders));
      }
    }

    loadEditLog();

    return () => {
      mounted = false;
    };
  }, [editLogId, requiredHeaders]);

  function setStatusMessage(message, isError = false) {
    setBuilderMessage(message);
    setIsBuilderError(isError);
  }

  function headerAlreadyExists(headerName) {
    return selectedHeaders.some(
      (header) =>
        header.name.trim().toLowerCase() === headerName.trim().toLowerCase()
    );
  }

  function manualOptionAlreadyExists(headerName) {
    return manualHeaderOptions.some(
      (option) =>
        option.name.trim().toLowerCase() === headerName.trim().toLowerCase()
    );
  }

  function handleToggleManualHeader(optionId) {
    setCheckedManualHeaderIds((previousIds) =>
      previousIds.includes(optionId)
        ? previousIds.filter((id) => id !== optionId)
        : [...previousIds, optionId]
    );
  }

  function handleToggleAutomaticHeader(optionId) {
    if (!currentUser) {
      setStatusMessage("Log in to use automatic headers.", true);
      return;
    }

    setCheckedAutomaticHeaderIds((previousIds) =>
      previousIds.includes(optionId)
        ? previousIds.filter((id) => id !== optionId)
        : [...previousIds, optionId]
    );
  }

  function handleApplySelectedManualHeaders() {
    if (checkedManualHeaderIds.length === 0) {
      setStatusMessage("Select at least one manual header first.", true);
      return;
    }

    const selectedOptions = manualHeaderOptions.filter((option) =>
      checkedManualHeaderIds.includes(option.id)
    );

    const headersToAdd = selectedOptions.filter(
      (option) => !headerAlreadyExists(option.name)
    );

    if (headersToAdd.length === 0) {
      setStatusMessage("All selected manual headers already exist.", true);
      return;
    }

    const newHeaders = headersToAdd.map((option, index) => ({
      id: `manual-added-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}-${index}`,
      name: option.name,
      group: "manual",
      type: option.type,
      locked: false,
      lockedPosition: false,
    }));

    setSelectedHeaders((previousHeaders) => [...previousHeaders, ...newHeaders]);
    setCheckedManualHeaderIds([]);
    setStatusMessage("Selected manual headers added.");
  }

  function handleApplySelectedAutomaticHeaders() {
    if (!currentUser) {
      setStatusMessage("Log in to use automatic headers.", true);
      return;
    }

    if (checkedAutomaticHeaderIds.length === 0) {
      setStatusMessage("Select at least one automatic header first.", true);
      return;
    }

    const selectedOptions = automaticHeaderOptions.filter((option) =>
      checkedAutomaticHeaderIds.includes(option.id)
    );

    const headersToAdd = selectedOptions.filter(
      (option) => !headerAlreadyExists(option.name)
    );

    if (headersToAdd.length === 0) {
      setStatusMessage("All selected automatic headers already exist.", true);
      return;
    }

    const newHeaders = headersToAdd.map((option, index) => ({
      id: `auto-added-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}-${index}`,
      name: option.name,
      group: "automatic",
      type: option.type,
      description: option.description,
      formulaKey: option.formulaKey,
      locked: false,
      lockedPosition: false,
    }));

    setSelectedHeaders((previousHeaders) => [...previousHeaders, ...newHeaders]);
    setCheckedAutomaticHeaderIds([]);
    setStatusMessage("Selected automatic headers added.");
  }

  function handleAddCustomAutoRuleRow() {
    if (!currentUser) return;

    setCustomAutoRules((prev) => [...prev, createBlankCustomAutoRule()]);
  }

  function handleCustomRuleChange(ruleId, fieldName, fieldValue) {
    setCustomAutoRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, [fieldName]: fieldValue } : rule
      )
    );
  }

  function handleRemoveCustomRuleRow(ruleId) {
    if (customAutoRules.length === 1) return;

    setCustomAutoRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  }

  function handleEditCustomHeader(header) {
    setEditingCustomAutoHeaderId(header.id);
    setCustomAutoHeaderName(header.name);
    setCustomAutoSourceField(header.sourceField);
    setCustomAutoDefaultValue(header.defaultValue || "");
    setCustomAutoRules(header.rules.map((r) => normalizeRule(r)));
  }

  function handleSaveEditedHeader() {
    setSelectedHeaders((prev) =>
      prev.map((h) =>
        h.id === editingCustomAutoHeaderId
          ? {
              ...h,
              name: customAutoHeaderName,
              sourceField: customAutoSourceField,
              defaultValue: customAutoDefaultValue,
              rules: customAutoRules,
            }
          : h
      )
    );

    setEditingCustomAutoHeaderId("");
    setCustomAutoHeaderName("");
    setCustomAutoSourceField("");
    setCustomAutoDefaultValue("");
    setCustomAutoRules([createBlankCustomAutoRule()]);

    setStatusMessage("Custom header updated.");
  }

  function handleDeleteSelectedManualHeaders() {
    if (checkedManualHeaderIds.length === 0) {
      setStatusMessage("Select at least one manual card to delete.", true);
      return;
    }

    setManualHeaderOptions((previousOptions) =>
      previousOptions.filter(
        (option) => !checkedManualHeaderIds.includes(option.id)
      )
    );

    setCheckedManualHeaderIds([]);
    setStatusMessage("Selected manual cards deleted from the manual list.");
  }

  function handleAddCustomManualHeader() {
    const cleanHeaderName = customManualHeaderName.trim();

    if (!cleanHeaderName) {
      setStatusMessage("Type a custom manual header name first.", true);
      return;
    }

    if (manualOptionAlreadyExists(cleanHeaderName)) {
      setStatusMessage(
        "That manual header already exists in the manual list.",
        true
      );
      return;
    }

    const newManualOption = {
      id: `manual-custom-option-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      name: cleanHeaderName,
      type: "text",
      isCustom: true,
    };

    setManualHeaderOptions((previousOptions) => [
      ...previousOptions,
      newManualOption,
    ]);
    setCustomManualHeaderName("");
    setStatusMessage(
      `Custom manual header "${cleanHeaderName}" added to the manual list.`
    );
  }

  function handleAddCustomAutomaticHeader() {
    if (!currentUser) {
      setStatusMessage("Log in to use custom automatic headers.", true);
      return;
    }

    const cleanHeaderName = customAutoHeaderName.trim();
    const cleanSourceField = customAutoSourceField.trim();

    if (!cleanHeaderName) {
      setStatusMessage("Type a custom automatic header name first.", true);
      return;
    }

    if (!cleanSourceField) {
      setStatusMessage(
        "Select a source field for the custom automatic header.",
        true
      );
      return;
    }

    if (!editingCustomAutoHeaderId && headerAlreadyExists(cleanHeaderName)) {
      setStatusMessage("That header already exists.", true);
      return;
    }

    const hasIncompleteRule = customAutoRules.some((rule) => {
      if (!rule.outputValue.trim()) return true;

      if (rule.ruleType === "time_range") {
        return !rule.startTime.trim() || !rule.endTime.trim() || !rule.ruleTimezone;
      }

      if (rule.ruleType === "time_offset_range") {
        return (
          !rule.startDate.trim() ||
          !rule.anchorTime.trim() ||
          !rule.ruleTimezone ||
          (!rule.offsetHours && !rule.offsetMinutes && !rule.offsetSeconds)
        );
      }

      return false;
    });

    if (hasIncompleteRule) {
      setStatusMessage(
        "Complete every custom automatic condition before adding the header.",
        true
      );
      return;
    }

    if (editingCustomAutoHeaderId) {
      handleSaveEditedHeader();
      return;
    }

    const newHeader = {
      id: `auto-custom-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      name: cleanHeaderName,
      group: "custom_automatic",
      type: "custom_auto",
      sourceField: cleanSourceField,
      defaultValue: customAutoDefaultValue.trim(),
      rules: customAutoRules.map((rule) => normalizeRule(rule)),
      locked: false,
      lockedPosition: false,
    };

    setSelectedHeaders((previousHeaders) => [...previousHeaders, newHeader]);
    setCustomAutoHeaderName("");
    setCustomAutoSourceField("");
    setCustomAutoDefaultValue("");
    setCustomAutoRules([createBlankCustomAutoRule()]);

    setStatusMessage(`Added custom automatic header: ${cleanHeaderName}`);
  }

  function handleCancelCustomHeaderEdit() {
    setEditingCustomAutoHeaderId("");
    setCustomAutoHeaderName("");
    setCustomAutoSourceField("");
    setCustomAutoDefaultValue("");
    setCustomAutoRules([createBlankCustomAutoRule()]);
    setStatusMessage("Custom header edit cancelled.");
  }

  function handleRemoveSelectedHeader(headerId) {
    const matchedHeader = selectedHeaders.find((header) => header.id === headerId);

    if (!matchedHeader) {
      setStatusMessage("Header not found.", true);
      return;
    }

    if (matchedHeader.locked) {
      setStatusMessage("Required headers cannot be removed.", true);
      return;
    }

    if (editingCustomAutoHeaderId === headerId) {
      handleCancelCustomHeaderEdit();
    }

    setSelectedHeaders((previousHeaders) =>
      previousHeaders.filter((header) => header.id !== headerId)
    );

    setStatusMessage(`Removed header: ${matchedHeader.name || "Header"}`);
  }

  function handleMoveHeaderUp(headerId) {
    const currentIndex = selectedHeaders.findIndex(
      (header) => header.id === headerId
    );

    if (currentIndex === -1) return;

    const currentHeader = selectedHeaders[currentIndex];

    if (currentIndex === 0) return;

    if (currentHeader.lockedPosition) {
      setStatusMessage("This header cannot change position.", true);
      return;
    }

    if (currentIndex - 1 === 0) {
      const previousHeader = selectedHeaders[0];

      if (previousHeader?.lockedPosition) return;
    }

    const updatedHeaders = [...selectedHeaders];

    [updatedHeaders[currentIndex - 1], updatedHeaders[currentIndex]] = [
      updatedHeaders[currentIndex],
      updatedHeaders[currentIndex - 1],
    ];

    setSelectedHeaders(updatedHeaders);
    setStatusMessage(`Moved ${currentHeader.name} up.`);
  }

  function handleMoveHeaderDown(headerId) {
    const currentIndex = selectedHeaders.findIndex(
      (header) => header.id === headerId
    );

    if (currentIndex === -1) return;

    const currentHeader = selectedHeaders[currentIndex];

    if (currentIndex === selectedHeaders.length - 1) return;

    if (currentHeader.lockedPosition) {
      setStatusMessage("This header cannot change position.", true);
      return;
    }

    const updatedHeaders = [...selectedHeaders];

    [updatedHeaders[currentIndex], updatedHeaders[currentIndex + 1]] = [
      updatedHeaders[currentIndex + 1],
      updatedHeaders[currentIndex],
    ];

    setSelectedHeaders(updatedHeaders);
    setStatusMessage(`Moved ${currentHeader.name} down.`);
  }

  async function handleCreateOrUpdateLog() {
    if (!logName.trim()) {
      setStatusMessage(
        isEditMode
          ? "Type a trade log name before updating the log."
          : "Type a trade log name before creating the log.",
        true
      );
      return;
    }

    const parsedInitialBalance = Number(initialBalance || 0);

    if (initialBalance && !Number.isFinite(parsedInitialBalance)) {
      setStatusMessage("Enter a valid initial balance.", true);
      return;
    }

    if (selectedHeaders.length === 0) {
      setStatusMessage("Add at least one header before saving the log.", true);
      return;
    }

    if (isCreatingLog) return;

    const nameExists = await tradeLogNameExists(logName);

    if (nameExists) {
      setStatusMessage(
        "A trade log with this name already exists. Please use a different name.",
        true
      );
      return;
    }

    setIsCreatingLog(true);

    try {
      const finalLogId = editLogId || `trade-log-${Date.now()}`;

      const templateObject = {
        id: finalLogId,
        logName: logName.trim(),
        initialBalance: Number.isFinite(parsedInitialBalance)
          ? parsedInitialBalance
          : 0,
        accountCurrency: accountCurrency || "USD",
        headers: normalizeHeaders(selectedHeaders),
        createdAt: new Date().toISOString(),
      };

      if (!currentUser) {
        const existingGuestLogs = JSON.parse(
          localStorage.getItem("guestTradeLogs") || "[]"
        );

        if (!isEditMode && existingGuestLogs.length >= 1) {
          setStatusMessage(
            "Guest users can create only 1 trade log. Log in to unlock more.",
            true
          );
          setIsCreatingLog(false);
          return;
        }

        let updatedGuestLogs = [];

        if (isEditMode) {
          updatedGuestLogs = existingGuestLogs.map((log) =>
            String(log.id) === String(finalLogId)
              ? { ...log, ...templateObject }
              : log
          );
        } else {
          updatedGuestLogs = [...existingGuestLogs, templateObject];
          localStorage.setItem(`rows-${finalLogId}`, JSON.stringify([]));
        }

        localStorage.setItem("guestTradeLogs", JSON.stringify(updatedGuestLogs));
        setStatusMessage("Trade log saved.");
        onSavedLog?.(finalLogId);
        return;
      }

      const result = await saveTradeLogTemplateToSupabase(
        currentUser.id,
        templateObject
      );

      if (result?.error) {
        setStatusMessage(
          isEditMode
            ? "Could not update trade log in your account."
            : "Could not save trade log to your account.",
          true
        );
        setIsCreatingLog(false);
        return;
      }

      if (!isEditMode) {
        localStorage.removeItem(`rows-${finalLogId}`);
      }

      setStatusMessage("Trade log saved to your account.");
      onSavedLog?.(finalLogId);
    } catch (error) {
      console.log("SAVE TRADE LOG ERROR:", error);
      setStatusMessage(
        isEditMode
          ? "Something went wrong while updating the trade log."
          : "Something went wrong while creating the trade log.",
        true
      );
    } finally {
      setIsCreatingLog(false);
    }
  }

  function isManualOptionChecked(optionId) {
    return checkedManualHeaderIds.includes(optionId);
  }

  function isAutomaticOptionChecked(optionId) {
    return checkedAutomaticHeaderIds.includes(optionId);
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
              ← Back to Trade Log Hub
            </button>
          ) : null}

          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
            EdgeVault Trade Log Builder
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            {isEditMode ? "Update Trade Log Headers" : "Trade Log Builder"}
          </h1>

          <p className="mt-4 max-w-4xl text-sm leading-relaxed text-slate-400">
            {isEditMode
              ? "Update your existing trade log headers without creating a new trade log."
              : "Build your trade log structure by keeping required headers, adding manual headers, adding automatic headers, and creating custom automatic rules."}
          </p>

          <p className="mt-5 text-sm font-medium text-slate-300">
            {isCheckingAuth
              ? "Checking access..."
              : currentUser
                ? `Logged in as ${currentUser.email} — full builder unlocked`
                : "Guest mode — required and manual headers only"}
          </p>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_180px_150px_auto]">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Trade Log Name
            </label>

            <input
              type="text"
              value={logName}
              onChange={(event) => setLogName(event.target.value)}
              placeholder="Example: Gold Scalping Log"
              className="w-full rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Initial Balance
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
              placeholder="1000"
              className="w-full rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Currency
            </label>

            <select
              value={accountCurrency}
              onChange={(event) => setAccountCurrency(event.target.value)}
              className="w-full rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="NGN">NGN</option>
              <option value="JPY">JPY</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleCreateOrUpdateLog}
              disabled={isCreatingLog}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
            >
              {isCreatingLog
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? "Update Log"
                  : "Create Log"}
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Initial balance and currency are used by Performance to calculate balance curve and percentage return for this trade log.
        </p>

        {builderMessage ? (
          <p
            className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
              isBuilderError
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {builderMessage}
          </p>
        ) : null}
      </Panel>

      <Panel className="p-6">
        <h2 className="text-2xl font-bold text-white">Required Headers</h2>

        <p className="mt-2 text-sm text-slate-400">
          These headers are required and always stay in the trade log.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {requiredHeaders.map((header) => (
            <div
              key={header.id}
              className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-emerald-300">*</span>

                  <p className="text-sm font-semibold text-white">
                    {header.name}
                  </p>
                </div>

                {header.lockedPosition ? (
                  <span className="text-xs text-cyan-300">Locked</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-6">
          <h2 className="text-2xl font-bold text-white">Add Manual Header</h2>

          <p className="mt-2 text-sm text-slate-400">
            Select one or more manual headers, then apply them to the preview.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {manualHeaderOptions.map((option) => (
              <div
                key={option.id}
                className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 px-4 py-3 transition hover:border-cyan-400/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {option.name}
                  </p>

                  <div className="flex items-center gap-2">
                    {option.isCustom ? (
                      <button
                        type="button"
                        onClick={() =>
                          setManualHeaderOptions((previousOptions) =>
                            previousOptions.filter(
                              (item) => item.id !== option.id
                            )
                          )
                        }
                        className="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-sm font-medium text-red-300 hover:bg-red-500/20"
                        title="Delete custom manual card"
                      >
                        ✕
                      </button>
                    ) : null}

                    <input
                      type="checkbox"
                      checked={isManualOptionChecked(option.id)}
                      onChange={() => handleToggleManualHeader(option.id)}
                      className="mt-1 h-4 w-4 accent-cyan-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-cyan-400/20 bg-[#0F0F1F]/70 p-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Custom Manual Header
            </label>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={customManualHeaderName}
                onChange={(event) =>
                  setCustomManualHeaderName(event.target.value)
                }
                placeholder="Type custom manual header name"
                className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />

              <button
                type="button"
                onClick={handleAddCustomManualHeader}
                className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20"
              >
                Add Header
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDeleteSelectedManualHeaders}
                className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
              >
                Delete Selected
              </button>

              <button
                type="button"
                onClick={handleApplySelectedManualHeaders}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-bold text-black hover:opacity-90"
              >
                Apply Selected Headers
              </button>
            </div>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white">
              Add Automatic Header
            </h2>

            {!currentUser ? (
              <span className="rounded-full border border-slate-700 bg-[#0F0F1F] px-3 py-1 text-xs font-medium text-slate-400">
                Login Required
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Select one or more automatic headers, then apply them to the preview.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {automaticHeaderOptions.map((option) => (
              <div
                key={option.id}
                className={`rounded-xl border px-4 py-3 transition ${
                  currentUser
                    ? "border-cyan-400/10 bg-[#0F0F1F]/70 hover:border-cyan-400/40"
                    : "border-slate-800 bg-[#0F0F1F]/40 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {option.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {option.description}
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={isAutomaticOptionChecked(option.id)}
                    onChange={() => handleToggleAutomaticHeader(option.id)}
                    disabled={!currentUser}
                    className="mt-1 h-4 w-4 accent-cyan-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleApplySelectedAutomaticHeaders}
              className={`rounded-xl px-5 py-3 text-sm font-bold ${
                currentUser
                  ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-black hover:opacity-90"
                  : "cursor-not-allowed bg-slate-800 text-slate-500"
              }`}
            >
              Apply Selected Headers
            </button>
          </div>
        </Panel>
      </div>

      <Panel className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">
            {editingCustomAutoHeaderId
              ? "Edit Custom Automatic Header"
              : "Add Custom Automatic Header"}
          </h2>

          {!currentUser ? (
            <span className="rounded-full border border-slate-700 bg-[#0F0F1F] px-3 py-1 text-xs font-medium text-slate-400">
              Login Required
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-sm text-slate-400">
          Create or edit your own automatic header by defining its name, source
          field, conditions, outputs, and optional default value.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Header Name
            </label>

            <input
              type="text"
              value={customAutoHeaderName}
              onChange={(event) => setCustomAutoHeaderName(event.target.value)}
              placeholder="Example: Entry Q Zone"
              disabled={!currentUser}
              className="w-full rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Source Field
            </label>

            <select
              value={customAutoSourceField}
              onChange={(event) => setCustomAutoSourceField(event.target.value)}
              disabled={!currentUser}
              className="w-full rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
            >
              <option value="">Select source field</option>

              {selectedHeaders.map((header) => (
                <option key={header.id} value={header.name}>
                  {header.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Default Value
            </label>

            <input
              type="text"
              value={customAutoDefaultValue}
              onChange={(event) =>
                setCustomAutoDefaultValue(event.target.value)
              }
              placeholder="Leave blank if no condition matches"
              disabled={!currentUser}
              className="w-full rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400 disabled:opacity-60"
            />
          </div>
        </div>

        <div className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold text-white">Conditions</h3>

            <button
              type="button"
              onClick={handleAddCustomAutoRuleRow}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                currentUser
                  ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20"
                  : "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500"
              }`}
            >
              Add Condition
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {customAutoRules.map((rule, index) => (
              <div
                key={rule.id}
                className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-white">
                    Condition {index + 1}
                  </p>

                  <button
                    type="button"
                    onClick={() => handleRemoveCustomRuleRow(rule.id)}
                    className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium ${
                      currentUser
                        ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                        : "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500"
                    }`}
                    title="Remove condition"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Condition Type
                    </label>

                    <select
                      value={rule.ruleType}
                      onChange={(event) =>
                        handleCustomRuleChange(
                          rule.id,
                          "ruleType",
                          event.target.value
                        )
                      }
                      disabled={!currentUser}
                      className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                    >
                      <option value="time_range">Time Range</option>
                      <option value="time_offset_range">Time Offset Range</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Rule Timezone
                    </label>

                    <select
                      value={rule.ruleTimezone || "UTC"}
                      onChange={(event) =>
                        handleCustomRuleChange(
                          rule.id,
                          "ruleTimezone",
                          event.target.value
                        )
                      }
                      disabled={!currentUser}
                      className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                    >
                      {availableRuleTimezones.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Output Value
                    </label>

                    <input
                      type="text"
                      value={rule.outputValue}
                      onChange={(event) =>
                        handleCustomRuleChange(
                          rule.id,
                          "outputValue",
                          event.target.value
                        )
                      }
                      placeholder="Example: Section 1"
                      disabled={!currentUser}
                      className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400 disabled:opacity-60"
                    />
                  </div>
                </div>

                {rule.ruleType === "time_range" ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Start Time
                      </label>

                      <input
                        type="time"
                        value={rule.startTime}
                        onChange={(event) =>
                          handleCustomRuleChange(
                            rule.id,
                            "startTime",
                            event.target.value
                          )
                        }
                        disabled={!currentUser}
                        className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        End Time
                      </label>

                      <input
                        type="time"
                        value={rule.endTime}
                        onChange={(event) =>
                          handleCustomRuleChange(
                            rule.id,
                            "endTime",
                            event.target.value
                          )
                        }
                        disabled={!currentUser}
                        className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Start Date
                        </label>

                        <input
                          type="date"
                          value={rule.startDate}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "startDate",
                              event.target.value
                            )
                          }
                          disabled={!currentUser}
                          className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                        />

                        {rule.startDate ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Day: {getDayNameFromDate(rule.startDate)}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Start Time
                        </label>

                        <input
                          type="time"
                          value={rule.anchorTime}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "anchorTime",
                              event.target.value
                            )
                          }
                          disabled={!currentUser}
                          className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Direction
                        </label>

                        <select
                          value={rule.offsetDirection}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "offsetDirection",
                              event.target.value
                            )
                          }
                          disabled={!currentUser}
                          className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                        >
                          <option value="plus">Plus</option>
                          <option value="minus">Minus</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Offset Hours
                        </label>

                        <input
                          type="number"
                          value={rule.offsetHours}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "offsetHours",
                              event.target.value
                            )
                          }
                          placeholder="Example: 120"
                          disabled={!currentUser}
                          className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400 disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Offset Minutes
                        </label>

                        <input
                          type="number"
                          value={rule.offsetMinutes}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "offsetMinutes",
                              event.target.value
                            )
                          }
                          placeholder="0"
                          disabled={!currentUser}
                          className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400 disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Offset Seconds
                        </label>

                        <input
                          type="number"
                          value={rule.offsetSeconds}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "offsetSeconds",
                              event.target.value
                            )
                          }
                          placeholder="0"
                          disabled={!currentUser}
                          className="w-full rounded-xl border border-cyan-400/10 bg-[#050712] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    {formatOffsetResult(rule) ? (
                      <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                        <p className="text-sm font-medium text-cyan-100">
                          Result: {formatOffsetResult(rule)}
                        </p>
                        <p className="mt-1 text-xs text-cyan-300">
                          The saved rule uses the start weekday/time and result
                          weekday/time.
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAddCustomAutomaticHeader}
              className={`rounded-xl px-5 py-3 text-sm font-bold ${
                currentUser
                  ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-black hover:opacity-90"
                  : "cursor-not-allowed bg-slate-800 text-slate-500"
              }`}
            >
              {editingCustomAutoHeaderId
                ? "Save Custom Automatic Header"
                : "Add Custom Automatic Header"}
            </button>

            {editingCustomAutoHeaderId ? (
              <button
                type="button"
                onClick={handleCancelCustomHeaderEdit}
                className="rounded-xl border border-slate-700 bg-[#0F0F1F] px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">
            Selected Header Preview
          </h2>

          <button
            type="button"
            onClick={handleCreateOrUpdateLog}
            disabled={isCreatingLog}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-bold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCreatingLog
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Log"
                : "Create Log"}
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-400">
          This preview shows the exact headers that will be used when you save
          the trade log.
        </p>

        <div className="mt-6 space-y-4">
          {selectedHeaders.map((header, index) => (
            <div
              key={`${header.id || header.name || "selected-header"}-${index}`}
              className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-4 transition hover:border-cyan-400/40"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      {index + 1}. {header.name}
                    </p>

                    <span className="rounded-full border border-cyan-400/10 bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-300">
                      {header.group === "required"
                        ? "Required"
                        : header.group === "manual"
                          ? "Manual"
                          : header.group === "automatic"
                            ? "Automatic"
                            : "Custom Automatic"}
                    </span>

                    {header.formulaKey ? (
                      <span className="rounded-full border border-emerald-400/10 bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-300">
                        Formula: {header.formulaKey}
                      </span>
                    ) : null}

                    {header.locked ? (
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-400">
                        Locked
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {header.group === "custom_automatic"
                      ? `Source: ${header.sourceField || "Not set"}`
                      : header.description || ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {header.group === "custom_automatic" ? (
                    <button
                      type="button"
                      onClick={() => handleEditCustomHeader(header)}
                      className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-400/20"
                    >
                      Edit
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleMoveHeaderUp(header.id)}
                    className="rounded-lg border border-slate-700 bg-[#050712] px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
                  >
                    Move Up
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMoveHeaderDown(header.id)}
                    className="rounded-lg border border-slate-700 bg-[#050712] px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
                  >
                    Move Down
                  </button>

                  {!header.locked ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveSelectedHeader(header.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20"
                      title="Remove header"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>

              {header.group === "custom_automatic" &&
              header.rules?.length > 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-cyan-400/20 bg-[#050712] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Custom Rules
                  </p>

                  <div className="mt-3 space-y-2">
                    {header.rules.map((rule) => (
                      <p key={rule.id} className="text-sm text-slate-400">
                        {rule.ruleType === "time_range"
                          ? `${rule.ruleTimezone || "UTC"}: ${
                              rule.startTime
                            } to ${rule.endTime} → ${rule.outputValue}`
                          : `${rule.ruleTimezone || "UTC"}: ${getDayNameFromDate(
                              rule.startDate
                            )} ${rule.anchorTime} ${
                              rule.offsetDirection
                            } ${rule.offsetHours || 0}h ${
                              rule.offsetMinutes || 0
                            }m ${rule.offsetSeconds || 0}s → ${
                              rule.outputValue
                            }`}
                      </p>
                    ))}
                  </div>

                  {header.defaultValue ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Default: {header.defaultValue}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
