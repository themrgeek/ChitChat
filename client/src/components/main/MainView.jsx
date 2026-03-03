import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Phone,
  LogOut,
  User,
  Shield,
  Wifi,
  WifiOff,
  Users,
} from "lucide-react";
import { useAuthStore, useChatStore, useUIStore } from "../../store";
import socketService from "../../services/socket";

export default function MainView() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { connected } = useChatStore();
  const { showToast } = useUIStore();

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    navigate("/");
    showToast("Logged out successfully", "info");
  };

  const handleChat = () => {
    navigate("/chat");
  };

  const handleCall = () => {
    navigate("/chat?mode=call");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-3 py-4 sm:p-4 safe-top safe-bottom">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-900/30 border border-primary-700 mb-3 sm:mb-4">
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-primary-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold glow-text mb-2">Welcome</h1>
          <p className="text-sm sm:text-base text-primary-500 font-mono truncate max-w-full">{user?.avatarName}</p>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {connected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-500">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-500">Connecting...</span>
              </>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="cyber-card animate-fade-in">
          <h2 className="text-base sm:text-lg font-semibold text-primary-500 mb-3 sm:mb-4 text-center">
            Select Communication Type
          </h2>

          <div className="space-y-3">
            <button
              onClick={handleChat}
              className="terminal-btn flex items-center justify-center gap-2 sm:gap-3"
            >
              <MessageSquare className="w-5 h-5 flex-shrink-0" />
              CHAT
            </button>

            <button
              onClick={handleCall}
              className="terminal-btn flex items-center justify-center gap-2 sm:gap-3 flex-wrap"
            >
              <Phone className="w-5 h-5 flex-shrink-0" />
              CALL
              <span className="text-xs bg-primary-500/20 px-1.5 sm:px-2 py-0.5 rounded text-primary-400">
                Audio / Video
              </span>
            </button>

            <button
              onClick={() => navigate("/chat?mode=conference")}
              className="terminal-btn flex items-center justify-center gap-2 sm:gap-3 flex-wrap"
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">CONFERENCE</span>
              <span className="text-xs bg-primary-500/20 px-1.5 sm:px-2 py-0.5 rounded text-primary-400">
                Group Call
              </span>
            </button>
          </div>

          {/* Security Info */}
          <div className="mt-4 sm:mt-6 p-2.5 sm:p-3 bg-primary-900/20 border border-primary-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-primary-600">End-to-End Encrypted</p>
                <p className="text-xs text-primary-700 mt-1">
                  All messages & calls are encrypted with AES-256. Keys are
                  generated locally.
                </p>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="terminal-btn-secondary mt-4 sm:mt-6 flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
