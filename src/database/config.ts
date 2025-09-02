import getKeyv from "../util/getKeyv.ts";
import { getDb } from "./index.ts";

const CACHE_EXPIRE = 3 * 60 * 1e3; // 3 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserConfig<T extends string[]>(id: string, keys: T): Promise<{ [K in T[number]]: any | null }> {
    const keyv = getKeyv();

    const result = {};
    const missing = [];
    for (const key of keys) {
        const value = await keyv.get(`usercfg:${id}:${key}`);
        if (!value) {
            missing.push(key);
        } else {
            result[key] = value;
        }
    }

    if (missing.length > 0) {
        await getDb()("config")
            .select("cfg_user", "cfg_key", "cfg_value")
            .from("config")
            .where("cfg_user", id)
            .whereIn("cfg_key", missing)
            .then(rows => {
                for (const row of rows) {
                    result[row.cfg_key] = row.cfg_value;
                    keyv.set(`usercfg:${id}:${row.cfg_key}`, row.cfg_value);
                }
            });
    }
    for (const key of keys) {
        if (!(key in result)) {
            // This key is definitely missing. We'll cache "null" to indicate that.
            result[key] = null;
            await keyv.set(`usercfg:${id}:${key}`, null, CACHE_EXPIRE);
        }
    }

    return result as { [K in T[number]]: string | null };
}

export async function setUserConfig(id: string, key: string, value: string | null) {
    const keyv = getKeyv();

    if (value === null) {
        await getDb()("config")
            .where({
                cfg_user: id,
                cfg_key: key,
            })
            .del();
        await keyv.set(`usercfg:${id}:${key}`, null, CACHE_EXPIRE);
    } else {
        await getDb()("config")
            .insert({
                cfg_user: id,
                cfg_key: key,
                cfg_value: value,
            })
            .onConflict(["cfg_user", "cfg_key"])
            .merge();
        await keyv.set(`usercfg:${id}:${key}`, value, CACHE_EXPIRE);
    }
}
