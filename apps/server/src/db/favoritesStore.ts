import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';

/**
 * SQLite-backed set of favorite entity IDs (household-shared). Synchronous
 * (better-sqlite3); fine for this small, low-frequency data. Use ':memory:'
 * for tests.
 */
export class FavoritesStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS favorites (entity_id TEXT PRIMARY KEY, sort_order INTEGER NOT NULL DEFAULT 0)',
    );
    // Migrate older databases that lack the sort_order column.
    try {
      this.db.exec('ALTER TABLE favorites ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    } catch { /* column already exists */ }
  }

  list(): string[] {
    const rows = this.db
      .prepare('SELECT entity_id FROM favorites ORDER BY sort_order, entity_id')
      .all() as { entity_id: string }[];
    return rows.map((r) => r.entity_id);
  }

  set(entityId: string, favorite: boolean): void {
    if (favorite) {
      const maxRow = this.db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM favorites')
        .get() as { m: number };
      this.db
        .prepare('INSERT OR IGNORE INTO favorites (entity_id, sort_order) VALUES (?, ?)')
        .run(entityId, maxRow.m + 1);
    } else {
      this.db.prepare('DELETE FROM favorites WHERE entity_id = ?').run(entityId);
    }
  }

  reorder(entityIds: string[]): void {
    const update = this.db.prepare(
      'UPDATE favorites SET sort_order = ? WHERE entity_id = ?',
    );
    const tx = this.db.transaction(() => {
      entityIds.forEach((id, i) => update.run(i, id));
    });
    tx();
  }

  close(): void {
    this.db.close();
  }
}
