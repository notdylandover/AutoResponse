const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ApplicationIntegrationType } = require("discord.js");
const { ErrorEmbed, Leaderboard } = require("../../utils/embeds");
const { Error } = require("../../utils/logging");
const { RANKS, EMOJIS } = require("../../utils/constants");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Display the leaderboard of members who received the most replies")
        .addStringOption(option => option
            .setName("season")
            .setDescription("Specify a season for the leaderboard")
            .setRequired(true)
            .addChoices(
                { name: "Current", value: "current" },
                { name: "Season 2", value: "Season2" },
                { name: "Season 1", value: "Season1" }
            )
        )
        .setContexts(InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
    async execute(interaction) {
        try {
            const season = interaction.options.getString("season");
            const leaderboard = await loadLeaderboard(season);

            if (leaderboard.length === 0) {
                const emptyEmbed = ErrorEmbed(`Leaderboard is empty.`);
                return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
            }

            const sortedLeaderboard = leaderboard.sort(
                (a, b) => b.replies - a.replies
            );
            const topEntries = sortedLeaderboard.slice(0, 10);

            const leaderboardFields = topEntries.map((entry, index) => {
                const medals = ["🥇", "🥈", "🥉"];
                const medal = index < 3 ? medals[index] : `**${index + 1}th**`;

                const groups = entry.groups ? entry.groups.split(",").map((group) => group.trim()) : [];
                const owner = groups.includes("Owner") ? EMOJIS.ActiveDeveloper : "";
                const programmer = groups.includes("Programmer") ? EMOJIS.ico_wrench : "";
                const helper = groups.includes("Helper") ? EMOJIS.ico_helper : "";
                const s1winner = groups.includes("S1W") ? EMOJIS.Season_1_Winner : "";
                const s2winner = groups.includes("S2W") ? EMOJIS.Season_2_Winner : "";

                return {
                    name: `${medal} - ${entry.username} ${owner} ${programmer} ${helper} ${s1winner} ${s2winner}`,
                    value: `**${entry.replies} replies**`,
                    inline: false,
                };
            });

            let description = "";

            if (season === "current") {
                description = "This is the current leaderboard.";
            } else {
                description = "You are currently viewing an older leaderboard.";
            }

            const leaderboardEmbed = Leaderboard(`Leaderboard - ${season}`, description, leaderboardFields);
            await interaction.reply({ embeds: [leaderboardEmbed], ephemeral: true });
        } catch (error) {
            Error(`Error executing ${interaction.commandName}: ${error.stack}`);

            const errorEmbed = ErrorEmbed(`Error executing ${interaction.commandName}:\n${error.stack}`);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};

async function loadLeaderboard(season) {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, "..", "..", "data", "leaderboards.db");
        const db = new sqlite3.Database(
            dbPath,
            sqlite3.OPEN_READONLY,
            (err) => {
                if (err) {
                    Error(`Error connecting to the database: ${err.message}`);
                    reject([]);
                }
            }
        );

        const tableName = season === "current" ? "current" : season;
        const query = `SELECT username, replies, groups FROM ${tableName}`;

        db.all(query, [], (err, rows) => {
            if (err) {
                Error(`Error querying the database: ${err}`);
                db.close();
                reject([]);
            } else {
                resolve(
                    rows.map((row) => ({
                        username: row.username,
                        replies: row.replies,
                        groups: row.groups,
                    }))
                );
                db.close();
            }
        });
    });
}
