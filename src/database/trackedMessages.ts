import { Snowflake } from "discord.js";
import getKeyv from "../util/getKeyv.ts";
import { getDb } from "./index.ts";

export async function getMessageBotReply(id: string): Promise<null | Snowflake> {
    const keyv = getKeyv();

    const cacheKey = `tracked_message:${id}`;
    const cached = await keyv.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    // Not in cache. Check database.
    const row = await getDb()("tracked_messages")
        .select(["tm_id", "tm_reply_id"])
        .where({
            tm_id: id,
        })
        .first();
    if (row) {
        // Found in database. Cache it for next time.
        await keyv.set(cacheKey, row.tm_reply_id, 60 * 60 * 1e3); // 1hour
        return row.tm_reply_id;
    }
    return null;
}

export async function untrackMessage(id: Snowflake) {
    const keyv = getKeyv();

    const cacheKey = `tracked_message:${id}`;
    await getDb()("tracked_messages")
        .where({
            tm_id: id,
        })
        .del();
    await keyv.delete(cacheKey);
}

export async function trackMessage(id: Snowflake, replyId: Snowflake) {
    const keyv = getKeyv();

    const cacheKey = `tracked_message:${id}`;
    await getDb()("tracked_messages")
        .insert({
            tm_id: id,
            tm_reply_id: replyId,
        })
        .onConflict(["tm_id"])
        .ignore();
    await keyv.set(cacheKey, replyId, 60 * 60 * 1e3); // 1 hour
}
