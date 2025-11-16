import { supabase } from "./db";
export class PostgresStorage {
    // Users
    async getUser(id) {
        const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
        if (error && error.code !== "PGRST116")
            throw error;
        return data || undefined;
    }
    async getUserByEmail(email) {
        const { data, error } = await supabase.from("users").select("*").eq("email", email).single();
        if (error && error.code !== "PGRST116")
            throw error;
        return data || undefined;
    }
    async createUser(user) {
        const { data, error } = await supabase.from("users").insert(user).select().single();
        if (error)
            throw error;
        return data;
    }
    // Courses
    async getCoursesByUserId(userId) {
        const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId);
        if (error)
            throw error;
        return data || [];
    }
    async createCourse(course) {
        const { data, error } = await supabase.from("courses").insert(course).select().single();
        if (error)
            throw error;
        return data;
    }
    async deleteCourse(id) {
        const { error } = await supabase.from("courses").delete().eq("id", id);
        if (error)
            throw error;
    }
    // Schedule
    async getScheduleByUserId(userId) {
        const { data, error } = await supabase.from("schedule").select("*").eq("user_id", userId);
        if (error)
            throw error;
        return data || [];
    }
    async getScheduleByDay(userId, dayOfWeek) {
        const { data, error } = await supabase
            .from("schedule")
            .select("*")
            .eq("user_id", userId)
            .eq("day_of_week", dayOfWeek);
        if (error)
            throw error;
        return data || [];
    }
    async createScheduleItem(scheduleItem) {
        const { data, error } = await supabase.from("schedule").insert(scheduleItem).select().single();
        if (error)
            throw error;
        return data;
    }
    async deleteScheduleItem(id) {
        const { error } = await supabase.from("schedule").delete().eq("id", id);
        if (error)
            throw error;
    }
    async updateScheduleStatus(id, status) {
        const { error } = await supabase.from("schedule").update({ status }).eq("id", id);
        if (error)
            throw error;
    }
    // Tasks
    async getTasksByUserId(userId) {
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", userId)
            .order("priority", { ascending: false })
            .order("due_at", { ascending: true });
        if (error)
            throw error;
        return data || [];
    }
    async getTodayTasks(userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", userId)
            .gte("due_at", today.toISOString())
            .lt("due_at", tomorrow.toISOString())
            .order("priority", { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async getTasksByDateRange(userId, startDate, endDate) {
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", userId)
            .gte("due_at", startDate.toISOString())
            .lte("due_at", endDate.toISOString())
            .order("priority", { ascending: false })
            .order("due_at", { ascending: true });
        if (error)
            throw error;
        return data || [];
    }
    async createTask(task) {
        const { data, error } = await supabase.from("tasks").insert(task).select().single();
        if (error)
            throw error;
        return data;
    }
    async updateTaskStatus(id, status) {
        const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
        if (error)
            throw error;
    }
    async deleteTask(id) {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error)
            throw error;
    }
    // Sessions
    async getLastSession(userId) {
        const { data, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("user_id", userId)
            .order("happened_at", { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== "PGRST116")
            throw error;
        return data || undefined;
    }
    async getTodaySession(userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const { data, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("user_id", userId)
            .gte("happened_at", today.toISOString())
            .lt("happened_at", tomorrow.toISOString())
            .limit(1)
            .single();
        if (error && error.code !== "PGRST116")
            throw error;
        return data || undefined;
    }
    async createSession(session) {
        const { data, error } = await supabase.from("sessions").insert(session).select().single();
        if (error)
            throw error;
        return data;
    }
    // Materials
    async createMaterial(material) {
        const { data, error } = await supabase.from("materials").insert(material).select().single();
        if (error)
            throw error;
        return data;
    }
    // Quiz Results
    async createQuizResult(result) {
        const { data, error } = await supabase.from("quiz_results").insert(result).select().single();
        if (error)
            throw error;
        return data;
    }
    // Parent-Child Relationships
    async createParentChildRelationship(relationship) {
        const { data, error } = await supabase.from("parent_child_relationships").insert(relationship).select().single();
        if (error)
            throw error;
        return data;
    }
    async getChildrenByParentId(parentId) {
        const { data, error } = await supabase
            .from("parent_child_relationships")
            .select("*")
            .eq("parent_id", parentId);
        if (error)
            throw error;
        return data || [];
    }
    async findChildByEmail(childEmail) {
        const { data, error } = await supabase.from("users").select("*").eq("email", childEmail).single();
        if (error && error.code !== "PGRST116")
            throw error;
        return data || undefined;
    }
    async confirmRelationship(relationshipId) {
        const { error } = await supabase
            .from("parent_child_relationships")
            .update({ is_confirmed: true })
            .eq("id", relationshipId);
        if (error)
            throw error;
    }
    async getPendingParentRequests(childId) {
        const { data, error } = await supabase
            .from("parent_child_relationships")
            .select("*")
            .eq("child_id", childId)
            .eq("is_confirmed", false);
        if (error)
            throw error;
        return data || [];
    }
    // Calendar Integrations
    async getCalendarIntegration(userId) {
        const { data, error } = await supabase.from("calendar_integrations").select("*").eq("user_id", userId).single();
        if (error && error.code !== "PGRST116")
            throw error;
        return data || undefined;
    }
    async createCalendarIntegration(integration) {
        const { data, error } = await supabase.from("calendar_integrations").insert(integration).select().single();
        if (error)
            throw error;
        return data;
    }
    async updateCalendarIntegration(userId, updates) {
        const { error } = await supabase.from("calendar_integrations").update(updates).eq("user_id", userId);
        if (error)
            throw error;
    }
    async deleteCalendarIntegration(userId) {
        const { error } = await supabase.from("calendar_integrations").delete().eq("user_id", userId);
        if (error)
            throw error;
    }
    // Imported Events
    async getImportedEvent(userId, externalId) {
        const { data, error } = await supabase
            .from("imported_events")
            .select("*")
            .eq("user_id", userId)
            .eq("external_id", externalId)
            .single();
        if (error && error.code !== "PGRST116")
            throw error;
        return data || undefined;
    }
    async createImportedEvent(event) {
        const { data, error } = await supabase.from("imported_events").insert(event).select().single();
        if (error)
            throw error;
        return data;
    }
    async getImportedEventsByUserId(userId) {
        const { data, error } = await supabase.from("imported_events").select("*").eq("user_id", userId);
        if (error)
            throw error;
        return data || [];
    }
}
export const storage = new PostgresStorage();
