import { useState, useRef, useEffect } from "react";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  X,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";
import { useChatStore, useUIStore } from "../store";
import webrtcService from "../services/webrtc";

// Connection Quality Indicator Component
function ConnectionQualityIndicator({ quality }) {
  const getQualityConfig = () => {
    switch (quality) {
      case "excellent":
        return {
          icon: SignalHigh,
          color: "text-green-500",
          label: "Excellent",
        };
      case "good":
        return { icon: SignalMedium, color: "text-green-400", label: "Good" };
      case "fair":
        return { icon: SignalLow, color: "text-yellow-500", label: "Fair" };
      case "poor":
        return { icon: SignalLow, color: "text-red-500", label: "Poor" };
      case "disconnected":
        return { icon: WifiOff, color: "text-red-500", label: "Disconnected" };
      default:
        return { icon: Signal, color: "text-gray-400", label: "Connecting" };
    }
  };

  const config = getQualityConfig();
  const Icon = config.icon;

  return (
    <div
      className="flex items-center gap-1"
      title={`Connection: ${config.label}`}
    >
      <Icon className={`w-4 h-4 ${config.color}`} />
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </div>
  );
}

// Incoming Call Modal
export function IncomingCallModal() {
  const incomingCall = useChatStore((state) => state.incomingCall);

  if (!incomingCall) return null;

  const handleAccept = () => {
    webrtcService.acceptCall(incomingCall);
  };

  const handleReject = () => {
    webrtcService.rejectCall(incomingCall);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-dark-800 border border-matrix-green/30 rounded-xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Caller Avatar */}
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-matrix-green/20 border-2 border-matrix-green flex items-center justify-center animate-pulse">
          <span className="text-3xl text-matrix-green">
            {incomingCall.callerAvatar?.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-bold text-matrix-green mb-2">
          {incomingCall.callerAvatar}
        </h3>
        <p className="text-gray-400 mb-6">
          Incoming {incomingCall.callType} call...
        </p>

        {/* Call Type Icon */}
        <div className="mb-6">
          {incomingCall.callType === "video" ? (
            <Video className="w-12 h-12 text-matrix-green mx-auto animate-bounce" />
          ) : (
            <Phone className="w-12 h-12 text-matrix-green mx-auto animate-bounce" />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-6">
          <button
            onClick={handleReject}
            className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center hover:bg-red-500/40 transition-colors"
          >
            <PhoneOff className="w-8 h-8 text-red-500" />
          </button>
          <button
            onClick={handleAccept}
            className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center hover:bg-green-500/40 transition-colors animate-pulse"
          >
            <Phone className="w-8 h-8 text-green-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Active Call UI
export function ActiveCallView() {
  const activeCall = useChatStore((state) => state.activeCall);
  const callStatus = useChatStore((state) => state.callStatus);
  const localStream = useChatStore((state) => state.localStream);
  const remoteStream = useChatStore((state) => state.remoteStream);
  const connectionQuality = useChatStore((state) => state.connectionQuality);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const containerRef = useRef(null);

  // Set video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    let interval;
    if (callStatus === "connected") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  if (!activeCall) return null;

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleToggleMute = () => {
    const newState = webrtcService.toggleAudio();
    setIsMuted(!newState);
  };

  const handleToggleVideo = () => {
    const newState = webrtcService.toggleVideo();
    setIsVideoOff(!newState);
  };

  const handleSwitchCamera = () => {
    webrtcService.switchCamera();
  };

  const handleEndCall = () => {
    webrtcService.endCall();
    setCallDuration(0);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const isVideoCall = activeCall.callType === "video";

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-dark-900 z-50 flex flex-col ${
        isFullscreen ? "" : "md:inset-4 md:rounded-xl"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-dark-800/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-matrix-green/20 border border-matrix-green flex items-center justify-center">
            <span className="text-matrix-green font-bold">
              {activeCall.targetAvatar?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h4 className="text-white font-semibold">
              {activeCall.targetAvatar}
            </h4>
            <p className="text-sm text-gray-400">
              {callStatus === "connected"
                ? formatDuration(callDuration)
                : callStatus === "ringing" || callStatus === "calling"
                  ? "Calling..."
                  : "Connecting..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Quality Indicator */}
          {callStatus === "connected" && (
            <ConnectionQualityIndicator quality={connectionQuality} />
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-gray-400" />
            ) : (
              <Maximize2 className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-dark-900">
        {isVideoCall ? (
          <>
            {/* Remote Video (Full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Local Video (PIP) */}
            <div className="absolute bottom-4 right-4 w-32 md:w-48 aspect-video rounded-lg overflow-hidden border-2 border-matrix-green shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
            </div>
          </>
        ) : (
          /* Audio Call UI */
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-32 h-32 rounded-full bg-matrix-green/20 border-4 border-matrix-green flex items-center justify-center mb-6">
              <span className="text-5xl text-matrix-green">
                {activeCall.targetAvatar?.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {activeCall.targetAvatar}
            </h3>
            <p className="text-matrix-green text-lg">
              {callStatus === "connected"
                ? formatDuration(callDuration)
                : "Connecting..."}
            </p>

            {/* Audio Visualizer Placeholder */}
            {callStatus === "connected" && (
              <div className="flex items-center gap-1 mt-8">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-matrix-green rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 40 + 10}px`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-dark-800/80 backdrop-blur">
        <div className="flex items-center justify-center gap-4">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted
                ? "bg-red-500/20 border border-red-500"
                : "bg-dark-700 border border-dark-600 hover:bg-dark-600"
            }`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-red-500" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Video Toggle (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={handleToggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isVideoOff
                  ? "bg-red-500/20 border border-red-500"
                  : "bg-dark-700 border border-dark-600 hover:bg-dark-600"
              }`}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6 text-red-500" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Switch Camera (only for video calls on mobile) */}
          {isVideoCall && (
            <button
              onClick={handleSwitchCamera}
              className="w-14 h-14 rounded-full bg-dark-700 border border-dark-600 flex items-center justify-center hover:bg-dark-600 transition-colors"
            >
              <SwitchCamera className="w-6 h-6 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Call Buttons Component (to be used in chat header)
export function CallButtons({ targetAvatar }) {
  const handleAudioCall = () => {
    webrtcService.initiateCall(targetAvatar, "audio");
  };

  const handleVideoCall = () => {
    webrtcService.initiateCall(targetAvatar, "video");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleAudioCall}
        className="p-2 rounded-lg bg-dark-700 hover:bg-matrix-green/20 border border-dark-600 hover:border-matrix-green transition-colors"
        title="Audio Call"
      >
        <Phone className="w-5 h-5 text-matrix-green" />
      </button>
      <button
        onClick={handleVideoCall}
        className="p-2 rounded-lg bg-dark-700 hover:bg-matrix-green/20 border border-dark-600 hover:border-matrix-green transition-colors"
        title="Video Call"
      >
        <Video className="w-5 h-5 text-matrix-green" />
      </button>
    </div>
  );
}

export default {
  IncomingCallModal,
  ActiveCallView,
  CallButtons,
};
