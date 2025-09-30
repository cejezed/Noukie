import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { CalendarIntegration, InsertCalendarIntegration, InsertSchedule, InsertImportedEvent } from '@shared/schema';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('Google Calendar credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
}

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }

  // Get OAuth authorization URL
  getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId to identify user after redirect
    });
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return {
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
    };
  }

  // Set credentials for API calls
  setCredentials(integration: CalendarIntegration) {
    this.oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.tokenExpires ? new Date(integration.tokenExpires).getTime() : undefined,
    });
  }

  // Refresh access token if needed
  async refreshTokenIfNeeded(integration: CalendarIntegration): Promise<CalendarIntegration | null> {
    if (!integration.refreshToken) return null;

    const now = new Date();
    const expiryTime = integration.tokenExpires ? new Date(integration.tokenExpires) : new Date(0);

    // Refresh if token expires within next 5 minutes
    if (expiryTime.getTime() - now.getTime() > 5 * 60 * 1000) {
      return integration; // Token still valid
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: integration.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      return {
        ...integration,
        accessToken: credentials.access_token || integration.accessToken,
        tokenExpires: credentials.expiry_date ? new Date(credentials.expiry_date) : integration.tokenExpires,
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }

  // Get user's primary calendar ID
  async getPrimaryCalendarId(): Promise<string> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    const response = await calendar.calendarList.list();

    const primaryCalendar = response.data.items?.find(cal => cal.primary);
    return primaryCalendar?.id || 'primary';
  }

  // Get events from Google Calendar
  async getEvents(calendarId: string = 'primary', daysAhead: number = 7): Promise<any[]> {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + daysAhead);

      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Failed to fetch Google Calendar events:', error);
      throw error;
    }
  }

  // Convert Google Calendar event to Anouk schedule format
  convertEventToSchedule(event: any, userId: string): InsertSchedule {
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;

    // Parse dates
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Determine activity type based on event summary and description
    const title = event.summary || 'Google Calendar Event';
    const description = event.description || '';
    const kind = this.categorizeEvent(title, description);

    // For all-day events, don't set times
    const isAllDay = !event.start?.dateTime;

    return {
      userId,
      courseId: null, // We don't auto-assign courses
      dayOfWeek: isAllDay ? null : startDate.getDay() || 7, // Convert 0=Sunday to 7
      startTime: isAllDay ? null : this.formatTime(startDate),
      endTime: isAllDay ? null : this.formatTime(endDate),
      kind,
      title,
      date: isAllDay ? this.formatDate(startDate) : null, // All-day events use date field
      isRecurring: this.isRecurringEvent(event),
    };
  }

  // Smart categorization of Google Calendar events
  private categorizeEvent(title: string, description: string): "les" | "toets" | "sport" | "werk" | "afspraak" | "hobby" | "anders" {
    const text = `${title} ${description}`.toLowerCase();

    // Sports keywords
    if (text.match(/\b(sport|training|hockey|voetbal|tennis|fitness|gym|zwemmen|hardlopen|basketbal|volleyball)\b/)) {
      return 'sport';
    }

    // Work keywords
    if (text.match(/\b(werk|job|bijbaan|stage|werken|dienst|shift)\b/)) {
      return 'werk';
    }

    // School keywords
    if (text.match(/\b(les|school|toets|tentamen|examen|college|universiteit|klas)\b/)) {
      return text.match(/\b(toets|tentamen|examen)\b/) ? 'toets' : 'les';
    }

    // Appointment keywords
    if (text.match(/\b(afspraak|dokter|tandarts|kappers|consult|behandeling)\b/)) {
      return 'afspraak';
    }

    // Hobby keywords
    if (text.match(/\b(muziek|band|koor|theater|kunst|cursus|hobby)\b/)) {
      return 'hobby';
    }

    // Default to "anders"
    return 'anders';
  }

  private isRecurringEvent(event: any): boolean {
    return !!event.recurringEventId || !!event.recurrence;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  // Create imported event record to prevent duplicates
  createImportedEventRecord(event: any, scheduleId: string, userId: string): InsertImportedEvent {
    return {
      userId,
      scheduleId,
      externalId: event.id,
      provider: 'google',
      lastModified: event.updated ? new Date(event.updated) : new Date(),
    };
  }
}
