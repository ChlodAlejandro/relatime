import * as fs from "fs/promises";
import knex, { Knex } from "knex";

const DB_PATH = process.env.RT_DB_PATH || "./relatime.db";

const tables = {
    config: {
        builder: (table: Knex.CreateTableBuilder) => {
            table.string("cfg_user", 22);
            table.string("cfg_key", 32);
            table.string("cfg_value", 256);
            table.primary(["cfg_user", "cfg_key"]);
        },
    },
};

export async function setupDb(db: Knex) {
    for (const [tableName, tableDef] of Object.entries(tables)) {
        const exists = await db.schema.hasTable(tableName);
        if (!exists) {
            await db.schema.createTable(tableName, tableDef.builder);
        }
    }
}

export async function dbExists(db: Knex) {
    try {
        await fs.stat(DB_PATH);
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
        } else {
            // Not an exception we expect. Re-throw.
            throw e;
        }
    }
    return await db.schema.hasTable("config");
}

export function getDb() {
    return knex({
        client: "better-sqlite3",
        connection: {
            filename: DB_PATH,
        },
        useNullAsDefault: true,
    });
}
