import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuthStore, useChatStore, useUIStore } from "../store";
import socketService from "../services/socket";

export default function ChatScreen({ navigation }) {
  const [message, setMessage] = useState("");
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { user } = useAuthStore();
  const { connected, currentSession, messages, typingUsers, endSession } =
    useChatStore();
  const { showToast } = useUIStore();

  useEffect(() => {
    // Scroll to bottom on new messages
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    socketService.sendMessage(message.trim());
    setMessage("");
    socketService.stopTyping();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTyping = (text) => {
    setMessage(text);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socketService.startTyping();

    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping();
    }, 1000);
  };

  const handleEndSession = () => {
    endSession();
    navigation.goBack();
    showToast("Session ended", "info");
  };

  const handleAudioCall = () => {
    navigation.navigate("Call", {
      callType: "audio",
      targetAvatar: currentSession?.peerAvatar,
    });
  };

  const handleVideoCall = () => {
    navigation.navigate("Call", {
      callType: "video",
      targetAvatar: currentSession?.peerAvatar,
    });
  };

  const renderMessage = ({ item }) => {
    const isSent = item.isSent;

    return (
      <View
        style={[
          styles.messageContainer,
          isSent ? styles.sentContainer : styles.receivedContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isSent ? styles.sentBubble : styles.receivedBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isSent ? styles.sentText : styles.receivedText,
            ]}
          >
            {item.message}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {isSent && (
              <Ionicons
                name={
                  item.status === "read"
                    ? "checkmark-done"
                    : item.status === "delivered"
                      ? "checkmark-done"
                      : "checkmark"
                }
                size={14}
                color={item.status === "read" ? "#00ff00" : "#666"}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#00ff00" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerName}>
                {currentSession?.peerAvatar}
              </Text>
            </View>
            <View style={styles.encryptedRow}>
              <Ionicons name="lock-closed" size={10} color="#666" />
              <Text style={styles.encryptedText}>End-to-End Encrypted</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleAudioCall}
            style={styles.headerButton}
          >
            <Ionicons name="call" size={22} color="#00ff00" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleVideoCall}
            style={styles.headerButton}
          >
            <Ionicons name="videocam" size={22} color="#00ff00" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEndSession}
            style={styles.headerButton}
          >
            <Ionicons name="close" size={22} color="#ff4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.messageId}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark" size={48} color="#00ff00" />
              <Text style={styles.emptyTitle}>Secure Session Active</Text>
              <Text style={styles.emptyText}>
                Messages are end-to-end encrypted.{"\n"}
                Only you and {currentSession?.peerAvatar} can read them.
              </Text>
            </View>
          }
        />

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>{typingUsers[0]} is typing...</Text>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Type a secure message..."
            placeholderTextColor="#444"
            value={message}
            onChangeText={handleTyping}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !message.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!message.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={message.trim() ? "#000" : "#666"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00ff00",
    marginRight: 8,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00ff00",
  },
  encryptedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  encryptedText: {
    fontSize: 11,
    color: "#666",
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
  },
  sentContainer: {
    alignItems: "flex-end",
  },
  receivedContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
  },
  sentBubble: {
    backgroundColor: "#00ff00",
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: "#1a1a1a",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  sentText: {
    color: "#000",
  },
  receivedText: {
    color: "#fff",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00ff00",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    backgroundColor: "#0a0a0a",
  },
  input: {
    flex: 1,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#1a3a1a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00ff00",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#1a1a1a",
  },
});
