const { Error } = require('./logging');
const { DefaultWebSocketManagerOptions: { identifyProperties } } = require("@discordjs/ws");

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let activityIndex = 0;

// Discord iOS
// Discord Android
// null = Discord Desktop

identifyProperties.browser = 'Discord Desktop';

module.exports = async (client) => {
    try {
        const dbPath = path.join(__dirname, "..", "data", "leaderboards.db");
        const db = new sqlite3.Database(dbPath);

        const getTablesQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;

        db.all(getTablesQuery, [], (err, tables) => {
            if (err) {
                return Error(`Error retrieving tables: ${err.message}`);
            }

            if (tables.length === 0) {
                Error(`No tables found in the database.`);
                db.close();
                return;
            }

            let totalReplies = 0;
            let uniqueUsers = new Set();
            let processedTables = 0;

            tables.forEach((table) => {
                const repliesQuery = `SELECT SUM(replies) AS sumReplies FROM ${table.name}`;
                db.get(repliesQuery, [], (err, row) => {
                    if (err) {
                        Error(`Error querying replies in table ${table.name}: ${err.message}`);
                    } else {
                        totalReplies += row.sumReplies || 0;
                    }

                    const usersQuery = `SELECT username FROM ${table.name}`;

                    db.all(usersQuery, [], (err, rows) => {
                        if (err) {
                            Error(`Error querying users in table ${table.name}: ${err.message}`);
                        } else {
                            rows.forEach(row => {
                                uniqueUsers.add(row.username);
                            });
                        }

                        processedTables++;
                        if (processedTables === tables.length) {
                            const activities = [
                                `${totalReplies} replies`,
                                `${uniqueUsers.size} users`
                            ];

                            client.user.setPresence({
                                activities: [
                                    {
                                        name: activities[activityIndex],
                                        type: 4
                                    }
                                ],
                                status: "online"
                            });

                            activityIndex = (activityIndex + 1) % activities.length;
                            db.close();
                        }
                    });
                });
            });
        });
    } catch (error) {
        Error(`Error updating presence: ${error.message}`);
    }
};