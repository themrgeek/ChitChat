import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      termsAccepted: false,
      loading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user, error: null }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error, loading: false }),
      acceptTerms: () => set({ termsAccepted: true }),
      logout: () => set({ user: null, isAuthenticated: false, error: null }),
      clearError: () => set({ error: null }),
    }),
    {
      name: "doot-auth",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useChatStore = create((set) => ({
  socket: null,
  connected: false,
  currentSession: null,
  messages: [],
  typingUsers: [],

  // Call state
  activeCall: null,
  callStatus: null,
  incomingCall: null,
  localStream: null,
  remoteStream: null,

  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  setCurrentSession: (session) =>
    set({ currentSession: session, messages: [] }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessageStatus: (messageId, status) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.messageId === messageId ? { ...msg, status } : msg,
      ),
    })),

  setTypingUser: (avatarName, isTyping) =>
    set((state) => {
      const newTypingUsers = isTyping
        ? [...state.typingUsers, avatarName]
        : state.typingUsers.filter((u) => u !== avatarName);
      return { typingUsers: [...new Set(newTypingUsers)] };
    }),

  clearMessages: () => set({ messages: [] }),
  endSession: () => set({ currentSession: null, messages: [] }),

  // Call actions
  setActiveCall: (call) => set({ activeCall: call }),
  setCallStatus: (status) => set({ callStatus: status }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
}));

export const useUIStore = create((set) => ({
  toast: null,

  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  hideToast: () => set({ toast: null }),
}));
