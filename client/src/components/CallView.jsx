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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-matrix-green/30 rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl shadow-matrix-green/10">
        {/* Caller Avatar */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 rounded-full bg-matrix-green/20 border-2 border-matrix-green flex items-center justify-center">
          <span className="text-2xl sm:text-3xl text-matrix-green font-bold">
            {incomingCall.callerAvatar?.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Caller Info */}
        <h3 className="text-lg sm:text-xl font-bold text-matrix-green mb-1">
          {incomingCall.callerAvatar}
        </h3>
        <p className="text-gray-400 text-sm sm:text-base mb-4">
          Incoming {incomingCall.callType} call...
        </p>

        {/* Call Type Icon */}
        <div className="mb-6">
          {incomingCall.callType === "video" ? (
            <Video className="w-10 h-10 sm:w-12 sm:h-12 text-matrix-green mx-auto animate-bounce" />
          ) : (
            <Phone className="w-10 h-10 sm:w-12 sm:h-12 text-matrix-green mx-auto animate-bounce" />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-8 sm:gap-10">
          {/* Reject */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleReject}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center hover:bg-red-500/40 active:scale-95 transition-all"
            >
              <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
            </button>
            <span className="text-xs text-red-400">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAccept}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center hover:bg-green-500/40 active:scale-95 transition-all animate-pulse"
            >
              <Phone className="w-6 h-6 sm:w-7 sm:h-7 text-green-500" />
            </button>
            <span className="text-xs text-green-400">Accept</span>
          </div>
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
        isFullscreen ? "" : "sm:inset-4 sm:rounded-xl sm:shadow-2xl"
      }`}
    >
      {/* Header - Better aligned */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 sm:p-4 bg-dark-800/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-matrix-green/20 border border-matrix-green flex-shrink-0 flex items-center justify-center">
            <span className="text-matrix-green font-bold text-sm sm:text-base">
              {activeCall.targetAvatar?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h4 className="text-white font-semibold text-sm sm:text-base truncate">
              {activeCall.targetAvatar}
            </h4>
            <p className="text-xs sm:text-sm text-gray-400">
              {callStatus === "connected"
                ? formatDuration(callDuration)
                : callStatus === "ringing" || callStatus === "calling"
                  ? "Calling..."
                  : "Connecting..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Connection Quality Indicator */}
          {callStatus === "connected" && (
            <ConnectionQualityIndicator quality={connectionQuality} />
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-dark-900 overflow-hidden">
        {isVideoCall ? (
          <>
            {/* Remote Video (Full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Local Video (PIP) - Better positioned */}
            <div className="absolute bottom-24 right-4 w-28 sm:w-32 md:w-40 aspect-video rounded-xl overflow-hidden border-2 border-matrix-green/70 shadow-lg shadow-matrix-green/20 bg-dark-800">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {isVideoOff && (
                <div className="absolute inset-0 bg-dark-900 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-gray-500" />
                </div>
              )}
            </div>

            {/* Status overlay for video call */}
            {callStatus !== "connected" && (
              <div className="absolute inset-0 bg-dark-900/80 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-matrix-green/20 border-2 border-matrix-green flex items-center justify-center animate-pulse">
                    <span className="text-3xl text-matrix-green">
                      {activeCall.targetAvatar?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-matrix-green text-lg animate-pulse">
                    {callStatus === "ringing" || callStatus === "calling"
                      ? "Calling..."
                      : "Connecting..."}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Audio Call UI - Better centered */
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            {/* Avatar */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-matrix-green/20 border-4 border-matrix-green flex items-center justify-center mb-4 shadow-lg shadow-matrix-green/30">
              <span className="text-4xl sm:text-5xl text-matrix-green font-bold">
                {activeCall.targetAvatar?.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Name */}
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center">
              {activeCall.targetAvatar}
            </h3>

            {/* Status/Duration */}
            <p className="text-matrix-green text-base sm:text-lg mb-6">
              {callStatus === "connected"
                ? formatDuration(callDuration)
                : callStatus === "ringing" || callStatus === "calling"
                  ? "Calling..."
                  : "Connecting..."}
            </p>

            {/* Audio Visualizer */}
            {callStatus === "connected" && (
              <div className="flex items-end justify-center gap-1 h-12">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-matrix-green rounded-full transition-all duration-150"
                    style={{
                      height: `${Math.random() * 35 + 8}px`,
                      animationDelay: `${i * 0.1}s`,
                      animation: "pulse 0.5s ease-in-out infinite alternate",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls - Better aligned */}
      <div className="flex-shrink-0 p-4 sm:p-6 bg-dark-800/90 backdrop-blur-sm border-t border-gray-800">
        <div className="flex items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
              isMuted
                ? "bg-red-500/20 border-2 border-red-500 scale-95"
                : "bg-dark-700 border-2 border-dark-500 hover:bg-dark-600 hover:border-gray-500"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
            ) : (
              <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            )}
          </button>

          {/* Video Toggle (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={handleToggleVideo}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isVideoOff
                  ? "bg-red-500/20 border-2 border-red-500 scale-95"
                  : "bg-dark-700 border-2 border-dark-500 hover:bg-dark-600 hover:border-gray-500"
              }`}
              title={isVideoOff ? "Turn on camera" : "Turn off camera"}
            >
              {isVideoOff ? (
                <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
              ) : (
                <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              )}
            </button>
          )}

          {/* End Call Button - Prominent */}
          <button
            onClick={handleEndCall}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all duration-200 shadow-lg shadow-red-500/30"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </button>

          {/* Switch Camera (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={handleSwitchCamera}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-dark-700 border-2 border-dark-500 flex items-center justify-center hover:bg-dark-600 hover:border-gray-500 transition-all duration-200"
              title="Switch Camera"
            >
              <SwitchCamera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
          )}
        </div>

        {/* End Conversation Text Button */}
        <div className="mt-4 text-center">
          <button
            onClick={handleEndCall}
            className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
          >
            Tap to end conversation
          </button>
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
