declare module "knex/types/tables" {
    interface Tables {
        config: {
            cfg_user: string; // Discord user ID
            cfg_key: string;  // Configuration key
            cfg_value: string; // Configuration value
        }
        tracked_messages: {
            tm_id: string; // Message ID
            tm_reply_id: string; // Reply message ID
        }
    }
}
