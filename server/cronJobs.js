import cron from 'node-cron';
import { calendarImporter } from './calendarImport';
export class CronJobManager {
    isRunning = false;
    // Start all scheduled jobs
    start() {
        if (this.isRunning) {
            console.log('Cron jobs already running');
            return;
        }
        // Daily calendar sync at 6:00 AM
        cron.schedule('0 6 * * *', async () => {
            console.log('🔄 Starting daily calendar import...');
            await this.runCalendarSync();
        }, {
            timezone: "Europe/Amsterdam"
        });
        // Test sync every 10 minutes (for development - remove in production)
        if (process.env.NODE_ENV === 'development') {
            cron.schedule('*/10 * * * *', async () => {
                console.log('🧪 Running test calendar sync (dev mode)...');
                await this.runCalendarSync();
            }, {
                timezone: "Europe/Amsterdam"
            });
        }
        this.isRunning = true;
        console.log('✅ Cron jobs started');
        console.log('📅 Daily calendar sync: 6:00 AM CET');
        if (process.env.NODE_ENV === 'development') {
            console.log('🧪 Test sync: Every 10 minutes (dev mode)');
        }
    }
    // Stop all scheduled jobs
    stop() {
        cron.getTasks().forEach(task => task.stop());
        this.isRunning = false;
        console.log('❌ Cron jobs stopped');
    }
    // Get all users with calendar integrations enabled
    async getUsersWithCalendarSync() {
        try {
            // Note: We'd need a method to get all users with calendar integrations
            // For now, we'll implement a basic version
            // TODO: Add getAllCalendarIntegrations method to storage
            // Placeholder - in a real implementation we'd query the database
            return [];
        }
        catch (error) {
            console.error('Failed to get users with calendar sync:', error);
            return [];
        }
    }
    // Run calendar sync for all enabled users
    async runCalendarSync() {
        try {
            const userIds = await this.getUsersWithCalendarSync();
            if (userIds.length === 0) {
                console.log('📭 No users with calendar sync enabled');
                return;
            }
            console.log(`📥 Syncing calendars for ${userIds.length} users`);
            let totalImported = 0;
            let totalErrors = 0;
            // Process users sequentially to avoid rate limits
            for (const userId of userIds) {
                try {
                    const result = await calendarImporter.importEventsForUser(userId);
                    totalImported += result.imported;
                    totalErrors += result.errors.length;
                    if (result.imported > 0) {
                        console.log(`✅ User ${userId}: ${result.imported} events imported`);
                    }
                    if (result.errors.length > 0) {
                        console.log(`⚠️ User ${userId}: ${result.errors.length} errors`);
                    }
                    // Small delay to be nice to Google's API
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                catch (userError) {
                    console.error(`❌ Failed to sync calendar for user ${userId}:`, userError);
                    totalErrors++;
                }
            }
            console.log(`📊 Calendar sync complete: ${totalImported} total imported, ${totalErrors} errors`);
        }
        catch (error) {
            console.error('❌ Calendar sync job failed:', error);
        }
    }
    // Manual trigger for calendar sync (useful for testing)
    async triggerCalendarSync() {
        console.log('🚀 Manually triggering calendar sync...');
        await this.runCalendarSync();
    }
    // Get status of cron jobs
    getStatus() {
        return {
            running: this.isRunning,
            tasks: cron.getTasks().size,
            nextRuns: Array.from(cron.getTasks().values()).map(task => ({
                running: task.running,
                // Note: Getting next run time would require additional cron package features
            }))
        };
    }
}
export const cronManager = new CronJobManager();
