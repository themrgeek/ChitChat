import { useState } from "react";
import {
  User,
  UserPlus,
  LogIn,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Mail,
  Key,
  Shield,
} from "lucide-react";
import { useAuthStore, useUIStore } from "../../store";
import api from "../../services/api";

export default function AuthView() {
  const [mode, setMode] = useState("select"); // select, new, login, loginOTP
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [loginData, setLoginData] = useState({
    avatarName: "",
    password: "",
    email: "",
  });
  const [otp, setOtp] = useState("");
  const [copied, setCopied] = useState({});

  const { setUser, setError } = useAuthStore();
  const { showToast } = useUIStore();

  const handleNewUser = async () => {
    setLoading(true);
    try {
      const data = await api.createNewUser();
      setCredentials(data);
      setMode("new");
      // ⚡ Show response time
      showToast(`Identity created! ${data.responseTimeMs ? `(${data.responseTimeMs}ms)` : ''}`, "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginData.avatarName || !loginData.password) {
      showToast("Please enter both avatar name and password", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(loginData.avatarName, loginData.password);

      // ⚡ FAST: Use email from login response (no extra API call!)
      setLoginData((prev) => ({ ...prev, email: data.email }));
      
      // ⚡ DEV: Auto-fill OTP if returned (for instant testing)
      if (data.otp) {
        setOtp(data.otp);
      }

      setMode("loginOTP");
      showToast(`OTP sent! ${data.responseTimeMs ? `(${data.responseTimeMs}ms)` : ''}`, "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOTP = async (e) => {
    e.preventDefault();
    if (!otp) {
      showToast("Please enter the OTP", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api.verifyLoginOTP(
        loginData.email,
        loginData.avatarName,
        otp,
      );

      setUser({
        avatarName: data.avatarName,
        publicKey: data.publicKey,
      });

      showToast(`Welcome back, ${data.avatarName}!`, "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [field]: true });
    setTimeout(() => setCopied({ ...copied, [field]: false }), 2000);
  };

  const proceedToLogin = () => {
    if (credentials) {
      setLoginData({
        avatarName: credentials.avatarName,
        password: credentials.password,
        email: credentials.etherealEmail,
      });
    }
    setMode("login");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-900/30 border border-primary-700 mb-4 animate-pulse-glow">
            <User className="w-10 h-10 text-primary-500" />
          </div>
          <h1 className="text-3xl font-bold glow-text mb-2">DOOT</h1>
          <p className="text-primary-700">
            Fully Un-traceable Secure Messaging
          </p>
        </div>

        {/* Selection Mode */}
        {mode === "select" && (
          <div className="cyber-card animate-fade-in">
            <h2 className="text-lg font-semibold text-primary-500 mb-4 text-center">
              Choose Your Path
            </h2>
            <p className="text-sm text-primary-700 text-center mb-6">
              Select how you'd like to proceed with your secure identity
            </p>

            <div className="space-y-3">
              <button
                onClick={handleNewUser}
                disabled={loading}
                className="terminal-btn flex items-center justify-center gap-3"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
                NEW USER - Create Identity
              </button>

              <button
                onClick={() => setMode("login")}
                disabled={loading}
                className="terminal-btn-secondary flex items-center justify-center gap-3"
              >
                <LogIn className="w-5 h-5" />
                EXISTING USER - Login
              </button>
            </div>
          </div>
        )}

        {/* New User Credentials */}
        {mode === "new" && credentials && (
          <div className="cyber-card animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setMode("select")}
                className="p-2 hover:bg-primary-900/30 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-primary-600" />
              </button>
              <h2 className="text-lg font-semibold text-primary-500">
                Your Secure Identity
              </h2>
            </div>

            <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-400">
                ✅ Identity created! Save these credentials securely.
              </p>
            </div>

            <div className="space-y-4">
              <CredentialField
                label="Avatar Name"
                value={credentials.avatarName}
                icon={<User className="w-4 h-4" />}
                onCopy={() => copyToClipboard(credentials.avatarName, "avatar")}
                copied={copied.avatar}
              />

              <CredentialField
                label="Password"
                value={credentials.password}
                icon={<Key className="w-4 h-4" />}
                onCopy={() => copyToClipboard(credentials.password, "password")}
                copied={copied.password}
              />

              <CredentialField
                label="Ethereal Email"
                value={credentials.etherealEmail}
                icon={<Mail className="w-4 h-4" />}
                onCopy={() =>
                  copyToClipboard(credentials.etherealEmail, "email")
                }
                copied={copied.email}
              />

              <CredentialField
                label="Email Password"
                value={credentials.etherealPassword}
                icon={<Shield className="w-4 h-4" />}
                onCopy={() =>
                  copyToClipboard(credentials.etherealPassword, "emailPass")
                }
                copied={copied.emailPass}
              />
            </div>

            <div className="mt-4 p-3 bg-primary-900/20 border border-primary-800 rounded-lg">
              <p className="text-xs text-primary-600">
                📧 View emails at{" "}
                <a
                  href="https://ethereal.email"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 underline"
                >
                  ethereal.email
                </a>{" "}
                using the credentials above
              </p>
            </div>

            <button
              onClick={proceedToLogin}
              className="terminal-btn mt-6 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Continue to Login
            </button>
          </div>
        )}

        {/* Login Form */}
        {mode === "login" && (
          <div className="cyber-card animate-fade-in">
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setMode("select")}
                className="p-2 hover:bg-primary-900/30 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-primary-600" />
              </button>
              <h2 className="text-lg font-semibold text-primary-500">
                Avatar Authentication
              </h2>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-primary-600 mb-2">
                  Avatar Name
                </label>
                <input
                  type="text"
                  value={loginData.avatarName}
                  onChange={(e) =>
                    setLoginData({ ...loginData, avatarName: e.target.value })
                  }
                  className="terminal-input"
                  placeholder="Enter your avatar name"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm text-primary-600 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  className="terminal-input"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="terminal-btn flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                Authenticate
              </button>
            </form>
          </div>
        )}

        {/* Login OTP Verification */}
        {mode === "loginOTP" && (
          <div className="cyber-card animate-fade-in">
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setMode("login")}
                className="p-2 hover:bg-primary-900/30 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-primary-600" />
              </button>
              <h2 className="text-lg font-semibold text-primary-500">
                Final Authentication
              </h2>
            </div>

            <div className="bg-primary-900/20 border border-primary-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-primary-500">
                📧 OTP sent to:{" "}
                <span className="font-mono">{loginData.email}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyLoginOTP} className="space-y-4">
              <div>
                <label className="block text-sm text-primary-600 mb-2">
                  Enter 6-digit OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="terminal-input text-center text-2xl tracking-[0.5em]"
                  placeholder="000000"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="terminal-btn flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Verify & Login
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function CredentialField({ label, value, icon, onCopy, copied }) {
  return (
    <div className="bg-cyber-dark rounded-lg p-3 border border-primary-900">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-primary-700 flex items-center gap-1">
          {icon} {label}
        </span>
        <button
          onClick={onCopy}
          className="text-primary-600 hover:text-primary-500 transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="font-mono text-sm text-primary-500 break-all">{value}</p>
    </div>
  );
}
