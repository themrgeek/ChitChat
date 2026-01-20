import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useAuthStore, useUIStore } from "../store";
import api from "../services/api";

export default function AuthScreen() {
  const [mode, setMode] = useState("select"); // select, newUser, login, otp
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [loginData, setLoginData] = useState({ avatarName: "", password: "" });
  const [otpData, setOtpData] = useState({
    otp: "",
    email: "",
    avatarName: "",
  });

  const { setUser } = useAuthStore();
  const { showToast } = useUIStore();

  const handleCreateIdentity = async () => {
    setLoading(true);
    try {
      const response = await api.createNewUser();
      setCredentials(response);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Identity created successfully!", "success");
    } catch (error) {
      showToast(error.message || "Failed to create identity", "error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!credentials) return;

    const text = `DOOT Credentials\n\nAvatar: ${credentials.avatarName}\nPassword: ${credentials.password}\nEmail: ${credentials.etherealEmail}\nEmail Password: ${credentials.etherealPassword}`;
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast("Credentials copied!", "success");
  };

  const handleLogin = async () => {
    if (!loginData.avatarName || !loginData.password) {
      showToast("Please enter both avatar name and password", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await api.login(
        loginData.avatarName,
        loginData.password,
      );

      if (response.requiresOTP) {
        setOtpData({
          otp: "",
          email: response.email,
          avatarName: loginData.avatarName,
        });
        setMode("otp");
        showToast("OTP sent to your email", "success");
      } else {
        setUser({
          avatarName: loginData.avatarName,
          ...response,
        });
      }
    } catch (error) {
      showToast(error.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpData.otp) {
      showToast("Please enter OTP", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await api.verifyLoginOTP(
        otpData.email,
        otpData.avatarName,
        otpData.otp,
      );

      setUser({
        avatarName: otpData.avatarName,
        ...response,
      });
      showToast("Login successful!", "success");
    } catch (error) {
      showToast(error.message || "Invalid OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = () => {
    if (!credentials) return;
    setUser({
      avatarName: credentials.avatarName,
      email: credentials.etherealEmail,
    });
  };

  // Select Mode Screen
  if (mode === "select") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>👤</Text>
            </View>
            <Text style={styles.title}>DOOT</Text>
            <Text style={styles.subtitle}>
              Fully Un-traceable Secure Messaging
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>Choose Your Path</Text>
            <Text style={styles.optionsSubtitle}>
              Select how you'd like to proceed with your secure identity
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setMode("newUser");
                handleCreateIdentity();
              }}
            >
              <Text style={styles.primaryButtonText}>
                👤 NEW USER - CREATE IDENTITY
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setMode("login")}
            >
              <Text style={styles.secondaryButtonText}>
                🔑 EXISTING USER - LOGIN
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // New User - Credentials Display
  if (mode === "newUser") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {loading
                ? "🔐 Creating Secure Identity..."
                : "✅ Identity Created!"}
            </Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#00ff00"
                style={{ marginVertical: 40 }}
              />
            ) : credentials ? (
              <>
                <View style={styles.credentialRow}>
                  <Text style={styles.credentialLabel}>Avatar Name:</Text>
                  <Text style={styles.credentialValue}>
                    {credentials.avatarName}
                  </Text>
                </View>

                <View style={styles.credentialRow}>
                  <Text style={styles.credentialLabel}>Password:</Text>
                  <Text style={styles.credentialValue}>
                    {credentials.password}
                  </Text>
                </View>

                <View style={styles.credentialRow}>
                  <Text style={styles.credentialLabel}>Email:</Text>
                  <Text style={styles.credentialValueSmall}>
                    {credentials.etherealEmail}
                  </Text>
                </View>

                <View style={styles.credentialRow}>
                  <Text style={styles.credentialLabel}>Email Password:</Text>
                  <Text style={styles.credentialValue}>
                    {credentials.etherealPassword}
                  </Text>
                </View>

                <Text style={styles.warningText}>
                  ⚠️ SAVE THESE CREDENTIALS NOW!{"\n"}They cannot be recovered!
                </Text>

                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyCredentials}
                >
                  <Text style={styles.copyButtonText}>
                    📋 COPY ALL CREDENTIALS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleStartSession}
                >
                  <Text style={styles.primaryButtonText}>
                    🚀 START SECURE SESSION
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode("select")}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Login Screen
  if (mode === "login") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔑 Login</Text>
            <Text style={styles.cardSubtitle}>
              Enter your secure credentials
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Avatar Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Shadow_Hunter_123"
                placeholderTextColor="#444"
                value={loginData.avatarName}
                onChangeText={(text) =>
                  setLoginData({ ...loginData, avatarName: text })
                }
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••••"
                placeholderTextColor="#444"
                value={loginData.password}
                onChangeText={(text) =>
                  setLoginData({ ...loginData, password: text })
                }
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>LOGIN</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode("select")}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // OTP Verification Screen
  if (mode === "otp") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📧 Verify OTP</Text>
            <Text style={styles.cardSubtitle}>
              Enter the 6-digit code sent to{"\n"}
              {otpData.email}
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>OTP Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor="#444"
                value={otpData.otp}
                onChangeText={(text) => setOtpData({ ...otpData, otp: text })}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleVerifyOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>VERIFY</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode("login")}
            >
              <Text style={styles.backButtonText}>← Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#00ff00",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 255, 0, 0.1)",
  },
  logoIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#00ff00",
    marginTop: 15,
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#00cc00",
    marginTop: 8,
    opacity: 0.8,
  },
  optionsCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1a3a1a",
    padding: 24,
  },
  optionsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00ff00",
    textAlign: "center",
    marginBottom: 8,
  },
  optionsSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1a3a1a",
    padding: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00ff00",
    textAlign: "center",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: "#00ff00",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#00ff00",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#00ff00",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  disabledButton: {
    opacity: 0.6,
  },
  credentialRow: {
    backgroundColor: "#0a0a0a",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  credentialLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  credentialValue: {
    fontSize: 16,
    color: "#00ff00",
    fontFamily: "monospace",
  },
  credentialValueSmall: {
    fontSize: 12,
    color: "#00ff00",
    fontFamily: "monospace",
  },
  warningText: {
    fontSize: 14,
    color: "#ff6600",
    textAlign: "center",
    marginVertical: 16,
    padding: 12,
    backgroundColor: "rgba(255, 102, 0, 0.1)",
    borderRadius: 8,
  },
  copyButton: {
    backgroundColor: "#1a3a1a",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  copyButtonText: {
    color: "#00ff00",
    fontSize: 14,
    fontWeight: "600",
  },
  backButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#666",
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: "#00ff00",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#1a3a1a",
    borderRadius: 8,
    padding: 16,
    color: "#00ff00",
    fontSize: 16,
  },
  otpInput: {
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
  },
});
