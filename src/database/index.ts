import * as fs from "fs/promises";
import knex, { Knex } from "knex";
import "./types";

const DB_PATH = process.env.RT_DB_PATH || "./data/relatime.db";

export const DB_TABLES = {
    config: {
        builder: (table: Knex.CreateTableBuilder) => {
            table.string("cfg_user", 22)
                .notNullable();
            table.string("cfg_key", 32)
                .notNullable();
            table.string("cfg_value", 256)
                .notNullable();
            table.primary(["cfg_user", "cfg_key"]);
        },
    },
    tracked_messages: {
        builder: (table: Knex.CreateTableBuilder) => {
            table.string("tm_id", 22)
                .primary()
                .notNullable();
            table.string("tm_reply_id", 22)
                .notNullable();
        },
    },
};

export async function setupDb(db: Knex) {
    for (const [tableName, tableDef] of Object.entries(DB_TABLES)) {
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
    for (const tableName of Object.keys(DB_TABLES)) {
        const exists = await db.schema.hasTable(tableName);
        if (!exists) return false;
    }
    return true;
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
