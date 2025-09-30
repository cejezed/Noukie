import { GoogleCalendarService } from './googleCalendar';
import { storage } from './storage';
import type { CalendarIntegration, InsertSchedule, InsertImportedEvent } from '@shared/schema';

export class CalendarImportService {
  private googleCalendar: GoogleCalendarService;

  constructor() {
    this.googleCalendar = new GoogleCalendarService();
  }

  // Import events for a specific user
  async importEventsForUser(userId: string): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[]
    };

    try {
      // Get user's calendar integration
      const integration = await storage.getCalendarIntegration(userId);
      if (!integration || !integration.syncEnabled) {
        results.errors.push('No calendar integration found or sync disabled');
        return results;
      }

      // Refresh token if needed
      const refreshedIntegration = await this.googleCalendar.refreshTokenIfNeeded(integration);
      if (!refreshedIntegration) {
        results.errors.push('Failed to refresh calendar tokens');
        return results;
      }

      // Update tokens if they were refreshed
      if (refreshedIntegration !== integration) {
        await storage.updateCalendarIntegration(userId, {
          accessToken: refreshedIntegration.accessToken,
          tokenExpires: refreshedIntegration.tokenExpires,
        });
      }

      // Set credentials and get events
      this.googleCalendar.setCredentials(refreshedIntegration);
      const calendarId = integration.calendarId || await this.googleCalendar.getPrimaryCalendarId();
      const googleEvents = await this.googleCalendar.getEvents(calendarId, 14); // Import 2 weeks ahead

      console.log(`Found ${googleEvents.length} Google Calendar events for user ${userId}`);

      // Process each event
      for (const googleEvent of googleEvents) {
        try {
          // Skip events without ID
          if (!googleEvent.id) {
            results.skipped++;
            continue;
          }

          // Check if already imported
          const existingImport = await storage.getImportedEvent(userId, googleEvent.id);
          if (existingImport) {
            // Check if event was updated
            const eventUpdated = new Date(googleEvent.updated || googleEvent.created);
            const lastImported = existingImport.lastModified || new Date(0);

            if (eventUpdated <= lastImported) {
              results.skipped++;
              continue; // Event hasn't changed, skip
            }
          }

          // Convert Google event to Anouk schedule format
          const scheduleData = this.googleCalendar.convertEventToSchedule(googleEvent, userId);

          // Create or update schedule item
          const scheduleItem = await storage.createScheduleItem(scheduleData);

          // Create or update imported event record
          const importedEventData = this.googleCalendar.createImportedEventRecord(
            googleEvent,
            scheduleItem.id,
            userId
          );

          if (existingImport) {
            // Update existing import record (we'd need an update method)
            // For now, we'll skip updating existing records
            results.skipped++;
          } else {
            await storage.createImportedEvent(importedEventData);
            results.imported++;
          }

          console.log(`Imported: ${googleEvent.summary} (${scheduleData.kind})`);

        } catch (eventError) {
          console.error(`Error processing event ${googleEvent.id}:`, eventError);
          results.errors.push(`Event ${googleEvent.summary || googleEvent.id}: ${eventError}`);
        }
      }

      // Update last sync time
      await storage.updateCalendarIntegration(userId, {
        lastSyncAt: new Date()
      });

      console.log(`Import complete for user ${userId}: ${results.imported} imported, ${results.skipped} skipped`);

    } catch (error) {
      console.error(`Calendar import failed for user ${userId}:`, error);
      results.errors.push(`Import failed: ${error}`);
    }

    return results;
  }

  // Import for all users with enabled calendar sync
  async importForAllUsers(): Promise<void> {
    try {
      // Note: We'd need to add a method to get all users with calendar integrations
      // For now, this is a placeholder for the cron job
      console.log('Running calendar import for all users...');

      // This would iterate through all users with calendar integrations enabled
      // and call importEventsForUser for each

    } catch (error) {
      console.error('Batch calendar import failed:', error);
    }
  }

  // Test import for a user (useful for debugging)
  async testImport(userId: string): Promise<any> {
    console.log(`Testing calendar import for user ${userId}`);
    return await this.importEventsForUser(userId);
  }
}

export const calendarImporter = new CalendarImportService();
