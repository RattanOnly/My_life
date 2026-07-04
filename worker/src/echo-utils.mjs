export const ECHO_SETTING_ENABLED_KEY = 'is_enabled';

export const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'content-type': 'application/json',
    ...init.headers
  }
});

export async function readJson(request) {
  if (!request.body) return {};

  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export async function readEchoEnabled(db) {
  const row = await db.prepare(`
    SELECT setting_value
    FROM echo_settings
    WHERE setting_key = ?1
  `).bind(ECHO_SETTING_ENABLED_KEY).first();

  return row?.setting_value !== '0';
}

export async function writeEchoEnabled(db, enabled) {
  await db.prepare(`
    INSERT INTO echo_settings (setting_key, setting_value, updated_at)
    VALUES (?1, ?2, CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    ECHO_SETTING_ENABLED_KEY,
    enabled ? '1' : '0'
  ).run();
}

export async function recordEchoUsage(db, {
  status,
  promptTokens = 0,
  completionTokens = 0,
  retrievedCount = 0,
  errorCode = null
}) {
  await db.prepare(`
    INSERT INTO echo_usage_events (
      created_at,
      event_status,
      prompt_tokens,
      completion_tokens,
      retrieved_count,
      error_code
    )
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `).bind(
    new Date().toISOString(),
    cleanText(status, 40) || 'unknown',
    Number(promptTokens) || 0,
    Number(completionTokens) || 0,
    Number(retrievedCount) || 0,
    errorCode ? cleanText(errorCode, 80) : null
  ).run();
}

export async function readEchoUsage(db) {
  const summary = await db.prepare(`
    SELECT
      COUNT(*) AS total_count,
      SUM(CASE WHEN event_status = 'success' THEN 1 ELSE 0 END) AS success_count,
      SUM(CASE WHEN event_status != 'success' THEN 1 ELSE 0 END) AS failure_count,
      SUM(prompt_tokens) AS prompt_tokens,
      SUM(completion_tokens) AS completion_tokens
    FROM echo_usage_events
  `).first();

  const recent = await db.prepare(`
    SELECT event_status, created_at, prompt_tokens, completion_tokens
    FROM echo_usage_events
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  `).all();

  return {
    summary: {
      totalCount: Number(summary?.total_count || 0),
      successCount: Number(summary?.success_count || 0),
      failureCount: Number(summary?.failure_count || 0),
      promptTokens: Number(summary?.prompt_tokens || 0),
      completionTokens: Number(summary?.completion_tokens || 0)
    },
    recentEvents: (recent.results || []).map(row => ({
      status: row.event_status,
      createdAt: row.created_at,
      promptTokens: Number(row.prompt_tokens || 0),
      completionTokens: Number(row.completion_tokens || 0)
    }))
  };
}
