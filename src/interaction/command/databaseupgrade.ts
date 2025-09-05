import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { DB_TABLES, getDb } from "../../database";
import { errorEmbed } from "../../embeds/errorEmbed.ts";
import { successEmbed } from "../../embeds/successEmbed.ts";
import isOperator from "../../util/isOperator.ts";
import { version } from "../../version.ts";
import { ISlashCommand } from "../types.ts";

export const databaseupgrade = <ISlashCommand>{
    type: "debug",
    builder: new SlashCommandBuilder()
        .setName("databaseupgrade")
        .setDescription("Upgrade the database.")
        .addStringOption((option) =>
            option
                .setName("version")
                .setDescription("Version to upgrade to. Only available during development."),
        ),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        if (!isOperator(interaction.user.id)) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    interaction.client,
                    "Insufficient permissions",
                    "You do not have permission to use this command.",
                )],
            });
        }

        let upgradeVersion = interaction.options.getString("version");
        if (upgradeVersion && process.env.NODE_ENV === "production") {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    interaction.client,
                    "Unavailable option",
                    "The `version` option is only available during development.",
                )],
            });
            return;
        }

        if (!upgradeVersion) {
            // Use the current version
            upgradeVersion = version;
        }

        if (!upgradeVersion) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    interaction.client,
                    "Version not found",
                    "Could not determine the current version of the bot. Cannot proceed with database upgrade.",
                )],
            });
            return;
        }

        const appliedUpgrades = [];

        const knex = getDb();
        switch (upgradeVersion) {
            case "0.1.3":
                await knex.schema.alterTable("tracked_messages", (table) => {
                    table.string("tm_reply_id", 22)
                        .notNullable();
                });
                appliedUpgrades.push("0.1.3");
                break;
        }

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [successEmbed(
                interaction.client,
                "Database upgrade complete",
                appliedUpgrades.length
                    ? `Applied the following upgrades:\n- ${appliedUpgrades.join("\n- ")}`
                    : "No upgrades were necessary.",
            )],
        });
    },
};
