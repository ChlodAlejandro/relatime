declare module 'knex/types/tables' {
    interface Tables {
        config: {
            cfg_user: string; // Discord user ID
            cfg_key: string;  // Configuration key
            cfg_value: string; // Configuration value
        }
    }
}
