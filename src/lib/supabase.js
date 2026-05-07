// This imports the function used to create a Supabase client
import { createClient } from "@supabase/supabase-js";

// This creates the Supabase client connection for the whole app
export const supabase = createClient(
  // This is your Supabase project URL
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  // This is your public Supabase key
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// This uploads one chart image to Supabase Storage
export async function uploadChartImage(file, userId, workspaceId, blockId) {
  // This creates a unique file path so one image cannot overwrite another
  const filePath = `${userId}/${workspaceId}/${blockId}-${Date.now()}`;

  // This uploads the file into the chart-images bucket
  const { error } = await supabase.storage
    .from("chart-images")
    .upload(filePath, file);

  // This checks if upload failed
  if (error) {
    // This logs the upload error
    console.log("UPLOAD ERROR:", error.message);

    // This returns the error
    return { error };
  }

  // This gets the public URL of the uploaded file
  const { data: publicUrlData } = supabase.storage
    .from("chart-images")
    .getPublicUrl(filePath);

  // This returns both the public URL and storage path
  return {
    url: publicUrlData.publicUrl,
    path: filePath,
    error: null,
  };
}

// This deletes one chart image from Supabase Storage
export async function deleteChartImage(filePath) {
  // This stops the function if no file path was given
  if (!filePath) {
    return;
  }

  // This removes the file from the chart-images bucket
  const { error } = await supabase.storage
    .from("chart-images")
    .remove([filePath]);

  // This logs any delete error
  if (error) {
    console.log("DELETE ERROR:", error.message);
  }
}

// This converts database analysis block rows into the frontend block shape
function mapDatabaseBlocksToFrontendBlocks(blocks) {
  return (blocks || []).map((block) => ({
    id: block.client_block_id || block.id,
    blockType: block.block_type || "general",
    sectionName: block.section_name || "",
    timeFrame: block.time_frame || "",
    analysisHtml: block.analysis_html || "",
    chartImage: block.chart_image || "",
    chartFileName: block.chart_file_name || "",
    chartFilePath: block.chart_file_path || "",
    checklistItems: Array.isArray(block.checklist_items)
      ? block.checklist_items
      : [],
    customChecklistItems: Array.isArray(block.custom_checklist_items)
      ? block.custom_checklist_items
      : [],
    isUploadingImage: false,
  }));
}

// This loads all workspaces for one logged-in user
export async function getUserWorkspaces(userId) {
  // This loads all workspace rows for this user
  const { data: workspaceRows, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // This handles workspace loading errors
  if (workspaceError) {
    console.log("GET WORKSPACES ERROR:", workspaceError.message);
    return { error: workspaceError, workspaces: [] };
  }

  // This handles the case where there are no workspaces yet
  if (!workspaceRows || workspaceRows.length === 0) {
    return { error: null, workspaces: [] };
  }

  // This extracts all database workspace ids
  const databaseWorkspaceIds = workspaceRows.map((workspace) => workspace.id);

  // This loads all journal rows linked to those workspaces
  const { data: linkedJournalRows, error: linkedJournalError } = await supabase
    .from("journal_entries")
    .select("client_id, workspace_id")
    .eq("user_id", userId)
    .in("workspace_id", databaseWorkspaceIds);

  // This handles linked journal loading errors
  if (linkedJournalError) {
    console.log("GET LINKED JOURNALS ERROR:", linkedJournalError.message);
    return { error: linkedJournalError, workspaces: [] };
  }

  // This loads all analysis blocks linked to those workspaces
  const { data: blockRows, error: blockError } = await supabase
    .from("analysis_blocks")
    .select("*")
    .in("workspace_id", databaseWorkspaceIds)
    .order("created_at", { ascending: true });

  // This handles analysis block loading errors
  if (blockError) {
    console.log("GET BLOCKS ERROR:", blockError.message);
    return { error: blockError, workspaces: [] };
  }

  // This converts database rows into the frontend workspace shape
  const workspaces = workspaceRows.map((workspace) => {
    // This selects only the blocks that belong to the current workspace
    const workspaceBlocks = (blockRows || []).filter(
      (block) => block.workspace_id === workspace.id
    );

    // This finds the journal entry linked to this workspace
    const linkedJournal = (linkedJournalRows || []).find(
      (journal) => String(journal.workspace_id) === String(workspace.id)
    );

    // This returns the frontend workspace object
    return {
      // This is the frontend workspace id
      id: workspace.client_id || workspace.id,
      // This keeps the real database workspace id hidden for backend linking
      databaseWorkspaceId: workspace.id,
      // This keeps linked journal id so Save to Journal Library updates instead of duplicating
      linkedJournalId: linkedJournal?.client_id || null,
      // This is the workspace title
      workspaceTitle: workspace.workspace_title || "",
      workspaceType: workspace.workspace_type || "general",
      // This is the instrument
      instrument: workspace.instrument || "",
      // This is the entry date
      entryDate: workspace.entry_date || "",
      // This is the mapped block list
      analysisBlocks: mapDatabaseBlocksToFrontendBlocks(workspaceBlocks),
      // This is the created date
      createdAt: workspace.created_at,
    };
  });

  // This returns the formatted workspace list
  return { error: null, workspaces };
}

// This loads one workspace for one user using the frontend workspace id
export async function getSingleWorkspace(userId, workspaceClientId) {
  // This loads all workspaces for the user
  const { error, workspaces } = await getUserWorkspaces(userId);

  // This returns if loading failed
  if (error) {
    return { error, workspace: null };
  }

  // This finds the exact workspace requested
  const workspace = workspaces.find(
    (item) => String(item.id) === String(workspaceClientId)
  );

  // This returns the workspace or null
  return { error: null, workspace: workspace || null };
}
// This saves or updates one workspace and all its analysis blocks
export async function saveWorkspaceToSupabase(userId, workspace) {
  // This creates the payload for the workspaces table
  const workspacePayload = {
    // This is the owner of the workspace
    user_id: userId,
    // This is the frontend workspace id
    client_id: String(workspace.id),
    // This is the title
    workspace_title: workspace.workspaceTitle || "",
    workspace_type: workspace.workspaceType || "general",
    // This is the instrument
    instrument: workspace.instrument || "",
    // This is the entry date
    entry_date: workspace.entryDate || null,
    // This updates the modified time
    updated_at: new Date().toISOString(),
  };

  // This checks whether the workspace already exists for this user
  const { data: existingWorkspace, error: existingWorkspaceError } = await supabase
    .from("workspaces")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("client_id", String(workspace.id))
    .maybeSingle();

  // This handles lookup errors
  if (existingWorkspaceError) {
    console.log("FIND WORKSPACE ERROR:", existingWorkspaceError.message);
    return { error: existingWorkspaceError, databaseWorkspaceId: null };
  }

  // This stores the database workspace id we will use for block saving
  let databaseWorkspaceId = null;

  // This updates an existing workspace
  if (existingWorkspace) {
    const { data: updatedWorkspace, error: updateWorkspaceError } = await supabase
      .from("workspaces")
      .update(workspacePayload)
      .eq("id", existingWorkspace.id)
      .select("id")
      .single();

    if (updateWorkspaceError) {
      console.log("UPDATE WORKSPACE ERROR:", updateWorkspaceError.message);
      return { error: updateWorkspaceError, databaseWorkspaceId: null };
    }

    databaseWorkspaceId = updatedWorkspace.id;
  } else {
    const { data: insertedWorkspace, error: insertWorkspaceError } = await supabase
      .from("workspaces")
      .insert({
        ...workspacePayload,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertWorkspaceError) {
      console.log("INSERT WORKSPACE ERROR:", insertWorkspaceError.message);
      return { error: insertWorkspaceError, databaseWorkspaceId: null };
    }

    databaseWorkspaceId = insertedWorkspace.id;
  }

  // This loads existing analysis block rows for this workspace
  const { data: existingBlocks, error: existingBlocksError } = await supabase
    .from("analysis_blocks")
    .select("id, client_block_id, chart_file_path")
    .eq("workspace_id", databaseWorkspaceId);

  // This handles existing block lookup errors
  if (existingBlocksError) {
    console.log("FIND BLOCKS ERROR:", existingBlocksError.message);
    return { error: existingBlocksError, databaseWorkspaceId: null };
  }

  // This builds a list of current frontend block ids
  const currentBlockIds = (workspace.analysisBlocks || []).map((block) =>
    String(block.id)
  );

  // This finds old blocks that were removed in the frontend
  const blocksToDelete = (existingBlocks || []).filter(
    (block) => !currentBlockIds.includes(String(block.client_block_id))
  );

  // This deletes removed block rows one by one
  for (const oldBlock of blocksToDelete) {
    // This deletes the old image file if it exists
    if (oldBlock.chart_file_path) {
      await deleteChartImage(oldBlock.chart_file_path);
    }

    // This deletes the old database block row
    const { error: deleteBlockError } = await supabase
      .from("analysis_blocks")
      .delete()
      .eq("id", oldBlock.id);

    if (deleteBlockError) {
      console.log("DELETE BLOCK ERROR:", deleteBlockError.message);
      return { error: deleteBlockError, databaseWorkspaceId: null };
    }
  }

  // This saves every current block
  for (const block of workspace.analysisBlocks || []) {
    // This checks whether the block already exists
    const existingBlock = (existingBlocks || []).find(
      (item) => String(item.client_block_id) === String(block.id)
    );

    // This creates the block payload
    const blockPayload = {
      workspace_id: databaseWorkspaceId,
      user_id: userId,
      client_block_id: String(block.id),
      block_type: block.blockType || "general",
      section_name: block.sectionName || "",
      time_frame: block.timeFrame || "",
      analysis_html: block.analysisHtml || "",
      chart_image: block.chartImage ?? null,
      chart_file_name: block.chartFileName ?? null,
      chart_file_path: block.chartFilePath ?? null,
      checklist_items: block.checklistItems || [],
      custom_checklist_items: block.customChecklistItems || [],
      updated_at: new Date().toISOString(),
    };

    // This updates the block if it already exists
    if (existingBlock) {
      const { error: updateBlockError } = await supabase
        .from("analysis_blocks")
        .update(blockPayload)
        .eq("id", existingBlock.id);

      if (updateBlockError) {
        console.log("UPDATE BLOCK ERROR:", updateBlockError.message);
        return { error: updateBlockError, databaseWorkspaceId: null };
      }
    } else {
      const { error: insertBlockError } = await supabase
        .from("analysis_blocks")
        .insert({
          ...blockPayload,
          created_at: new Date().toISOString(),
        });

      if (insertBlockError) {
        console.log("INSERT BLOCK ERROR:", insertBlockError.message);
        return { error: insertBlockError, databaseWorkspaceId: null };
      }
    }
  }

  // This returns success and the real database workspace id
  return { error: null, databaseWorkspaceId };
}

// This deletes one workspace for one logged-in user
export async function deleteWorkspaceFromSupabase(userId, workspaceClientId) {
  // This finds the workspace by user id and frontend workspace id
  const { data: matchedWorkspace, error: workspaceLookupError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", String(workspaceClientId))
    .maybeSingle();

  // This handles lookup errors
  if (workspaceLookupError) {
    console.log("LOOKUP DELETE WORKSPACE ERROR:", workspaceLookupError.message);
    return { error: workspaceLookupError };
  }

  // This stops if the workspace does not exist
  if (!matchedWorkspace) {
    return { error: null };
  }

  // This loads all block file paths so images can be removed too
  const { data: blocks, error: blockLookupError } = await supabase
    .from("analysis_blocks")
    .select("chart_file_path")
    .eq("workspace_id", matchedWorkspace.id);

  // This handles block lookup errors
  if (blockLookupError) {
    console.log("LOOKUP BLOCKS FOR DELETE ERROR:", blockLookupError.message);
    return { error: blockLookupError };
  }

  // This deletes all linked storage images first
  for (const block of blocks || []) {
    if (block.chart_file_path) {
      await deleteChartImage(block.chart_file_path);
    }
  }

  // This deletes the workspace row
  const { error: deleteWorkspaceError } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", matchedWorkspace.id);

  // This handles delete errors
  if (deleteWorkspaceError) {
    console.log("DELETE WORKSPACE ERROR:", deleteWorkspaceError.message);
    return { error: deleteWorkspaceError };
  }

  return { error: null };
}
// This loads all journal entries for one logged-in user
export async function getUserJournalEntries(userId) {
  // This loads all journal entry rows for the user
  const { data: entryRows, error: entryError } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // This handles journal loading errors
  if (entryError) {
    console.log("GET JOURNAL ENTRIES ERROR:", entryError.message);
    return { error: entryError, entries: [] };
  }

  // This handles empty journal state
  if (!entryRows || entryRows.length === 0) {
    return { error: null, entries: [] };
  }

  // This loads all user workspaces so journal entries can use linked blocks
  const { error: workspaceError, workspaces } = await getUserWorkspaces(userId);

  // This handles workspace loading errors
  if (workspaceError) {
    return { error: workspaceError, entries: [] };
  }

  // This maps journal rows into frontend shape
  const entries = entryRows.map((entry) => {
    // This finds the linked workspace using the real database workspace id
    const linkedWorkspace = workspaces.find(
      (workspace) =>
        String(workspace.databaseWorkspaceId) === String(entry.workspace_id)
    );

    // This returns the frontend journal entry object
    return {
      id: entry.client_id || entry.id,
      entryTitle: entry.entry_title || "",
      workspaceType: linkedWorkspace?.workspaceType || "general",
      instrument: entry.instrument || "",
      entryDate: entry.entry_date || "",
      workspaceId: linkedWorkspace ? linkedWorkspace.id : null,
      analysisBlocks: linkedWorkspace ? linkedWorkspace.analysisBlocks : [],
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    };
  });

  return { error: null, entries };
}

// This loads one specific journal entry using the frontend journal id
export async function getSingleJournalEntry(userId, journalClientId) {
  // This loads all journal entries for the user
  const { error, entries } = await getUserJournalEntries(userId);

  // This returns if loading failed
  if (error) {
    return { error, entry: null };
  }

  // This finds the one entry requested
  const entry = entries.find(
    (item) => String(item.id) === String(journalClientId)
  );

  return { error: null, entry: entry || null };
}

// This saves or updates one journal entry
export async function saveJournalEntryToSupabase(userId, journalEntry) {
  // This stores the real database workspace id we need
  let databaseWorkspaceId = null;

  // This looks up the workspace row using the frontend workspace id
  if (journalEntry.workspaceId) {
    const { data: matchedWorkspace, error: workspaceLookupError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", String(journalEntry.workspaceId))
      .maybeSingle();

    // This handles workspace lookup errors
    if (workspaceLookupError) {
      console.log("LOOKUP JOURNAL WORKSPACE ERROR:", workspaceLookupError.message);
      return { error: workspaceLookupError };
    }

    // This stores the real database workspace id if found
    databaseWorkspaceId = matchedWorkspace?.id || null;
  }

  // This creates the journal payload
  const journalPayload = {
    user_id: userId,
    client_id: String(journalEntry.id),
    workspace_id: databaseWorkspaceId,
    entry_title: journalEntry.entryTitle || "",
    instrument: journalEntry.instrument || "",
    entry_date: journalEntry.entryDate || null,
    updated_at: new Date().toISOString(),
  };

  // This checks whether the journal entry already exists using its frontend journal id
  const { data: existingByClientId, error: existingByClientIdError } =
    await supabase
      .from("journal_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", String(journalEntry.id))
      .maybeSingle();

  // This handles lookup errors
  if (existingByClientIdError) {
    console.log("FIND JOURNAL ENTRY ERROR:", existingByClientIdError.message);
    return { error: existingByClientIdError };
  }

  // This stores the existing entry if found
  let existingEntry = existingByClientId;

  // This also checks whether a journal already exists for the workspace
  if (!existingEntry && databaseWorkspaceId) {
    const { data: existingByWorkspace, error: existingByWorkspaceError } =
      await supabase
        .from("journal_entries")
        .select("id")
        .eq("user_id", userId)
        .eq("workspace_id", databaseWorkspaceId)
        .maybeSingle();

    if (existingByWorkspaceError) {
      console.log(
        "FIND JOURNAL BY WORKSPACE ERROR:",
        existingByWorkspaceError.message
      );
      return { error: existingByWorkspaceError };
    }

    existingEntry = existingByWorkspace;
  }

  // This updates the journal entry if it exists
  if (existingEntry) {
    const { error: updateEntryError } = await supabase
      .from("journal_entries")
      .update(journalPayload)
      .eq("id", existingEntry.id);

    if (updateEntryError) {
      console.log("UPDATE JOURNAL ENTRY ERROR:", updateEntryError.message);
      return { error: updateEntryError };
    }
  } else {
    // This inserts the journal entry if it does not exist
    const { error: insertEntryError } = await supabase
      .from("journal_entries")
      .insert({
        ...journalPayload,
        created_at: new Date().toISOString(),
      });

    if (insertEntryError) {
      console.log("INSERT JOURNAL ENTRY ERROR:", insertEntryError.message);
      return { error: insertEntryError };
    }
  }

  return { error: null };
}

// This deletes one journal entry for one logged-in user
export async function deleteJournalEntryFromSupabase(userId, journalClientId) {
  // This deletes the matching journal row using user id and frontend journal id
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", String(journalClientId));

  // This handles delete errors
  if (error) {
    console.log("DELETE JOURNAL ENTRY ERROR:", error.message);
    return { error };
  }

  return { error: null };
}
// =========================================
// TRADE LOG TEMPLATE HELPERS
// =========================================

// This loads all saved trade log templates for one logged-in user
export async function getUserTradeLogTemplates(userId) {
  // This loads the template rows
  const { data: templateRows, error } = await supabase
    .from("trade_log_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // This handles loading errors
  if (error) {
    console.log("GET TRADE LOG TEMPLATES ERROR:", error.message);
    return { error, templates: [] };
  }

  // This maps database rows into the frontend shape
  const templates = (templateRows || []).map((template) => ({
    id: template.client_id || template.id,
    databaseTemplateId: template.id,
    logName: template.log_name || "",
    headers: Array.isArray(template.headers_json) ? template.headers_json : [],
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  }));

  return { error: null, templates };
}

// This loads one saved trade log template for one logged-in user
export async function getSingleTradeLogTemplate(userId, templateClientId) {
  // This loads all templates for the user
  const { error, templates } = await getUserTradeLogTemplates(userId);

  // This returns if loading failed
  if (error) {
    return { error, template: null };
  }

  // This finds the exact template requested
  const template = templates.find(
    (item) => String(item.id) === String(templateClientId)
  );

  return { error: null, template: template || null };
}

// This saves or updates one trade log template for one logged-in user
export async function saveTradeLogTemplateToSupabase(userId, template) {
  // This creates the payload for the database
  const templatePayload = {
    user_id: userId,
    client_id: String(template.id),
    log_name: template.logName || "",
    headers_json: template.headers || [],
    updated_at: new Date().toISOString(),
  };

  // This checks if the template already exists
  const { data: existingTemplate, error: existingTemplateError } = await supabase
    .from("trade_log_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", String(template.id))
    .maybeSingle();

  // This handles lookup errors
  if (existingTemplateError) {
    console.log("FIND TRADE LOG TEMPLATE ERROR:", existingTemplateError.message);
    return { error: existingTemplateError, databaseTemplateId: null };
  }

  // This stores the real database template id
  let databaseTemplateId = null;

  // This updates the template if it already exists
  if (existingTemplate) {
    const { data: updatedTemplate, error: updateTemplateError } = await supabase
      .from("trade_log_templates")
      .update(templatePayload)
      .eq("id", existingTemplate.id)
      .select("id")
      .single();

    if (updateTemplateError) {
      console.log("UPDATE TRADE LOG TEMPLATE ERROR:", updateTemplateError.message);
      return { error: updateTemplateError, databaseTemplateId: null };
    }

    databaseTemplateId = updatedTemplate.id;
  } else {
    // This inserts the template if it does not exist
    const { data: insertedTemplate, error: insertTemplateError } = await supabase
      .from("trade_log_templates")
      .insert({
        ...templatePayload,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertTemplateError) {
      console.log("INSERT TRADE LOG TEMPLATE ERROR:", insertTemplateError.message);
      return { error: insertTemplateError, databaseTemplateId: null };
    }

    databaseTemplateId = insertedTemplate.id;
  }

  return { error: null, databaseTemplateId };
}

// This deletes one trade log template for one logged-in user
export async function deleteTradeLogTemplateFromSupabase(userId, templateClientId) {
  // This deletes the matching template row
  const { error } = await supabase
    .from("trade_log_templates")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", String(templateClientId));

  // This handles delete errors
  if (error) {
    console.log("DELETE TRADE LOG TEMPLATE ERROR:", error.message);
    return { error };
  }

  return { error: null };
}

// =========================================
// TRADE LOG ROW HELPERS
// =========================================

// This loads all rows for one trade log template
export async function getTradeLogRows(userId, templateClientId) {
  // This first finds the real database template id
  const { data: matchedTemplate, error: templateLookupError } = await supabase
    .from("trade_log_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", String(templateClientId))
    .maybeSingle();

  // This handles lookup errors
  if (templateLookupError) {
    console.log("LOOKUP TRADE LOG TEMPLATE FOR ROWS ERROR:", templateLookupError.message);
    return { error: templateLookupError, rows: [] };
  }

  // This handles missing template
  if (!matchedTemplate) {
    return { error: null, rows: [] };
  }

  // This loads the row data
  const { data: rowRows, error: rowError } = await supabase
    .from("trade_log_rows")
    .select("*")
    .eq("user_id", userId)
    .eq("template_id", matchedTemplate.id)
    .order("created_at", { ascending: true });

  // This handles row loading errors
  if (rowError) {
    console.log("GET TRADE LOG ROWS ERROR:", rowError.message);
    return { error: rowError, rows: [] };
  }

  // This maps database rows into the frontend shape
  const rows = (rowRows || []).map((row) => ({
    id: row.client_row_id || row.id,
    databaseRowId: row.id,
    rowData: row.row_data_json || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { error: null, rows };
}

// This saves or updates one trade log row
export async function saveTradeLogRowToSupabase(userId, templateClientId, row) {
  // This first finds the real database template id
  const { data: matchedTemplate, error: templateLookupError } = await supabase
    .from("trade_log_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", String(templateClientId))
    .maybeSingle();

  // This handles template lookup errors
  if (templateLookupError) {
    console.log("LOOKUP TEMPLATE FOR SAVE ROW ERROR:", templateLookupError.message);
    return { error: templateLookupError };
  }

  // This handles missing template
  if (!matchedTemplate) {
    return {
      error: { message: "Trade log template not found." },
    };
  }

  // This builds the row payload
  const rowPayload = {
    user_id: userId,
    template_id: matchedTemplate.id,
    client_row_id: String(row.id),
    row_data_json: row.rowData || {},
    updated_at: new Date().toISOString(),
  };

  // This checks if the row already exists
  const { data: existingRow, error: existingRowError } = await supabase
    .from("trade_log_rows")
    .select("id")
    .eq("template_id", matchedTemplate.id)
    .eq("client_row_id", String(row.id))
    .maybeSingle();

  // This handles row lookup errors
  if (existingRowError) {
    console.log("FIND TRADE LOG ROW ERROR:", existingRowError.message);
    return { error: existingRowError };
  }

  // This updates the row if it already exists
  if (existingRow) {
    const { error: updateRowError } = await supabase
      .from("trade_log_rows")
      .update(rowPayload)
      .eq("id", existingRow.id);

    if (updateRowError) {
      console.log("UPDATE TRADE LOG ROW ERROR:", updateRowError.message);
      return { error: updateRowError };
    }
  } else {
    // This inserts the row if it does not exist
    const { error: insertRowError } = await supabase
      .from("trade_log_rows")
      .insert({
        ...rowPayload,
        created_at: new Date().toISOString(),
      });

    if (insertRowError) {
      console.log("INSERT TRADE LOG ROW ERROR:", insertRowError.message);
      return { error: insertRowError };
    }
  }

  return { error: null };
}

// This deletes one trade log row
export async function deleteTradeLogRowFromSupabase(userId, templateClientId, rowClientId) {
  // This first finds the real database template id
  const { data: matchedTemplate, error: templateLookupError } = await supabase
    .from("trade_log_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", String(templateClientId))
    .maybeSingle();

  // This handles template lookup errors
  if (templateLookupError) {
    console.log("LOOKUP TEMPLATE FOR DELETE ROW ERROR:", templateLookupError.message);
    return { error: templateLookupError };
  }

  // This handles missing template
  if (!matchedTemplate) {
    return { error: null };
  }

  // This deletes the matching row
  const { error } = await supabase
    .from("trade_log_rows")
    .delete()
    .eq("user_id", userId)
    .eq("template_id", matchedTemplate.id)
    .eq("client_row_id", String(rowClientId));

  // This handles delete errors
  if (error) {
    console.log("DELETE TRADE LOG ROW ERROR:", error.message);
    return { error };
  }

  return { error: null };
}
// =========================================
// LINKED DELETE HELPERS
// =========================================

// This deletes one workspace and also deletes its linked journal entry if one exists
export async function deleteWorkspaceAndLinkedJournalFromSupabase(
  userId,
  workspaceClientId
) {
  // This finds the workspace by user id and frontend workspace id
  const { data: matchedWorkspace, error: workspaceLookupError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", String(workspaceClientId))
    .maybeSingle();

  // This handles workspace lookup errors
  if (workspaceLookupError) {
    console.log(
      "LOOKUP LINKED DELETE WORKSPACE ERROR:",
      workspaceLookupError.message
    );
    return { error: workspaceLookupError };
  }

  // This stops if the workspace does not exist
  if (!matchedWorkspace) {
    return { error: null };
  }

  // This finds any linked journal entry using the real database workspace id
  const { data: linkedJournalEntries, error: journalLookupError } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("workspace_id", matchedWorkspace.id);

  // This handles journal lookup errors
  if (journalLookupError) {
    console.log(
      "LOOKUP LINKED JOURNAL FOR WORKSPACE DELETE ERROR:",
      journalLookupError.message
    );
    return { error: journalLookupError };
  }

  // This deletes any linked journal entries first
  if (linkedJournalEntries?.length) {
    const linkedJournalIds = linkedJournalEntries.map((entry) => entry.id);

    const { error: deleteLinkedJournalError } = await supabase
      .from("journal_entries")
      .delete()
      .in("id", linkedJournalIds);

    if (deleteLinkedJournalError) {
      console.log(
        "DELETE LINKED JOURNAL ENTRIES ERROR:",
        deleteLinkedJournalError.message
      );
      return { error: deleteLinkedJournalError };
    }
  }

  // This reuses the existing workspace delete helper for the workspace itself
  return await deleteWorkspaceFromSupabase(userId, workspaceClientId);
}

// This deletes one journal entry and also deletes its linked workspace if one exists
export async function deleteJournalAndLinkedWorkspaceFromSupabase(
  userId,
  journalClientId
) {
  // This finds the journal entry by user id and frontend journal id
  const { data: matchedJournalEntry, error: journalLookupError } = await supabase
    .from("journal_entries")
    .select("id, workspace_id")
    .eq("user_id", userId)
    .eq("client_id", String(journalClientId))
    .maybeSingle();

  // This handles journal lookup errors
  if (journalLookupError) {
    console.log(
      "LOOKUP LINKED DELETE JOURNAL ERROR:",
      journalLookupError.message
    );
    return { error: journalLookupError };
  }

  // This stops if the journal entry does not exist
  if (!matchedJournalEntry) {
    return { error: null };
  }

  // This deletes the journal entry first
  const { error: deleteJournalError } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", matchedJournalEntry.id);

  // This handles journal delete errors
  if (deleteJournalError) {
    console.log("DELETE JOURNAL ENTRY ERROR:", deleteJournalError.message);
    return { error: deleteJournalError };
  }

  // This stops if there is no linked workspace
  if (!matchedJournalEntry.workspace_id) {
    return { error: null };
  }

  // This finds the linked workspace client id so we can reuse the workspace delete helper
  const { data: linkedWorkspace, error: workspaceLookupError } = await supabase
    .from("workspaces")
    .select("client_id")
    .eq("user_id", userId)
    .eq("id", matchedJournalEntry.workspace_id)
    .maybeSingle();

  // This handles workspace lookup errors
  if (workspaceLookupError) {
    console.log(
      "LOOKUP LINKED WORKSPACE FOR JOURNAL DELETE ERROR:",
      workspaceLookupError.message
    );
    return { error: workspaceLookupError };
  }

  // This stops if the linked workspace is already gone
  if (!linkedWorkspace?.client_id) {
    return { error: null };
  }

  // This deletes the linked workspace using the existing helper
  return await deleteWorkspaceFromSupabase(userId, linkedWorkspace.client_id);
}

