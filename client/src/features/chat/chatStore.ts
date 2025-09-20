import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ChatRole = "assistant" | "user" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

type ChatState = {
  /** Berichten per thread-key (bijv. "today") */
  byThread: Record<string, ChatMessage[]>;
  setThreadMessages: (threadKey: string, msgs: ChatMessage[]) => void;
  appendToThread: (threadKey: string, msg: ChatMessage) => void;
  clearThread: (threadKey: string) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      byThread: {},
      setThreadMessages: (threadKey, msgs) =>
        set((s) => ({ byThread: { ...s.byThread, [threadKey]: msgs } })),
      appendToThread: (threadKey, msg) => {
        const cur = get().byThread[threadKey] ?? [];
        set((s) => ({ byThread: { ...s.byThread, [threadKey]: [...cur, msg] } }));
      },
      clearThread: (threadKey) =>
        set((s) => {
          const copy = { ...s.byThread };
          delete copy[threadKey];
          return { byThread: copy };
        }),
    }),
    {
      name: "noukie-chat", // localStorage key
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Optioneel: migraties als je later het schema wijzigt
    }
  )
);
