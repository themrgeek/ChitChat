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
  onlineUsers: [], // List of online users for conference invites

  // Call state
  activeCall: null,
  callStatus: null, // null, 'calling', 'ringing', 'connecting', 'connected', 'creating'
  incomingCall: null,
  localStream: null,
  remoteStream: null,
  remoteMediaState: { audio: true, video: true },
  connectionQuality: null, // null, 'excellent', 'good', 'fair', 'poor', 'disconnected'

  // Conference state
  callParticipants: [], // Array of avatar names in conference
  remoteStreams: {}, // Map of avatarName -> MediaStream for conference
  participantMediaStates: {}, // Map of avatarName -> { audio: bool, video: bool }

  setSocket: (socket) => set({ socket }),

  setConnected: (connected) => set({ connected }),

  setOnlineUsers: (users) => set({ onlineUsers: users }),

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

  // Call actions
  setActiveCall: (call) => set({ activeCall: call }),
  setCallStatus: (status) => set({ callStatus: status }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setConnectionQuality: (quality) => set({ connectionQuality: quality }),

  // Conference actions
  setCallParticipants: (participants) =>
    set({ callParticipants: participants }),
  setRemoteStreams: (streams) => set({ remoteStreams: streams }),

  updateRemoteMediaState: (mediaType, enabled, avatarName = null) =>
    set((state) => {
      if (avatarName) {
        // Conference: update specific participant
        const participantStates = { ...state.participantMediaStates };
        if (!participantStates[avatarName]) {
          participantStates[avatarName] = { audio: true, video: true };
        }
        participantStates[avatarName][mediaType] = enabled;
        return { participantMediaStates: participantStates };
      } else {
        // 1:1 call
        return {
          remoteMediaState: { ...state.remoteMediaState, [mediaType]: enabled },
        };
      }
    }),

  // Reset call state
  resetCallState: () =>
    set({
      activeCall: null,
      callStatus: null,
      incomingCall: null,
      localStream: null,
      remoteStream: null,
      remoteMediaState: { audio: true, video: true },
      connectionQuality: null,
      callParticipants: [],
      remoteStreams: {},
      participantMediaStates: {},
    }),
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
