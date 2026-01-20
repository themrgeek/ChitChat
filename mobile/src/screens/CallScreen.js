import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Camera } from "expo-camera";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { useChatStore, useUIStore } from "../store";
import socketService from "../services/socket";

const { width, height } = Dimensions.get("window");

export default function CallScreen({ navigation, route }) {
  const { callType, targetAvatar } = route.params;

  const [hasPermission, setHasPermission] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [cameraType, setCameraType] = useState("front");
  const [callDuration, setCallDuration] = useState(0);

  const {
    callStatus,
    incomingCall,
    setCallStatus,
    setActiveCall,
    setIncomingCall,
  } = useChatStore();
  const { showToast } = useUIStore();

  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  // Prevent screenshots during calls
  useEffect(() => {
    const preventScreenCapture = async () => {
      await ScreenCapture.preventScreenCaptureAsync();
    };
    preventScreenCapture();

    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  useEffect(() => {
    requestPermissions();

    // Start call duration timer when connected
    if (callStatus === "connected") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStatus]);

  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await Camera.requestCameraPermissionsAsync();
    const { status: audioStatus } = await Audio.requestPermissionsAsync();

    setHasPermission(cameraStatus === "granted" && audioStatus === "granted");

    if (cameraStatus !== "granted" || audioStatus !== "granted") {
      showToast("Camera and microphone permissions required", "error");
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleToggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSwitchCamera = () => {
    setCameraType(cameraType === "front" ? "back" : "front");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEndCall = () => {
    socketService.endCall(null, targetAvatar);
    setCallDuration(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    navigation.goBack();
  };

  const handleAcceptIncomingCall = () => {
    // Accept the incoming call
    socketService.acceptCall(
      incomingCall.callId,
      incomingCall.callerAvatar,
      null,
    );
    setCallStatus("connected");
    setActiveCall({
      targetAvatar: incomingCall.callerAvatar,
      callType: incomingCall.callType,
      isInitiator: false,
    });
    setIncomingCall(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRejectIncomingCall = () => {
    socketService.rejectCall(
      incomingCall.callId,
      incomingCall.callerAvatar,
      "Declined",
    );
    setIncomingCall(null);
    navigation.goBack();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  // Incoming Call UI
  if (incomingCall) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.incomingCallContainer}>
          <View style={styles.callerAvatar}>
            <Text style={styles.callerAvatarText}>
              {incomingCall.callerAvatar?.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.callerName}>{incomingCall.callerAvatar}</Text>
          <Text style={styles.callTypeText}>
            Incoming {incomingCall.callType} call...
          </Text>

          <View style={styles.incomingCallIcon}>
            <Ionicons
              name={incomingCall.callType === "video" ? "videocam" : "call"}
              size={48}
              color="#00ff00"
            />
          </View>

          <View style={styles.incomingCallActions}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={handleRejectIncomingCall}
            >
              <Ionicons
                name="call"
                size={32}
                color="#fff"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAcceptIncomingCall}
            >
              <Ionicons name="call" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Video View */}
      {callType === "video" && hasPermission && !isVideoOff ? (
        <View style={styles.videoContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={
              cameraType === "front"
                ? Camera.Constants.Type.front
                : Camera.Constants.Type.back
            }
          />

          {/* Remote video placeholder */}
          <View style={styles.remoteVideoPlaceholder}>
            <View style={styles.remoteAvatar}>
              <Text style={styles.remoteAvatarText}>
                {targetAvatar?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.connectingText}>
              {callStatus === "connected" ? "Connected" : "Connecting..."}
            </Text>
          </View>

          {/* Local video (PIP) */}
          <View style={styles.localVideo}>
            <Camera
              style={styles.localCamera}
              type={
                cameraType === "front"
                  ? Camera.Constants.Type.front
                  : Camera.Constants.Type.back
              }
            />
          </View>
        </View>
      ) : (
        /* Audio Call UI */
        <View style={styles.audioCallContainer}>
          <View style={styles.callerAvatar}>
            <Text style={styles.callerAvatarText}>
              {targetAvatar?.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.callerName}>{targetAvatar}</Text>
          <Text style={styles.callStatus}>
            {callStatus === "connected"
              ? formatDuration(callDuration)
              : callStatus === "ringing" || callStatus === "calling"
                ? "Calling..."
                : "Connecting..."}
          </Text>

          {/* Audio Visualizer */}
          {callStatus === "connected" && (
            <View style={styles.audioVisualizer}>
              {[...Array(5)].map((_, i) => (
                <View
                  key={i}
                  style={[styles.audioBar, { height: Math.random() * 40 + 10 }]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{targetAvatar}</Text>
          <Text style={styles.headerStatus}>
            {callStatus === "connected"
              ? formatDuration(callDuration)
              : "Connecting..."}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={handleToggleMute}
        >
          <Ionicons
            name={isMuted ? "mic-off" : "mic"}
            size={24}
            color={isMuted ? "#ff4444" : "#fff"}
          />
        </TouchableOpacity>

        {callType === "video" && (
          <TouchableOpacity
            style={[
              styles.controlButton,
              isVideoOff && styles.controlButtonActive,
            ]}
            onPress={handleToggleVideo}
          >
            <Ionicons
              name={isVideoOff ? "videocam-off" : "videocam"}
              size={24}
              color={isVideoOff ? "#ff4444" : "#fff"}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
          <Ionicons
            name="call"
            size={28}
            color="#fff"
            style={{ transform: [{ rotate: "135deg" }] }}
          />
        </TouchableOpacity>

        {callType === "video" && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleSwitchCamera}
          >
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    padding: 16,
    alignItems: "center",
  },
  headerInfo: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  headerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  headerStatus: {
    fontSize: 14,
    color: "#00ff00",
    marginTop: 4,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  remoteVideoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  remoteAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0, 255, 0, 0.1)",
    borderWidth: 2,
    borderColor: "#00ff00",
    alignItems: "center",
    justifyContent: "center",
  },
  remoteAvatarText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#00ff00",
  },
  connectingText: {
    fontSize: 16,
    color: "#00ff00",
    marginTop: 16,
  },
  localVideo: {
    position: "absolute",
    bottom: 120,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#00ff00",
  },
  localCamera: {
    flex: 1,
  },
  audioCallContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  callerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0, 255, 0, 0.1)",
    borderWidth: 3,
    borderColor: "#00ff00",
    alignItems: "center",
    justifyContent: "center",
  },
  callerAvatarText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#00ff00",
  },
  callerName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 20,
  },
  callTypeText: {
    fontSize: 16,
    color: "#00ff00",
    marginTop: 8,
  },
  callStatus: {
    fontSize: 18,
    color: "#00ff00",
    marginTop: 8,
  },
  audioVisualizer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 40,
  },
  audioBar: {
    width: 4,
    backgroundColor: "#00ff00",
    borderRadius: 2,
    marginHorizontal: 4,
  },
  incomingCallContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  incomingCallIcon: {
    marginTop: 40,
    marginBottom: 60,
  },
  incomingCallActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#ff4444",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 30,
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#00cc00",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 30,
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  controlButtonActive: {
    backgroundColor: "rgba(255, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "#ff4444",
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ff4444",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
});
