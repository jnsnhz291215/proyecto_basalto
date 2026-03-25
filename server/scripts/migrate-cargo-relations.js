require('dotenv').config();
const { pool } = require('../database.js');

function normalizeCargoName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows?.[0]?.total || 0) > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows?.[0]?.total || 0) > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tableName, indexName]
  );
  return Number(rows?.[0]?.total || 0) > 0;
}

async function foreignKeyExists(connection, tableName, fkName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND constraint_name = ?
       AND constraint_type = 'FOREIGN KEY'`,
    [tableName, fkName]
  );
  return Number(rows?.[0]?.total || 0) > 0;
}

async function primaryKeyColumn(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT column_name
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND constraint_name = 'PRIMARY'
     ORDER BY ordinal_position ASC
     LIMIT 1`,
    [tableName]
  );
  return rows?.[0]?.column_name || null;
}

async function ensureIdCargoColumn(connection, tableName) {
  if (await columnExists(connection, tableName, 'id_cargo')) return;
  await connection.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`id_cargo\` INT(11) DEFAULT NULL`);
}

async function ensureIdCargoIndex(connection, tableName) {
  const indexName = `idx_${tableName}_id_cargo`;
  if (await indexExists(connection, tableName, indexName)) return;
  await connection.execute(`ALTER TABLE \`${tableName}\` ADD KEY \`${indexName}\` (\`id_cargo\`)`);
}

async function ensureCargoForeignKey(connection, tableName) {
  const fkName = `fk_${tableName}_cargo`;
  if (await foreignKeyExists(connection, tableName, fkName)) return;
  await connection.execute(
    `ALTER TABLE \`${tableName}\`
     ADD CONSTRAINT \`${fkName}\`
     FOREIGN KEY (\`id_cargo\`) REFERENCES \`cargos\` (\`id_cargo\`)
     ON DELETE SET NULL`
  );
}

async function backfillCargoIds(connection, tableName) {
  if (!(await tableExists(connection, tableName))) {
    console.log(`[MIGRATE_CARGO] Tabla ${tableName} no existe. Se omite.`);
    return;
  }

  const keyColumn = await primaryKeyColumn(connection, tableName);
  if (!keyColumn) {
    throw new Error(`La tabla ${tableName} no tiene clave primaria. No se puede migrar id_cargo.`);
  }

  await ensureIdCargoColumn(connection, tableName);

  const hasLegacyCargo = await columnExists(connection, tableName, 'cargo');
  if (!hasLegacyCargo) {
    await ensureIdCargoIndex(connection, tableName);
    await ensureCargoForeignKey(connection, tableName);
    console.log(`[MIGRATE_CARGO] ${tableName} ya usa id_cargo sin columna legacy.`);
    return;
  }

  const [cargoRows] = await connection.execute('SELECT id_cargo, nombre_cargo FROM cargos ORDER BY nombre_cargo ASC');
  const cargoMap = new Map(
    (cargoRows || []).map((row) => [normalizeCargoName(row.nombre_cargo), Number(row.id_cargo)])
  );

  const [legacyRows] = await connection.execute(
    `SELECT \`${keyColumn}\` AS row_id, \`cargo\` AS cargo_legacy, \`id_cargo\`
     FROM \`${tableName}\``
  );

  let updatedRows = 0;
  const unresolved = [];

  for (const row of legacyRows || []) {
    if (row.id_cargo) continue;
    const legacyCargo = String(row.cargo_legacy || '').trim();
    if (!legacyCargo) continue;

    const resolvedCargoId = cargoMap.get(normalizeCargoName(legacyCargo)) || null;
    if (!resolvedCargoId) {
      unresolved.push({ rowId: row.row_id, cargo: legacyCargo });
      continue;
    }

    await connection.execute(
      `UPDATE \`${tableName}\` SET \`id_cargo\` = ? WHERE \`${keyColumn}\` = ?`,
      [resolvedCargoId, row.row_id]
    );
    updatedRows += 1;
  }

  await ensureIdCargoIndex(connection, tableName);
  await ensureCargoForeignKey(connection, tableName);

  if (unresolved.length === 0) {
    await connection.execute(`ALTER TABLE \`${tableName}\` DROP COLUMN \`cargo\``);
    console.log(`[MIGRATE_CARGO] ${tableName}: ${updatedRows} fila(s) actualizadas y columna legacy eliminada.`);
    return;
  }

  console.warn(`[MIGRATE_CARGO] ${tableName}: ${updatedRows} fila(s) actualizadas. ${unresolved.length} fila(s) quedaron sin mapear; se conserva la columna cargo para revisión.`);
  unresolved.slice(0, 20).forEach((entry) => {
    console.warn(`  - ${tableName}.${keyColumn}=${entry.rowId} cargo=\"${entry.cargo}\"`);
  });
}

async function main() {
  const connection = await pool.getConnection();
  try {
    await backfillCargoIds(connection, 'trabajadores');
    await backfillCargoIds(connection, 'informes_personal');
    console.log('[MIGRATE_CARGO] Migración completada.');
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[MIGRATE_CARGO] Error fatal:', error);
  process.exitCode = 1;
});