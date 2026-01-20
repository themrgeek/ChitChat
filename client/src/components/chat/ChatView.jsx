import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Lock,
  Wifi,
  WifiOff,
  Users,
  X,
  Download,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { useAuthStore, useChatStore, useUIStore } from "../../store";
import socketService from "../../services/socket";
import cryptoService from "../../services/crypto";

export default function ChatView() {
  const navigate = useNavigate();
  const [showSessionSetup, setShowSessionSetup] = useState(true);
  const [targetAvatar, setTargetAvatar] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [message, setMessage] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { user } = useAuthStore();
  const {
    connected,
    currentSession,
    messages,
    typingUsers,
    clearMessages,
    endSession,
  } = useChatStore();
  const { showToast } = useUIStore();

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Hide session setup when connected
  useEffect(() => {
    if (currentSession) {
      setShowSessionSetup(false);
    }
  }, [currentSession]);

  const handleRequestSession = (e) => {
    e.preventDefault();
    if (!targetAvatar || !secretCode) {
      showToast("Please enter both avatar name and secret code", "error");
      return;
    }
    socketService.requestSession(targetAvatar, secretCode);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    socketService.sendMessage(message.trim());
    setMessage("");
    socketService.stopTyping();
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);

    // Handle typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socketService.startTyping();

    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping();
    }, 1000);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast("File size must be less than 10MB", "error");
        return;
      }
      socketService.sendFile(file);
    }
    e.target.value = "";
  };

  const handleEndSession = () => {
    endSession();
    setShowSessionSetup(true);
    setShowMenu(false);
    showToast("Session ended", "info");
  };

  const handleClearHistory = () => {
    clearMessages();
    setShowMenu(false);
    showToast("Chat history cleared", "info");
  };

  const handleBack = () => {
    if (currentSession) {
      handleEndSession();
    }
    navigate("/app");
  };

  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-cyber-dark">
      {/* Header */}
      <header className="flex-shrink-0 bg-cyber-darker border-b border-primary-900 px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-primary-900/30 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-primary-600" />
            </button>

            {currentSession ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-online"></span>
                  <span className="font-semibold text-primary-500">
                    {currentSession.peerAvatar}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary-700">
                  <Lock className="w-3 h-3" />
                  End-to-End Encrypted
                </div>
              </div>
            ) : (
              <span className="font-semibold text-primary-500">
                New Session
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status */}
            {connected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}

            {/* Menu */}
            {currentSession && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 hover:bg-primary-900/30 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-5 h-5 text-primary-600" />
                </button>

                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-cyber-darker border border-primary-900 rounded-lg shadow-xl z-20 overflow-hidden">
                      <button
                        onClick={handleClearHistory}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary-600 hover:bg-primary-900/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear History
                      </button>
                      <button
                        onClick={handleEndSession}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-900/30 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        End Session
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Session Setup */}
      {showSessionSetup && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="cyber-card w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <h2 className="font-semibold text-primary-500">
                  Establish Secure Session
                </h2>
                <p className="text-xs text-primary-700">
                  Connect with another DOOT user
                </p>
              </div>
            </div>

            <form onSubmit={handleRequestSession} className="space-y-4">
              <div>
                <label className="block text-sm text-primary-600 mb-2">
                  Friend's Avatar Name
                </label>
                <input
                  type="text"
                  value={targetAvatar}
                  onChange={(e) => setTargetAvatar(e.target.value)}
                  className="terminal-input"
                  placeholder="Enter avatar name"
                />
              </div>

              <div>
                <label className="block text-sm text-primary-600 mb-2">
                  Secret Code
                </label>
                <input
                  type="text"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  className="terminal-input"
                  placeholder="Enter shared secret code"
                />
              </div>

              <button
                type="submit"
                disabled={!connected}
                className="terminal-btn flex items-center justify-center gap-2"
              >
                <Lock className="w-5 h-5" />
                Connect Securely
              </button>
            </form>

            {!connected && (
              <p className="text-xs text-red-500 text-center mt-4">
                Waiting for server connection...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      {!showSessionSetup && currentSession && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {messages.length === 0 && (
              <div className="text-center text-primary-700 py-8">
                <Lock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Session established</p>
                <p className="text-xs mt-1">
                  Messages are end-to-end encrypted
                </p>
              </div>
            )}

            {messages.map((msg, index) => (
              <MessageBubble
                key={msg.messageId || index}
                message={msg}
                isOwn={msg.isSent}
              />
            ))}

            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
              <div className="flex items-center gap-2 text-primary-700">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
                <span className="text-xs">typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 bg-cyber-darker border-t border-primary-900 p-3 safe-bottom">
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 hover:bg-primary-900/30 rounded-lg transition-colors"
              >
                <Paperclip className="w-5 h-5 text-primary-600" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />

              <input
                type="text"
                value={message}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="flex-1 terminal-input py-3"
              />

              <button
                type="submit"
                disabled={!message.trim()}
                className="p-3 bg-primary-500 hover:bg-primary-400 disabled:bg-primary-900 disabled:text-primary-700 rounded-lg transition-colors"
              >
                <Send className="w-5 h-5 text-cyber-dark disabled:text-primary-700" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function MessageBubble({ message, isOwn }) {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const downloadFile = () => {
    if (message.fileData) {
      const blob = cryptoService.base64ToBlob(
        message.fileData,
        message.fileType,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = message.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={isOwn ? "message-sent" : "message-received"}>
        <div className="px-4 py-2">
          {!isOwn && (
            <p className="text-xs text-primary-600 font-semibold mb-1">
              {message.from}
            </p>
          )}

          {message.isFile ? (
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-primary-600" />
              <span className="text-sm">{message.fileName}</span>
              {message.fileData && (
                <button
                  onClick={downloadFile}
                  className="p-1 hover:bg-primary-900/50 rounded transition-colors"
                >
                  <Download className="w-4 h-4 text-primary-500" />
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm break-words">{message.message}</p>
          )}

          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-xs text-primary-700">
              {formatTime(message.timestamp)}
            </span>
            {isOwn && (
              <span className="text-xs text-primary-600">
                {message.status === "read" ? "✓✓" : "✓"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
