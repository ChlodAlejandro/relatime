import { ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import soft, { DisplayFormat } from "timezone-soft";
import { getUserConfig, setUserConfig } from "../../../database/config";
import { errorEmbed } from "../../../embeds/errorEmbed";
import { successEmbed } from "../../../embeds/successEmbed";
import dateToString from "../../../util/dateToString";
import { CustomTimezone, isCustomTimezone } from "../../../util/isCustomTimezone";
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
                    .setRequired(false),
            ),
    async execute(interaction: ChatInputCommandInteraction) {
        const tz = interaction.options.getString("timezone");
        if (tz == null) {
            const currentValue = await getUserConfig(interaction.user.id, <const>["timezone"]);
            const value = currentValue.timezone == null ?
                "unset" : `\`${currentValue.timezone}\``;

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [successEmbed(
                    interaction.client,
                    "Timezone configuration",
                    "Set your local timezone.",
                ).addFields({
                    name: "Current value",
                    value: value,
                })],
            });
            return;
        }

        let parsed: (DisplayFormat)[] | CustomTimezone = soft(tz);

        if (parsed.length === 0) {
            // Attempt to parse out a time offset
            const offsetMatch = tz.match(/^(?:UTC|UCT|GMT)?([+-])?(\d{1,2})(?::(\d{1,2}))?$/i);

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

        const privacyWarning = "\n\n-# **IMPORTANT:** Your timezone is not private and others may be able to guess your vague location based on your timezone or the times sent by the bot. If you are concerned about your privacy, consider setting your timezone to UTC and performing timezone conversions manually.";

        if (!parsed) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [
                    errorEmbed(
                        interaction.client,
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

            description += privacyWarning;

            await setUserConfig(interaction.user.id, "timezone", isCustom ?
                timezone.name.replace(/^UTC+/, "") :
                timezone.iana,
            );

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [
                    successEmbed(
                        interaction.client,
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
            }${privacyWarning}`;

            await setUserConfig(interaction.user.id, "timezone", timezone.iana);
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [
                    successEmbed(
                        interaction.client,
                        "Timezone set",
                        description,
                    ),
                ],
            });
        }
    },
};
