import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useAuthStore, useChatStore, useUIStore } from "../store";
import socketService from "../services/socket";

export default function MainScreen({ navigation }) {
  const [targetAvatar, setTargetAvatar] = useState("");
  const [secretCode, setSecretCode] = useState("");

  const { user, logout } = useAuthStore();
  const { connected, currentSession } = useChatStore();
  const { showToast } = useUIStore();

  useEffect(() => {
    // Connect to socket on mount
    socketService.connect();

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  useEffect(() => {
    // Navigate to chat when session is established
    if (currentSession) {
      navigation.navigate("Chat");
    }
  }, [currentSession]);

  const handleStartSession = () => {
    if (!targetAvatar.trim()) {
      showToast("Please enter target avatar name", "error");
      return;
    }
    if (!secretCode.trim()) {
      showToast("Please enter secret code", "error");
      return;
    }

    socketService.requestSession(targetAvatar.trim(), secretCode.trim());
  };

  const handleCopyAvatar = async () => {
    await Clipboard.setStringAsync(user?.avatarName || "");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast("Avatar name copied!", "success");
  };

  const handleLogout = () => {
    socketService.disconnect();
    logout();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.statusDot,
              connected ? styles.statusOnline : styles.statusOffline,
            ]}
          />
          <Text style={styles.headerTitle}>DOOT</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#00ff00" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Info Card */}
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.avatarName?.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.welcomeText}>Welcome,</Text>
          <TouchableOpacity onPress={handleCopyAvatar}>
            <Text style={styles.avatarName}>{user?.avatarName}</Text>
            <Text style={styles.tapToCopy}>Tap to copy</Text>
          </TouchableOpacity>

          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                connected ? styles.connected : styles.disconnected,
              ]}
            />
            <Text style={styles.statusText}>
              {connected ? "Secure Connection Active" : "Connecting..."}
            </Text>
          </View>
        </View>

        {/* New Session Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔐 Start Secure Session</Text>
          <Text style={styles.cardSubtitle}>
            Connect with another DOOT user for encrypted communication
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Target Avatar</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter avatar name..."
              placeholderTextColor="#444"
              value={targetAvatar}
              onChangeText={setTargetAvatar}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Secret Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Shared secret code..."
              placeholderTextColor="#444"
              value={secretCode}
              onChangeText={setSecretCode}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.connectButton, !connected && styles.disabledButton]}
            onPress={handleStartSession}
            disabled={!connected}
          >
            <Ionicons name="lock-closed" size={20} color="#000" />
            <Text style={styles.connectButtonText}>CONNECT SECURELY</Text>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={24} color="#00ff00" />
            <Text style={styles.featureText}>E2E Encrypted</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="call" size={24} color="#00ff00" />
            <Text style={styles.featureText}>Voice Calls</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="videocam" size={24} color="#00ff00" />
            <Text style={styles.featureText}>Video Calls</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: "#00ff00",
  },
  statusOffline: {
    backgroundColor: "#ff4444",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00ff00",
    letterSpacing: 4,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1a3a1a",
    padding: 20,
    marginBottom: 16,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 255, 0, 0.1)",
    borderWidth: 2,
    borderColor: "#00ff00",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#00ff00",
  },
  welcomeText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  avatarName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00ff00",
    textAlign: "center",
    marginTop: 4,
  },
  tapToCopy: {
    fontSize: 11,
    color: "#444",
    textAlign: "center",
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    padding: 8,
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connected: {
    backgroundColor: "#00ff00",
  },
  disconnected: {
    backgroundColor: "#ff4444",
  },
  statusText: {
    fontSize: 12,
    color: "#888",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00ff00",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 20,
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
    padding: 14,
    color: "#00ff00",
    fontSize: 15,
  },
  connectButton: {
    flexDirection: "row",
    backgroundColor: "#00ff00",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
    letterSpacing: 1,
  },
  featuresContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
  },
  featureItem: {
    alignItems: "center",
  },
  featureText: {
    fontSize: 11,
    color: "#666",
    marginTop: 8,
  },
});
