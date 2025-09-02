import getKeyv from "../util/getKeyv.ts";
import { getDb } from "./index.ts";

export async function isMessageTracked(id: string) {
    const keyv = getKeyv();

    const cacheKey = `tracked_message:${id}`;
    const cached = await keyv.get(cacheKey);
    if (cached !== undefined) {
        return true;
    }

    // Not in cache. Check database.
    const row = await getDb()("tracked_messages")
        .select(["tm_id", "tm_added"])
        .where({
            tm_id: id,
        })
        .first();
    if (row) {
        // Found in database. Cache it for next time.
        await keyv.set(cacheKey, true, 60 * 60 * 1e3); // 1hour
        return true;
    }
    return false;
}

export async function trackMessage(id: string) {
    const keyv = getKeyv();

    const cacheKey = `tracked_message:${id}`;
    await getDb()("tracked_messages")
        .insert({
            tm_id: id,
        })
        .onConflict(["tm_id"])
        .ignore();
    await keyv.set(cacheKey, true, 60 * 60 * 1e3); // 1 hour
}
