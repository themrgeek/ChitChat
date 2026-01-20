import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useAuthStore } from "../store";

export default function TermsScreen() {
  const { acceptTerms } = useAuthStore();

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

        {/* Terms Content */}
        <View style={styles.termsCard}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>

          <Text style={styles.sectionTitle}>1. End-to-End Encryption</Text>
          <Text style={styles.sectionText}>
            All messages are encrypted using military-grade AES-256 encryption.
            Only you and your recipient can read messages.
          </Text>

          <Text style={styles.sectionTitle}>2. Anonymous Identity</Text>
          <Text style={styles.sectionText}>
            Your identity is protected through randomly generated avatar names.
            No personal information is required.
          </Text>

          <Text style={styles.sectionTitle}>3. Zero Knowledge</Text>
          <Text style={styles.sectionText}>
            We cannot read your messages or access your data. Your privacy is
            mathematically guaranteed.
          </Text>

          <Text style={styles.sectionTitle}>4. User Responsibility</Text>
          <Text style={styles.sectionText}>
            You agree to use DOOT only for lawful purposes. Any illegal activity
            is strictly prohibited.
          </Text>

          <Text style={styles.warningText}>
            ⚠️ SAVE YOUR CREDENTIALS - They cannot be recovered!
          </Text>
        </View>

        {/* Accept Button */}
        <TouchableOpacity style={styles.acceptButton} onPress={acceptTerms}>
          <Text style={styles.acceptButtonText}>I ACCEPT - CONTINUE</Text>
        </TouchableOpacity>

        {/* Links */}
        <View style={styles.links}>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Text style={styles.linkDivider}>•</Text>
          <Text style={styles.linkText}>Terms of Service</Text>
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
  content: {
    padding: 20,
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
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
  termsCard: {
    width: "100%",
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1a3a1a",
    padding: 20,
    marginBottom: 20,
  },
  termsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00ff00",
    textAlign: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00ff00",
    marginTop: 15,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 13,
    color: "#888",
    lineHeight: 20,
  },
  warningText: {
    fontSize: 14,
    color: "#ff6600",
    textAlign: "center",
    marginTop: 20,
    padding: 10,
    backgroundColor: "rgba(255, 102, 0, 0.1)",
    borderRadius: 8,
  },
  acceptButton: {
    width: "100%",
    backgroundColor: "#00ff00",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  acceptButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
  },
  linkText: {
    color: "#00ff00",
    fontSize: 12,
    opacity: 0.7,
  },
  linkDivider: {
    color: "#00ff00",
    marginHorizontal: 10,
    opacity: 0.5,
  },
});
