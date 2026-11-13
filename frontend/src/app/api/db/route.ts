import { NextRequest, NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Built-in Node.js 22+ SQLite module
import { DatabaseSync } from "node:sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDatabasePath(): string {
  const dataHome =
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  const appDir = path.join(dataHome, "com.nanobanana.studio");
  fs.mkdirSync(appDir, { recursive: true });
  return path.join(appDir, "nanobanana.sqlite3");
}

function getDefaultImagesDir(): string {
  const picturesDir = path.join(os.homedir(), "Pictures", "nanobanana");
  fs.mkdirSync(picturesDir, { recursive: true });
  return picturesDir;
}

function resolveUserPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return getDefaultImagesDir();
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

function sanitizeProjectFolderName(title: string, fallbackId?: string): string {
  const cleaned = title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallbackId || "New_Project";
}

function getConfiguredImagesDir(db: DatabaseSync): string {
  try {
    const row = db
      .prepare(`SELECT value FROM app_vault WHERE key = 'images_output_dir'`)
      .get() as { value: string } | undefined;
    if (
      row?.value &&
      row.value.trim() &&
      !row.value.includes(".local/share/com.nanobanana.studio/images") &&
      row.value.trim() !== path.join(os.homedir(), "Pictures") &&
      row.value.trim() !== "~/Pictures"
    ) {
      const resolved = resolveUserPath(row.value);
      fs.mkdirSync(resolved, { recursive: true });
      return resolved;
    }
  } catch {
    // Fallback to default ~/Pictures/nanobanana directory
  }
  return getDefaultImagesDir();
}

function toFilesystemImageUrl(filePath: string | null | undefined): string {
  if (!filePath) return "";
  if (filePath.startsWith("/api/image?path=")) return filePath;
  return `/api/image?path=${encodeURIComponent(filePath)}`;
}

function saveBase64PngToDir(
  dirPath: string,
  fileName: string,
  dataUrl: string
): string | null {
  if (
    !dataUrl ||
    !dataUrl.startsWith("data:image/") ||
    dataUrl.startsWith("data:image/svg+xml") ||
    !dataUrl.includes(";base64,")
  ) {
    return null;
  }
  try {
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx <= 0) return null;
    const b64 = dataUrl.slice(commaIdx + 1);
    fs.mkdirSync(dirPath, { recursive: true });
    const fullPath = path.join(dirPath, fileName);
    fs.writeFileSync(fullPath, Buffer.from(b64, "base64"));
    return fullPath;
  } catch {
    return null;
  }
}

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  const dbPath = getDatabasePath();
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'google',
      google_sub TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      picture TEXT NOT NULL DEFAULT '',
      email_verified INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      style_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversation_turns (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      turn_number INTEGER NOT NULL DEFAULT 1,
      parent_turn_number INTEGER,
      role TEXT NOT NULL DEFAULT 'assistant',
      raw_idea TEXT NOT NULL DEFAULT '',
      master_prompt TEXT NOT NULL DEFAULT '',
      edit_instruction TEXT,
      style_id TEXT NOT NULL DEFAULT '',
      modifiers_json TEXT NOT NULL DEFAULT '[]',
      completeness_score INTEGER NOT NULL DEFAULT 80,
      image_path TEXT,
      image_data_url TEXT,
      aspect_ratio TEXT NOT NULL DEFAULT '3:4',
      model_used TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
      is_published INTEGER NOT NULL DEFAULT 0,
      variants_json TEXT NOT NULL DEFAULT '[]',
      selected_variant_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_vault (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS harness_missions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      mission_mode TEXT NOT NULL DEFAULT 'SINGLE_ASSET',
      pack_invariants TEXT NOT NULL DEFAULT '',
      aspect_ratio TEXT NOT NULL DEFAULT '1:1',
      model_used TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
      max_rounds INTEGER NOT NULL DEFAULT 3,
      target_score INTEGER NOT NULL DEFAULT 85,
      candidates_per_round INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'IDLE',
      best_overall_score INTEGER NOT NULL DEFAULT 0,
      best_image_path TEXT,
      best_prompt TEXT,
      keystone_anchor_json TEXT,
      deliverables_json TEXT NOT NULL DEFAULT '[]',
      rubric_json TEXT NOT NULL DEFAULT '[]',
      rounds_json TEXT NOT NULL DEFAULT '[]',
      references_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    UPDATE conversation_turns
    SET image_data_url = NULL, image_path = NULL
    WHERE image_data_url LIKE '/showcase/%';
  `);

  try {
    db.exec(
      `ALTER TABLE conversation_turns ADD COLUMN variants_json TEXT NOT NULL DEFAULT '[]';`
    );
  } catch {
    // Column already exists
  }
  try {
    db.exec(
      `ALTER TABLE conversation_turns ADD COLUMN selected_variant_index INTEGER NOT NULL DEFAULT 0;`
    );
  } catch {
    // Column already exists
  }
  try {
    db.exec(
      `ALTER TABLE conversation_turns ADD COLUMN parent_turn_number INTEGER;`
    );
  } catch {
    // Column already exists
  }
  try {
    db.exec(
      `ALTER TABLE conversations ADD COLUMN canonical_dna_json TEXT;`
    );
  } catch {
    // Column already exists
  }

  // Organize existing images into per-project subfolders (~/Pictures/nanobanana/<project_title>/)
  try {
    const baseOutDir = getConfiguredImagesDir(db);
    const turns = db
      .prepare(
        `SELECT t.id, t.conversation_id, t.turn_number, t.image_path, t.variants_json, t.selected_variant_index, c.title AS project_title
         FROM conversation_turns t
         JOIN conversations c ON c.id = t.conversation_id`
      )
      .all() as Array<{
      id: string;
      conversation_id: string;
      turn_number: number;
      image_path: string | null;
      variants_json: string;
      selected_variant_index: number;
      project_title: string;
    }>;

    for (const r of turns) {
      const projDir = path.join(
        baseOutDir,
        sanitizeProjectFolderName(r.project_title, r.conversation_id)
      );
      fs.mkdirSync(projDir, { recursive: true });

      let parsedVars: Array<{
        label?: string;
        prompt?: string;
        imagePath?: string | null;
      }> = [];
      try {
        parsedVars = JSON.parse(r.variants_json || "[]");
      } catch {
        parsedVars = [];
      }

      let changed = false;
      const updatedVars = parsedVars.map((v, idx) => {
        const curPath = v.imagePath || null;
        if (
          curPath &&
          fs.existsSync(curPath) &&
          path.dirname(curPath) !== projDir
        ) {
          const targetPath = path.join(projDir, path.basename(curPath));
          try {
            fs.renameSync(curPath, targetPath);
            changed = true;
            return {
              label: v.label || `Variation #${idx + 1}`,
              prompt: v.prompt || "",
              imagePath: targetPath,
            };
          } catch {
            return v;
          }
        }
        return v;
      });

      let nextMainPath = r.image_path;
      if (
        nextMainPath &&
        fs.existsSync(nextMainPath) &&
        path.dirname(nextMainPath) !== projDir
      ) {
        const targetMain = path.join(projDir, path.basename(nextMainPath));
        try {
          fs.renameSync(nextMainPath, targetMain);
          nextMainPath = targetMain;
          changed = true;
        } catch {
          // Ignore
        }
      } else if (nextMainPath && !fs.existsSync(nextMainPath)) {
        const candidate = path.join(projDir, path.basename(nextMainPath));
        if (fs.existsSync(candidate)) {
          nextMainPath = candidate;
          changed = true;
        }
      }

      if (changed) {
        db.prepare(
          `UPDATE conversation_turns SET image_path = ?, variants_json = ? WHERE id = ?`
        ).run(nextMainPath, JSON.stringify(updatedVars), r.id);
      }
    }
  } catch {
    // Ignore folder migration errors
  }

  dbInstance = db;
  return db;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload = {} } = body;
    const db = getDb();
    const now = new Date().toISOString();

    if (action === "list_conversations") {
      const userId = String(payload.userId || "");
      const stmt = db.prepare(`
        SELECT c.id, c.user_id, c.title, c.style_id, c.created_at, c.updated_at,
               (SELECT COUNT(*) FROM conversation_turns t WHERE t.conversation_id = c.id) AS turn_count,
               (SELECT t.master_prompt FROM conversation_turns t WHERE t.conversation_id = c.id ORDER BY t.turn_number DESC LIMIT 1) AS latest_prompt,
               (SELECT t.image_path FROM conversation_turns t WHERE t.conversation_id = c.id ORDER BY t.turn_number DESC LIMIT 1) AS latest_image_path
        FROM conversations c
        WHERE (? = '' OR c.user_id = ?)
        ORDER BY c.updated_at DESC
      `);
      const rawRows = stmt.all(userId, userId) as Array<
        Record<string, unknown>
      >;
      const rows = rawRows.map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        title: String(r.title),
        style_id: String(r.style_id),
        turn_count: Number(r.turn_count ?? 0),
        latest_prompt: r.latest_prompt ? String(r.latest_prompt) : null,
        preview_image_url: r.latest_image_path
          ? toFilesystemImageUrl(String(r.latest_image_path))
          : null,
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      }));
      return NextResponse.json({ ok: true, data: rows });
    }

    if (action === "get_conversation_detail") {
      const conversationId = String(payload.conversationId || "");
      const convStmt = db.prepare(`
        SELECT id, user_id, title, style_id, canonical_dna_json, created_at, updated_at
        FROM conversations
        WHERE id = ?
      `);
      const conv = convStmt.get(conversationId) as
        | {
            id: string;
            user_id: string;
            title: string;
            style_id: string;
            canonical_dna_json?: string | null;
            created_at: string;
            updated_at: string;
          }
        | undefined;

      if (!conv) {
        return NextResponse.json({ ok: true, data: null });
      }

      const parsedCanonicalDna = (() => {
        if (!conv.canonical_dna_json) return null;
        try {
          const raw = JSON.parse(conv.canonical_dna_json) as {
            label?: string;
            imageUrl?: string;
            imagePath?: string | null;
            prompt?: string;
            sourceTurn?: number;
          };
          const resolvedImageUrl = raw.imagePath
            ? toFilesystemImageUrl(raw.imagePath)
            : raw.imageUrl || "";
          if (!resolvedImageUrl) return null;
          return {
            label: String(raw.label || "Pinned DNA"),
            imageUrl: resolvedImageUrl,
            prompt: String(raw.prompt || ""),
            sourceTurn: raw.sourceTurn !== undefined ? Number(raw.sourceTurn) : undefined,
          };
        } catch {
          return null;
        }
      })();

      const turnsStmt = db.prepare(`
        SELECT id, conversation_id, user_id, turn_number, parent_turn_number, role, raw_idea, master_prompt,
               edit_instruction, style_id, modifiers_json, completeness_score, image_path,
               aspect_ratio, model_used, is_published,
               variants_json, selected_variant_index, created_at
        FROM conversation_turns
        WHERE conversation_id = ?
        ORDER BY turn_number ASC
      `);
      const rawTurns = turnsStmt.all(conversationId) as Array<
        Record<string, unknown>
      >;
      const turns = rawTurns.map((t) => {
        const parsedVariants = (() => {
          try {
            const arr = JSON.parse(String(t.variants_json || "[]")) as Array<{
              label?: string;
              prompt?: string;
              imagePath?: string | null;
              imageUrl?: string;
            }>;
            return arr.map((v, i) => ({
              label: String(v.label || `Variation #${i + 1}`),
              prompt: String(v.prompt || ""),
              imagePath: v.imagePath || null,
              imageUrl: v.imagePath
                ? toFilesystemImageUrl(v.imagePath)
                : v.imageUrl && !v.imageUrl.startsWith("data:")
                ? v.imageUrl
                : "",
            }));
          } catch {
            return [];
          }
        })();

        const mainImagePath = t.image_path ? String(t.image_path) : null;
        const turnNum = Number(t.turn_number);
        const parentTurnNum =
          t.parent_turn_number !== null && t.parent_turn_number !== undefined
            ? Number(t.parent_turn_number)
            : turnNum > 1
            ? turnNum - 1
            : null;

        return {
          id: String(t.id),
          conversation_id: String(t.conversation_id),
          user_id: String(t.user_id),
          turn_number: turnNum,
          parent_turn_number: parentTurnNum,
          role: String(t.role || "assistant"),
          raw_idea: String(t.raw_idea || ""),
          master_prompt: String(t.master_prompt || ""),
          edit_instruction: t.edit_instruction
            ? String(t.edit_instruction)
            : null,
          style_id: String(t.style_id || ""),
          modifiers: (() => {
            try {
              return JSON.parse(String(t.modifiers_json || "[]"));
            } catch {
              return [];
            }
          })(),
          completeness_score: Number(t.completeness_score ?? 80),
          image_bucket_key: mainImagePath,
          image_url: mainImagePath ? toFilesystemImageUrl(mainImagePath) : null,
          aspect_ratio: String(t.aspect_ratio || "3:4"),
          model_used: String(t.model_used || "gemini-2.5-flash-image"),
          is_published: Boolean(t.is_published),
          variants: parsedVariants,
          selected_variant_index: Number(t.selected_variant_index ?? 0),
          created_at: String(t.created_at),
        };
      });

      const lastTurn = turns[turns.length - 1];
      return NextResponse.json({
        ok: true,
        data: {
          ...conv,
          canonical_dna: parsedCanonicalDna,
          turn_count: turns.length,
          latest_prompt: lastTurn?.master_prompt || null,
          preview_image_url: lastTurn?.image_url || null,
          turns,
        },
      });
    }

    if (action === "update_conversation_dna") {
      const conversationId = String(payload.conversationId || "");
      if (!conversationId) {
        return NextResponse.json({ ok: false, error: "Missing conversationId" });
      }
      const rawDna = payload.canonicalDna as
        | {
            label?: string;
            imageUrl?: string;
            prompt?: string;
            sourceTurn?: number;
          }
        | null
        | undefined;

      if (!rawDna || !rawDna.imageUrl) {
        db.prepare(
          `UPDATE conversations SET canonical_dna_json = NULL, updated_at = ? WHERE id = ?`
        ).run(now, conversationId);
        return NextResponse.json({ ok: true, data: null });
      }

      const convRow = db
        .prepare(`SELECT title FROM conversations WHERE id = ?`)
        .get(conversationId) as { title: string } | undefined;
      const effectiveTitle = convRow?.title || "New Project";

      let savedPath: string | null = null;
      let resolvedUrl = String(rawDna.imageUrl);

      if (resolvedUrl.startsWith("data:image/")) {
        const baseOutputDir = getConfiguredImagesDir(db);
        const projectOutputDir = path.join(
          baseOutputDir,
          sanitizeProjectFolderName(effectiveTitle, conversationId)
        );
        fs.mkdirSync(projectOutputDir, { recursive: true });
        savedPath = saveBase64PngToDir(
          projectOutputDir,
          `dna_ref_${Date.now()}.png`,
          resolvedUrl
        );
        if (savedPath) {
          resolvedUrl = toFilesystemImageUrl(savedPath);
        }
      } else if (resolvedUrl.startsWith("/api/image?path=")) {
        try {
          savedPath = decodeURIComponent(
            resolvedUrl.replace("/api/image?path=", "")
          );
        } catch {
          savedPath = null;
        }
      }

      const persistedObj = {
        label: String(rawDna.label || "Pinned DNA"),
        imageUrl: resolvedUrl,
        imagePath: savedPath,
        prompt: String(rawDna.prompt || ""),
        sourceTurn:
          rawDna.sourceTurn !== undefined ? Number(rawDna.sourceTurn) : undefined,
      };

      db.prepare(
        `UPDATE conversations SET canonical_dna_json = ?, updated_at = ? WHERE id = ?`
      ).run(JSON.stringify(persistedObj), now, conversationId);

      return NextResponse.json({
        ok: true,
        data: {
          label: persistedObj.label,
          imageUrl: persistedObj.imageUrl,
          prompt: persistedObj.prompt,
          sourceTurn: persistedObj.sourceTurn,
        },
      });
    }

    if (action === "create_conversation") {
      const userId = String(payload.user_id || "usr_local_dev");
      const title = String(payload.title || "New Project");
      const styleId = String(payload.style_id || "");
      const convId = `conv_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

      db.prepare(`
        INSERT OR IGNORE INTO users (id, provider, google_sub, email, name, picture, email_verified, created_at, updated_at)
        VALUES (?, 'local', ?, ?, 'Studio Creator', '', 1, ?, ?)
      `).run(userId, userId, `${userId}@nanobanana.local`, now, now);

      db.prepare(`
        INSERT INTO conversations (id, user_id, title, style_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(convId, userId, title, styleId, now, now);

      return NextResponse.json({
        ok: true,
        data: {
          id: convId,
          user_id: userId,
          title,
          style_id: styleId,
          turn_count: 0,
          latest_prompt: null,
          preview_image_url: null,
          created_at: now,
          updated_at: now,
        },
      });
    }

    if (action === "save_conversation_turn") {
      const conversationId = String(payload.conversationId || "");
      const userId = String(payload.user_id || "usr_local_dev");
      const turnId = `turn_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const projectTitle = String(
        payload.title || payload.raw_idea || "New Project"
      ).slice(0, 64);

      db.prepare(`
        INSERT OR IGNORE INTO users (id, provider, google_sub, email, name, picture, email_verified, created_at, updated_at)
        VALUES (?, 'local', ?, ?, 'Studio Creator', '', 1, ?, ?)
      `).run(userId, userId, `${userId}@nanobanana.local`, now, now);

      db.prepare(`
        INSERT OR IGNORE INTO conversations (id, user_id, title, style_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        conversationId,
        userId,
        projectTitle,
        String(payload.style_id || ""),
        now,
        now
      );

      if (payload.title) {
        db.prepare(`UPDATE conversations SET title = ? WHERE id = ?`).run(
          String(payload.title),
          conversationId
        );
      }

      const convRow = db
        .prepare(`SELECT title FROM conversations WHERE id = ?`)
        .get(conversationId) as { title: string } | undefined;
      const effectiveTitle = convRow?.title || projectTitle;

      const maxRow = db
        .prepare(
          `SELECT COALESCE(MAX(turn_number), 0) AS max_turn FROM conversation_turns WHERE conversation_id = ?`
        )
        .get(conversationId) as { max_turn: number } | undefined;
      const nextTurnNumber = Number(maxRow?.max_turn ?? 0) + 1;
      const parentTurnNumber =
        "parent_turn_number" in payload
          ? payload.parent_turn_number === null ||
            payload.parent_turn_number === undefined
            ? null
            : Number(payload.parent_turn_number)
          : nextTurnNumber > 1
          ? nextTurnNumber - 1
          : null;

      // Per-project subfolder inside ~/Pictures/nanobanana/<project_title>/
      const baseOutputDir = getConfiguredImagesDir(db);
      const projectOutputDir = path.join(
        baseOutputDir,
        sanitizeProjectFolderName(effectiveTitle, conversationId)
      );
      fs.mkdirSync(projectOutputDir, { recursive: true });

      const rawVariants = Array.isArray(payload.variants)
        ? (payload.variants as Array<{
            label?: string;
            prompt?: string;
            image_data_url?: string;
          }>)
        : [];

      const dbVariants = rawVariants.map((v, idx) => {
        const vDataUrl = v.image_data_url ? String(v.image_data_url) : "";
        const fileName = `interaction_${nextTurnNumber}_slot_${idx + 1}_${turnId}.png`;
        const savedPath = saveBase64PngToDir(
          projectOutputDir,
          fileName,
          vDataUrl
        );
        return {
          label: String(v.label || `Variation #${idx + 1}`),
          prompt: String(v.prompt || ""),
          imagePath: savedPath,
        };
      });

      const selectedVariantIndex = Number(payload.selected_variant_index ?? 0);
      const chosenVariant =
        dbVariants[selectedVariantIndex] || dbVariants[0];

      let imagePath: string | null = chosenVariant?.imagePath || null;
      if (
        !imagePath &&
        payload.image_data_url &&
        String(payload.image_data_url).startsWith("data:image/")
      ) {
        imagePath = saveBase64PngToDir(
          projectOutputDir,
          `interaction_${nextTurnNumber}_${turnId}.png`,
          String(payload.image_data_url)
        );
      }

      const modifiersJson = JSON.stringify(
        Array.isArray(payload.modifiers) ? payload.modifiers : []
      );
      const variantsJson = JSON.stringify(dbVariants);

      db.prepare(`
        INSERT INTO conversation_turns (
          id, conversation_id, user_id, turn_number, parent_turn_number, role, raw_idea, master_prompt,
          edit_instruction, style_id, modifiers_json, completeness_score, image_path,
          image_data_url, aspect_ratio, model_used, is_published,
          variants_json, selected_variant_index, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
      `).run(
        turnId,
        conversationId,
        userId,
        nextTurnNumber,
        parentTurnNumber,
        String(payload.role || "assistant"),
        String(payload.raw_idea || ""),
        String(payload.master_prompt || chosenVariant?.prompt || ""),
        payload.edit_instruction ? String(payload.edit_instruction) : null,
        String(payload.style_id || ""),
        modifiersJson,
        Number(payload.completeness_score ?? 85),
        imagePath,
        String(payload.aspect_ratio || "3:4"),
        String(payload.model_used || "gemini-2.5-flash-image"),
        payload.is_published ? 1 : 0,
        variantsJson,
        selectedVariantIndex,
        now
      );

      db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(
        now,
        conversationId
      );

      const responseVariants = dbVariants.map((v) => ({
        label: v.label,
        prompt: v.prompt,
        imagePath: v.imagePath,
        imageUrl: toFilesystemImageUrl(v.imagePath),
      }));

      return NextResponse.json({
        ok: true,
        data: {
          id: turnId,
          conversation_id: conversationId,
          user_id: userId,
          turn_number: nextTurnNumber,
          parent_turn_number: parentTurnNumber,
          role: String(payload.role || "assistant"),
          raw_idea: String(payload.raw_idea || ""),
          master_prompt: String(
            payload.master_prompt || chosenVariant?.prompt || ""
          ),
          edit_instruction: payload.edit_instruction
            ? String(payload.edit_instruction)
            : null,
          style_id: String(payload.style_id || ""),
          modifiers: Array.isArray(payload.modifiers) ? payload.modifiers : [],
          completeness_score: Number(payload.completeness_score ?? 85),
          image_bucket_key: imagePath,
          image_url: imagePath ? toFilesystemImageUrl(imagePath) : null,
          aspect_ratio: String(payload.aspect_ratio || "3:4"),
          model_used: String(payload.model_used || "gemini-2.5-flash-image"),
          is_published: Boolean(payload.is_published),
          variants: responseVariants,
          selected_variant_index: selectedVariantIndex,
          created_at: now,
        },
      });
    }

    if (action === "update_conversation_title") {
      const conversationId = String(payload.conversationId || "");
      const title = String(payload.title || "").trim() || "Untitled Project";

      const oldConv = db
        .prepare(`SELECT title FROM conversations WHERE id = ?`)
        .get(conversationId) as { title: string } | undefined;

      db.prepare(
        `UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`
      ).run(title, now, conversationId);

      // Rename the project subfolder on disk if it exists
      if (oldConv?.title) {
        try {
          const baseOutDir = getConfiguredImagesDir(db);
          const oldFolder = path.join(
            baseOutDir,
            sanitizeProjectFolderName(oldConv.title, conversationId)
          );
          const newFolder = path.join(
            baseOutDir,
            sanitizeProjectFolderName(title, conversationId)
          );
          if (
            oldFolder !== newFolder &&
            fs.existsSync(oldFolder) &&
            !fs.existsSync(newFolder)
          ) {
            fs.renameSync(oldFolder, newFolder);
            const turns = db
              .prepare(
                `SELECT id, image_path, variants_json FROM conversation_turns WHERE conversation_id = ?`
              )
              .all(conversationId) as Array<{
              id: string;
              image_path: string | null;
              variants_json: string;
            }>;
            for (const t of turns) {
              const nextMain = t.image_path
                ? t.image_path.replace(oldFolder, newFolder)
                : null;
              const nextVars = (t.variants_json || "[]").replaceAll(
                oldFolder,
                newFolder
              );
              db.prepare(
                `UPDATE conversation_turns SET image_path = ?, variants_json = ? WHERE id = ?`
              ).run(nextMain, nextVars, t.id);
            }
          }
        } catch {
          // Ignore folder rename errors
        }
      }

      return NextResponse.json({
        ok: true,
        data: { id: conversationId, title },
      });
    }

    if (action === "update_turn_selection") {
      const turnId = String(payload.turnId || "");
      const selectedIndex = Number(payload.selectedVariantIndex ?? 0);
      const chosenPrompt = String(payload.masterPrompt || "");

      const row = db
        .prepare(`SELECT variants_json FROM conversation_turns WHERE id = ?`)
        .get(turnId) as { variants_json: string } | undefined;

      let chosenImagePath: string | null = null;
      if (row?.variants_json) {
        try {
          const vars = JSON.parse(row.variants_json) as Array<{
            imagePath?: string | null;
          }>;
          chosenImagePath = vars[selectedIndex]?.imagePath || null;
        } catch {
          chosenImagePath = null;
        }
      }

      db.prepare(`
        UPDATE conversation_turns
        SET selected_variant_index = ?,
            master_prompt = ?,
            image_path = COALESCE(?, image_path),
            image_data_url = NULL
        WHERE id = ?
      `).run(selectedIndex, chosenPrompt, chosenImagePath, turnId);

      return NextResponse.json({ ok: true, data: true });
    }

    if (action === "delete_conversation") {
      const conversationId = String(payload.conversationId || "");
      // Removes from SQLite only, preserving PNG files in ~/Pictures/nanobanana/<project>/
      db.prepare(
        `DELETE FROM conversation_turns WHERE conversation_id = ?`
      ).run(conversationId);
      db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conversationId);
      return NextResponse.json({ ok: true, data: true });
    }

    if (action === "vault_get") {
      const row = db
        .prepare(`SELECT value FROM app_vault WHERE key = 'gemini_api_key'`)
        .get() as { value: string } | undefined;
      return NextResponse.json({ ok: true, data: row?.value || null });
    }

    if (action === "vault_set") {
      const apiKey = String(payload.apiKey || "").trim();
      if (!apiKey) {
        db.prepare(`DELETE FROM app_vault WHERE key = 'gemini_api_key'`).run();
      } else {
        db.prepare(`
          INSERT INTO app_vault (key, value, updated_at)
          VALUES ('gemini_api_key', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).run(apiKey, now);
      }
      return NextResponse.json({ ok: true, data: true });
    }

    if (action === "vault_clear") {
      db.prepare(`DELETE FROM app_vault WHERE key = 'gemini_api_key'`).run();
      return NextResponse.json({ ok: true, data: true });
    }

    if (action === "vault_get_theme") {
      const row = db
        .prepare(`SELECT value FROM app_vault WHERE key = 'studio_theme_mode'`)
        .get() as { value: string } | undefined;
      const mode = row?.value === "dark" ? "dark" : row?.value === "light" ? "light" : null;
      return NextResponse.json({ ok: true, data: mode });
    }

    if (action === "vault_set_theme") {
      const mode = payload.themeMode === "dark" ? "dark" : "light";
      db.prepare(`
        INSERT INTO app_vault (key, value, updated_at)
        VALUES ('studio_theme_mode', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(mode, now);
      return NextResponse.json({ ok: true, data: mode });
    }

    if (action === "vault_get_images_dir") {
      const dir = getConfiguredImagesDir(db);
      return NextResponse.json({ ok: true, data: dir });
    }

    if (action === "vault_set_images_dir") {
      const rawDir = String(payload.imagesOutputDir || "").trim();
      const resolved = resolveUserPath(rawDir);
      fs.mkdirSync(resolved, { recursive: true });
      db.prepare(`
        INSERT INTO app_vault (key, value, updated_at)
        VALUES ('images_output_dir', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(resolved, now);
      return NextResponse.json({ ok: true, data: resolved });
    }

    if (action === "vault_get_modifiers") {
      const row = db
        .prepare(
          `SELECT value FROM app_vault WHERE key = 'modifier_categories_json'`
        )
        .get() as { value: string } | undefined;
      if (!row?.value) {
        return NextResponse.json({ ok: true, data: null });
      }
      try {
        return NextResponse.json({ ok: true, data: JSON.parse(row.value) });
      } catch {
        return NextResponse.json({ ok: true, data: null });
      }
    }

    if (action === "vault_set_modifiers") {
      const categories = payload.categories;
      if (!Array.isArray(categories)) {
        return NextResponse.json(
          { ok: false, error: "Invalid categories array" },
          { status: 400 }
        );
      }
      const serialized = JSON.stringify(categories);
      db.prepare(`
        INSERT INTO app_vault (key, value, updated_at)
        VALUES ('modifier_categories_json', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(serialized, now);
      return NextResponse.json({ ok: true, data: categories });
    }

    if (action === "vault_get_ai_prompts") {
      const enhRow = db
        .prepare(
          `SELECT value FROM app_vault WHERE key = 'enhance_system_prompt'`
        )
        .get() as { value: string } | undefined;
      const varRow = db
        .prepare(
          `SELECT value FROM app_vault WHERE key = 'variation_system_prompt'`
        )
        .get() as { value: string } | undefined;
      const planRow = db
        .prepare(
          `SELECT value FROM app_vault WHERE key = 'harness_planner_prompt'`
        )
        .get() as { value: string } | undefined;
      const critRow = db
        .prepare(
          `SELECT value FROM app_vault WHERE key = 'harness_critic_prompt'`
        )
        .get() as { value: string } | undefined;
      const refRow = db
        .prepare(
          `SELECT value FROM app_vault WHERE key = 'harness_refiner_prompt'`
        )
        .get() as { value: string } | undefined;
      const stepsRow = db
        .prepare(
          `SELECT value FROM app_vault WHERE key = 'harness_default_steps'`
        )
        .get() as { value: string } | undefined;
      const parsedSteps = stepsRow?.value ? Number(stepsRow.value) : 4;
      const safeSteps = Number.isFinite(parsedSteps)
        ? Math.min(10, Math.max(3, Math.round(parsedSteps)))
        : 4;
      return NextResponse.json({
        ok: true,
        data: {
          enhanceSystemPrompt: enhRow?.value || null,
          variationSystemPrompt: varRow?.value || null,
          harnessPlannerPrompt: planRow?.value || null,
          harnessCriticPrompt: critRow?.value || null,
          harnessRefinerPrompt: refRow?.value || null,
          harnessDefaultSteps: safeSteps,
        },
      });
    }

    if (action === "vault_set_ai_prompts") {
      const enhanceSystemPrompt = String(
        payload.enhanceSystemPrompt ?? ""
      ).trim();
      const variationSystemPrompt = String(
        payload.variationSystemPrompt ?? ""
      ).trim();
      const harnessPlannerPrompt = String(
        payload.harnessPlannerPrompt ?? ""
      ).trim();
      const harnessCriticPrompt = String(
        payload.harnessCriticPrompt ?? ""
      ).trim();
      const harnessRefinerPrompt = String(
        payload.harnessRefinerPrompt ?? ""
      ).trim();
      const rawSteps = Number(payload.harnessDefaultSteps ?? 4);
      const harnessDefaultSteps = Number.isFinite(rawSteps)
        ? Math.min(10, Math.max(3, Math.round(rawSteps)))
        : 4;

      const upsertOrClear = (key: string, val: string) => {
        if (!val) {
          db.prepare(`DELETE FROM app_vault WHERE key = ?`).run(key);
        } else {
          db.prepare(`
            INSERT INTO app_vault (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
          `).run(key, val, now);
        }
      };

      upsertOrClear("enhance_system_prompt", enhanceSystemPrompt);
      upsertOrClear("variation_system_prompt", variationSystemPrompt);
      upsertOrClear("harness_planner_prompt", harnessPlannerPrompt);
      upsertOrClear("harness_critic_prompt", harnessCriticPrompt);
      upsertOrClear("harness_refiner_prompt", harnessRefinerPrompt);
      upsertOrClear("harness_default_steps", String(harnessDefaultSteps));

      return NextResponse.json({
        ok: true,
        data: {
          enhanceSystemPrompt: enhanceSystemPrompt || null,
          variationSystemPrompt: variationSystemPrompt || null,
          harnessPlannerPrompt: harnessPlannerPrompt || null,
          harnessCriticPrompt: harnessCriticPrompt || null,
          harnessRefinerPrompt: harnessRefinerPrompt || null,
          harnessDefaultSteps,
        },
      });
    }

    if (action === "list_harness_missions") {
      const userId = String(payload.userId || "");
      const stmt = db.prepare(`
        SELECT id, user_id, title, goal, status,
               best_overall_score, best_image_path, deliverables_json, rounds_json,
               created_at, updated_at
        FROM harness_missions
        WHERE (? = '' OR user_id = ?)
        ORDER BY updated_at DESC
      `);
      const rows = stmt.all(userId, userId) as Array<Record<string, unknown>>;
      const summaries = rows.map((r) => {
        let delivs: Array<{ status?: string }> = [];
        let rounds: unknown[] = [];
        try {
          delivs = JSON.parse(String(r.deliverables_json || "[]"));
        } catch {
          delivs = [];
        }
        try {
          rounds = JSON.parse(String(r.rounds_json || "[]"));
        } catch {
          rounds = [];
        }
        const solvedCount = delivs.filter((d) => d.status === "solved").length;
        return {
          id: String(r.id),
          user_id: String(r.user_id),
          title: String(r.title),
          goal: String(r.goal),
          deliverableCount: delivs.length || 1,
          solvedCount,
          roundCount: rounds.length,
          status: String(r.status || "idle"),
          bestScore: Number(r.best_overall_score ?? 0),
          bestImageUrl: r.best_image_path
            ? toFilesystemImageUrl(String(r.best_image_path))
            : null,
          created_at: String(r.created_at),
          updated_at: String(r.updated_at),
        };
      });
      return NextResponse.json({ ok: true, data: summaries });
    }

    if (action === "get_harness_mission") {
      const missionId = String(payload.missionId || "");
      const row = db
        .prepare(`SELECT * FROM harness_missions WHERE id = ?`)
        .get(missionId) as Record<string, unknown> | undefined;
      if (!row) {
        return NextResponse.json({ ok: true, data: null });
      }
      const parseSafe = <T,>(raw: unknown, fallback: T): T => {
        if (!raw) return fallback;
        try {
          return JSON.parse(String(raw)) as T;
        } catch {
          return fallback;
        }
      };
      const defaultConfig = {
        model: String(row.model_used || "gemini-2.5-flash-image"),
        modelParams: { temperature: 1.0, topP: 0.95, seed: null },
        aspectRatio: String(row.aspect_ratio || "1:1"),
        modifierIds: [],
        maxRounds: Number(row.max_rounds ?? 4),
        candidatesPerSlot: Number(row.candidates_per_round ?? 2),
        targetScore: Number(row.target_score ?? 85),
        checkpointMode: false,
      };
      return NextResponse.json({
        ok: true,
        data: {
          id: String(row.id),
          user_id: String(row.user_id),
          title: String(row.title),
          goal: String(row.goal),
          globalPackInvariants: String(row.pack_invariants || ""),
          referenceSlots: parseSafe(row.references_json, []),
          deliverables: parseSafe(row.deliverables_json, []),
          rubric: parseSafe(row.rubric_json, []),
          config: parseSafe(row.keystone_anchor_json, defaultConfig),
          rounds: parseSafe(row.rounds_json, []),
          status: String(row.status || "idle"),
          bestScore: Number(row.best_overall_score ?? 0),
          bestImageUrl: row.best_image_path
            ? toFilesystemImageUrl(String(row.best_image_path))
            : null,
          created_at: String(row.created_at),
          updated_at: String(row.updated_at),
        },
      });
    }

    if (action === "save_harness_mission") {
      const mission = (payload.mission || payload) as Record<string, unknown>;
      const missionId = String(
        mission.id ||
          `hm_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
      );
      const userId = String(
        mission.user_id || mission.userId || "usr_local_dev"
      );
      const title = String(mission.title || "Harness Mission").slice(0, 80);
      const goal = String(mission.goal || "");
      const globalPackInvariants = String(
        mission.globalPackInvariants || mission.packInvariants || ""
      );
      const cfg = (mission.config || {}) as Record<string, unknown>;
      const aspectRatio = String(
        cfg.aspectRatio || mission.aspectRatio || "1:1"
      );
      const modelUsed = String(
        cfg.model || mission.modelUsed || "gemini-2.5-flash-image"
      );
      const maxRounds = Number(cfg.maxRounds ?? mission.maxRounds ?? 4);
      const targetScore = Number(cfg.targetScore ?? mission.targetScore ?? 85);
      const candidatesPerRound = Number(
        cfg.candidatesPerSlot ?? mission.candidatesPerRound ?? 2
      );
      const status = String(mission.status || "idle");
      const bestScore = Number(
        mission.bestScore ?? mission.bestOverallScore ?? 0
      );
      const createdAt = String(
        mission.created_at || mission.createdAt || now
      );

      const baseOutputDir = getConfiguredImagesDir(db);
      const missionOutputDir = path.join(
        baseOutputDir,
        sanitizeProjectFolderName(`Harness_${title}`, missionId)
      );
      fs.mkdirSync(missionOutputDir, { recursive: true });

      const persistImageIfBase64 = (
        urlOrData: string | null | undefined,
        filePrefix: string
      ): { url: string | null; diskPath: string | null } => {
        if (!urlOrData) return { url: null, diskPath: null };
        const str = String(urlOrData);
        if (str.startsWith("data:image/")) {
          const saved = saveBase64PngToDir(
            missionOutputDir,
            `${filePrefix}_${missionId}.png`,
            str
          );
          if (saved) {
            return { url: toFilesystemImageUrl(saved), diskPath: saved };
          }
          return { url: str, diskPath: null };
        }
        if (str.startsWith("/api/image?path=")) {
          try {
            const decoded = decodeURIComponent(
              str.replace("/api/image?path=", "")
            );
            return { url: str, diskPath: decoded };
          } catch {
            return { url: str, diskPath: null };
          }
        }
        return { url: str, diskPath: str };
      };

      const rawDeliverables = Array.isArray(mission.deliverables)
        ? (mission.deliverables as Array<Record<string, unknown>>)
        : [];
      const rawRounds = Array.isArray(mission.rounds)
        ? (mission.rounds as Array<Record<string, unknown>>)
        : [];
      const persistedDeliverables = rawDeliverables.map((d, dIdx) => {
        const incRound = Number(d.incumbentRound ?? rawRounds.length ?? 1);
        const persistedImg = persistImageIfBase64(
          d.incumbentImageUrl ? String(d.incumbentImageUrl) : null,
          `slot_${dIdx + 1}_r${incRound}_incumbent`
        );
        return {
          ...d,
          incumbentImageUrl: persistedImg.url,
        };
      });
      const persistedRounds = rawRounds.map((r, rIdx) => {
        const rNum = Number(r.roundNumber ?? rIdx + 1);
        const kp = persistImageIfBase64(
          r.keystoneImageUrl ? String(r.keystoneImageUrl) : null,
          `r${rNum}_keystone`
        );
        const slotOutcomes = Array.isArray(r.slotOutcomes)
          ? (r.slotOutcomes as Array<Record<string, unknown>>)
          : [];
        const nextOutcomes = slotOutcomes.map((so, sIdx) => {
          const anchoredPersisted = persistImageIfBase64(
            so.anchoredFromImageUrl ? String(so.anchoredFromImageUrl) : null,
            `r${rNum}_s${sIdx + 1}_anchor`
          );
          const keystoneSlotPersisted = persistImageIfBase64(
            so.keystoneAnchorImageUrl ? String(so.keystoneAnchorImageUrl) : null,
            `r${rNum}_s${sIdx + 1}_keystone`
          );
          const cands = Array.isArray(so.candidates)
            ? (so.candidates as Array<Record<string, unknown>>)
            : [];
          const nextCands = cands.map((c, cIdx) => {
            const p = persistImageIfBase64(
              c.imageUrl ? String(c.imageUrl) : null,
              `r${rNum}_s${sIdx + 1}_c${cIdx + 1}`
            );
            return {
              ...c,
              imageUrl: p.url || "",
            };
          });
          return {
            ...so,
            anchoredFromImageUrl: anchoredPersisted.url,
            keystoneAnchorImageUrl: keystoneSlotPersisted.url,
            candidates: nextCands,
          };
        });
        return {
          ...r,
          keystoneImageUrl: kp.url,
          slotOutcomes: nextOutcomes,
        };
      });

      const rawRefs = Array.isArray(mission.referenceSlots)
        ? (mission.referenceSlots as Array<Record<string, unknown>>)
        : [];
      const persistedRefs = rawRefs.map((ref, idx) => {
        const rp = persistImageIfBase64(
          ref.dataUrl ? String(ref.dataUrl) : null,
          `user_ref_${idx + 1}`
        );
        return {
          ...ref,
          dataUrl: rp.url || String(ref.dataUrl || ""),
        };
      });

      const bestPersisted = persistImageIfBase64(
        mission.bestImageUrl ? String(mission.bestImageUrl) : null,
        `best_overall`
      );

      const missionMode =
        persistedDeliverables.length > 1 ? "ASSET_PACK" : "SINGLE_ASSET";

      db.prepare(`
        INSERT INTO harness_missions (
          id, user_id, title, goal, mission_mode, pack_invariants,
          aspect_ratio, model_used, max_rounds, target_score, candidates_per_round,
          status, best_overall_score, best_image_path, best_prompt,
          keystone_anchor_json, deliverables_json, rubric_json, rounds_json, references_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          goal = excluded.goal,
          mission_mode = excluded.mission_mode,
          pack_invariants = excluded.pack_invariants,
          aspect_ratio = excluded.aspect_ratio,
          model_used = excluded.model_used,
          max_rounds = excluded.max_rounds,
          target_score = excluded.target_score,
          candidates_per_round = excluded.candidates_per_round,
          status = excluded.status,
          best_overall_score = excluded.best_overall_score,
          best_image_path = COALESCE(excluded.best_image_path, harness_missions.best_image_path),
          best_prompt = COALESCE(excluded.best_prompt, harness_missions.best_prompt),
          keystone_anchor_json = excluded.keystone_anchor_json,
          deliverables_json = excluded.deliverables_json,
          rubric_json = excluded.rubric_json,
          rounds_json = excluded.rounds_json,
          references_json = excluded.references_json,
          updated_at = excluded.updated_at
      `).run(
        missionId,
        userId,
        title,
        goal,
        missionMode,
        globalPackInvariants,
        aspectRatio,
        modelUsed,
        maxRounds,
        targetScore,
        candidatesPerRound,
        status,
        bestScore,
        bestPersisted.diskPath,
        null,
        JSON.stringify(cfg),
        JSON.stringify(persistedDeliverables),
        JSON.stringify(Array.isArray(mission.rubric) ? mission.rubric : []),
        JSON.stringify(persistedRounds),
        JSON.stringify(persistedRefs),
        createdAt,
        now
      );

      return NextResponse.json({
        ok: true,
        data: {
          id: missionId,
          user_id: userId,
          title,
          goal,
          globalPackInvariants,
          referenceSlots: persistedRefs,
          deliverables: persistedDeliverables,
          rubric: Array.isArray(mission.rubric) ? mission.rubric : [],
          config: cfg,
          rounds: persistedRounds,
          status,
          bestScore,
          bestImageUrl: bestPersisted.url,
          created_at: createdAt,
          updated_at: now,
        },
      });
    }

    if (action === "update_harness_mission_title") {
      const missionId = String(payload.missionId || "").trim();
      const nextTitle =
        String(payload.title || "").trim().slice(0, 80) ||
        "Untitled Goal Mission";
      if (!missionId) {
        return NextResponse.json(
          { ok: false, error: "Missing missionId" },
          { status: 400 }
        );
      }
      db.prepare(
        `UPDATE harness_missions SET title = ?, updated_at = ? WHERE id = ?`
      ).run(nextTitle, now, missionId);
      return NextResponse.json({
        ok: true,
        data: { id: missionId, title: nextTitle, updated_at: now },
      });
    }

    if (action === "update_harness_mission_status") {
      const missionId = String(payload.missionId || "").trim();
      const nextStatus = String(payload.status || "idle").trim();
      if (!missionId) {
        return NextResponse.json(
          { ok: false, error: "Missing missionId" },
          { status: 400 }
        );
      }
      db.prepare(
        `UPDATE harness_missions SET status = ?, updated_at = ? WHERE id = ?`
      ).run(nextStatus, now, missionId);
      return NextResponse.json({
        ok: true,
        data: { id: missionId, status: nextStatus, updated_at: now },
      });
    }

    if (action === "delete_harness_mission") {
      const missionId = String(payload.missionId || "");
      db.prepare(`DELETE FROM harness_missions WHERE id = ?`).run(missionId);
      return NextResponse.json({ ok: true, data: true });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Database error",
      },
      { status: 500 }
    );
  }
}
