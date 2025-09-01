import { ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import soft, { DisplayFormat } from "timezone-soft";
import { getDb } from "../../../database/Database.ts";
import { errorEmbed } from "../../../embeds/errorEmbed";
import { successEmbed } from "../../../embeds/successEmbed";
import dateToString from "../../../util/dateToString";
import { CustomTimezone, isCustomTimezone } from "../../../util/isCustomTimezone";
import { log } from "../../../util/log.ts";
import offsetToString from "../../../util/offsetToString";
import timezoneToString from "../../../util/timezoneToString";
import { ISlashSubcommand } from "../../types";

export const timezone = <ISlashSubcommand>{
    builder: (subcommand: SlashCommandSubcommandBuilder) =>
        subcommand
            .setName("timezone")
            .setDescription("Set your local timezone.")
            .addStringOption(option =>
                option
                    .setName("timezone")
                    .setDescription('Enter your timezone (e.g., "America/New York", "London", "UTC+9")')
                    .setRequired(true),
            ),
    async execute(interaction: ChatInputCommandInteraction) {
        const tz = interaction.options.getString("timezone", true);

        let parsed: (DisplayFormat)[] | CustomTimezone = soft(tz);

        if (!parsed) {
            // Attempt to parse out a time offset
            const offsetMatch = tz.match(/^(?!UTC)?([+-])?(\d{1,2})(?!:(\d{1,2}))?$/i);

            if (offsetMatch) {
                const offsetSign = (offsetMatch[1] === "-" ? -1 : 1);
                const offsetHour = +offsetMatch[2];
                const offsetMinute = (offsetMatch[3] ? (+offsetMatch[3]) / 60 : 0);
                const offset = offsetSign * (offsetHour + offsetMinute);

                parsed = {
                    _custom: true,
                    name: offsetToString(offset),
                    standard: { offset },
                };
            }
        }

        if (!parsed) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [
                    errorEmbed(
                        "Unrecognized timezone",
                        "The timezone you gave could not be recognized. For best results, use a [TZ identifier](<https://en.wikipedia.org/wiki/List_of_tz_database_time_zones>) (such as \"America/New York\"), especially if your timezone uses daylight savings, or a UTC offset (such as \"UTC+07:00\").",
                    ),
                ],
            });
        } else if (!Array.isArray(parsed) || parsed.length === 1) {
            const timezone = Array.isArray(parsed) ? parsed[0] : parsed;

            const timeString = timezoneToString(timezone);
            const isCustom = isCustomTimezone(timezone);
            const offset = isCustom ? timezone.standard.offset : timezone.iana;

            let description = `Your timezone has been set to ${
                timeString
            }. The current time there is ${
                dateToString(new Date(), offset, interaction.locale, { dateStyle: "long", timeStyle: "medium" })
            }`;

            if (isCustom) {
                description += "\n\n**NOTE:** UTC offsets do not account for daylight savings time. If your location uses daylight savings, consider using a TZ identifier instead (e.g., \"America/New_York\" instead of \"-05:00\").";
            }

            await getDb()("config")
                .insert({
                    cfg_user: interaction.user.id,
                    cfg_key: "timezone",
                    cfg_value: isCustom ?
                        (`custom:${timezone.standard.offset}`) :
                        (`iana:${timezone.iana}`),
                })
                .onConflict(["cfg_user", "cfg_key"])
                .merge()
                .then()
                .catch(log.error);

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [
                    successEmbed(
                        "Timezone set",
                        description,
                    ),
                ],
            });
        } else {
            let timezone: DisplayFormat;

            // Exact IANA match (if input is `Etc/UTC`)
            timezone = parsed
                .find((timezone) => tz.toLowerCase() === timezone.iana.toLowerCase());
            // Partial IANA match (if input is just `UTC`)
            if (!timezone) {
                timezone = parsed
                    .find((timezone) => tz.toLowerCase() === timezone.iana.toLowerCase().replace(/^[^/]+\//, ""));
            }
            // Just get the first result
            if (!timezone) {
                timezone = parsed[0];
            }

            const timeString = timezoneToString(timezone);
            const offset = isCustomTimezone(timezone) ? timezone.standard.offset : timezone.iana;

            const description = `Multiple timezones were matched. The closest match is being used.\n\nYour timezone has been set to ${
                timeString
            }. The current time there is ${
                dateToString(new Date(), offset, interaction.locale, { dateStyle: "long", timeStyle: "medium" })
            }`;

            await getDb()("config")
                .insert({
                    cfg_user: interaction.user.id,
                    cfg_key: "timezone",
                    cfg_value: "iana:" + timezone.iana,
                })
                .onConflict(["cfg_user", "cfg_key"])
                .merge()
                .then()
                .catch(log.error);

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [
                    successEmbed(
                        "Timezone set",
                        description,
                    ),
                ],
            });
        }
    },
};
