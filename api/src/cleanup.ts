// Delete polls (and their responses) whose expiry date is before `today`.
// Returns the number of polls removed. Responses are deleted explicitly rather
// than relying on FK cascade, which D1 does not enable by default.
export async function deleteExpired(
  db: D1Database,
  today: string,
): Promise<number> {
  const results = await db.batch([
    db
      .prepare(
        `DELETE FROM responses WHERE poll_id IN
           (SELECT id FROM polls WHERE expires_at IS NOT NULL AND expires_at < ?)`,
      )
      .bind(today),
    db
      .prepare(`DELETE FROM polls WHERE expires_at IS NOT NULL AND expires_at < ?`)
      .bind(today),
  ]);
  return results[1].meta.changes ?? 0;
}
