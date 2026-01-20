import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore, useUIStore } from "./store";
import socketService from "./services/socket";
import TermsModal from "./components/TermsModal";
import AuthView from "./components/auth/AuthView";
import MainView from "./components/main/MainView";
import ChatView from "./components/chat/ChatView";
import Toast from "./components/ui/Toast";

function App() {
  const { isAuthenticated, termsAccepted } = useAuthStore();
  const { toast } = useUIStore();

  useEffect(() => {
    // Connect socket when authenticated
    if (isAuthenticated) {
      socketService.connect();
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
      <>
        <TermsModal />
        {toast && <Toast message={toast.message} type={toast.type} />}
      </>
    );
  }

  return (
    <BrowserRouter>
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
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    </BrowserRouter>
  );
}

export default App;
