import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { useAuthStore, useUIStore, useChatStore } from "./store";
import socketService from "./services/socket";
import webrtcService from "./services/webrtc";
import Toast from "./components/ui/Toast";

// ⚡ PERFORMANCE: Lazy load heavy components
const TermsModal = lazy(() => import("./components/TermsModal"));
const AuthView = lazy(() => import("./components/auth/AuthView"));
const MainView = lazy(() => import("./components/main/MainView"));
const ChatView = lazy(() => import("./components/chat/ChatView"));
const CallComponents = lazy(() => import("./components/CallView"));

// ⚡ Minimal loading fallback
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-cyber-dark">
    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ⚡ Lazy load call components
const IncomingCallModal = lazy(() => 
  import("./components/CallView").then(m => ({ default: m.IncomingCallModal }))
);
const ActiveCallView = lazy(() => 
  import("./components/CallView").then(m => ({ default: m.ActiveCallView }))
);

function App() {
  const { isAuthenticated, termsAccepted } = useAuthStore();
  const { toast } = useUIStore();
  const { incomingCall, activeCall } = useChatStore();

  useEffect(() => {
    // ⚡ Pre-warm API connection
    if (typeof window !== 'undefined') {
      import('./services/api').then(({ api }) => api.warmConnection?.());
    }
    
    // Connect socket when authenticated
    if (isAuthenticated) {
      const socket = socketService.connect();
      // Initialize WebRTC with socket
      webrtcService.setSocket(socket);
    }

    return () => {
      if (!isAuthenticated) {
        socketService.disconnect();
      }
    };
  }, [isAuthenticated]);

  // Show terms if not accepted
  if (!termsAccepted) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TermsModal />
        {toast && <Toast message={toast.message} type={toast.type} />}
      </Suspense>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <div className="min-h-screen min-h-[100dvh] flex flex-col bg-cyber-dark">
          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? <Navigate to="/app" replace /> : <AuthView />
              }
            />
            <Route
              path="/app"
              element={
                isAuthenticated ? <MainView /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="/chat"
              element={
                isAuthenticated ? <ChatView /> : <Navigate to="/" replace />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Call UI - overlays everything */}
          {incomingCall && (
            <Suspense fallback={null}>
              <IncomingCallModal />
            </Suspense>
          )}
          {activeCall && (
            <Suspense fallback={null}>
              <ActiveCallView />
            </Suspense>
          )}

          {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
