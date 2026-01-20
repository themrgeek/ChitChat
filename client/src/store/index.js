import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      termsAccepted: false,
      loading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user, error: null }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error, loading: false }),

      acceptTerms: () => {
        set({ termsAccepted: true });
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "doot-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        termsAccepted: state.termsAccepted,
      }),
    },
  ),
);

export const useChatStore = create((set, get) => ({
  socket: null,
  connected: false,
  currentSession: null,
  messages: [],
  contacts: [],
  typingUsers: new Set(),

  setSocket: (socket) => set({ socket }),

  setConnected: (connected) => set({ connected }),

  setCurrentSession: (session) =>
    set({ currentSession: session, messages: [] }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessageStatus: (messageId, status) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.messageId === messageId ? { ...msg, status } : msg,
      ),
    })),

  setTypingUser: (avatarName, isTyping) =>
    set((state) => {
      const newTypingUsers = new Set(state.typingUsers);
      if (isTyping) {
        newTypingUsers.add(avatarName);
      } else {
        newTypingUsers.delete(avatarName);
      }
      return { typingUsers: newTypingUsers };
    }),

  clearMessages: () => set({ messages: [] }),

  endSession: () => set({ currentSession: null, messages: [] }),

  addContact: (contact) =>
    set((state) => {
      const exists = state.contacts.find(
        (c) => c.avatarName === contact.avatarName,
      );
      if (exists) return state;
      return { contacts: [...state.contacts, contact] };
    }),

  updateContactStatus: (avatarName, isOnline) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.avatarName === avatarName ? { ...c, isOnline } : c,
      ),
    })),
}));

export const useUIStore = create((set) => ({
  view: "auth", // auth, terms, main, chat
  sidebarOpen: false,
  showSafe: false,
  toast: null,

  setView: (view) => set({ view }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSafe: () => set((state) => ({ showSafe: !state.showSafe })),

  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  hideToast: () => set({ toast: null }),
}));
