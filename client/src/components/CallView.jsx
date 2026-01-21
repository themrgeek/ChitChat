import { useState, useRef, useEffect, useCallback } from "react";
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
  UserPlus,
  Users,
  Search,
  Grid,
  Rows,
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

// Add Participant Modal for Conference
function AddParticipantModal({ isOpen, onClose, onAdd }) {
  const [searchQuery, setSearchQuery] = useState("");
  const onlineUsers = useChatStore((state) => state.onlineUsers) || [];

  const filteredUsers = onlineUsers.filter((user) =>
    user.avatarName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-matrix-green/30 rounded-xl w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-matrix-green">
            Add Participant
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:border-matrix-green focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredUsers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No users found</p>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <button
                  key={user.avatarName}
                  onClick={() => onAdd(user.avatarName)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-matrix-green/50 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-matrix-green/20 border border-matrix-green flex items-center justify-center">
                    <span className="text-matrix-green font-bold">
                      {user.avatarName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium">{user.avatarName}</p>
                    <p className="text-xs text-green-500">Online</p>
                  </div>
                  <UserPlus className="w-5 h-5 text-matrix-green" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Incoming Call Modal
export function IncomingCallModal() {
  const incomingCall = useChatStore((state) => state.incomingCall);

  if (!incomingCall) return null;

  const handleAccept = () => {
    if (incomingCall.isConference) {
      webrtcService.acceptConferenceInvite(incomingCall);
    } else {
      webrtcService.acceptCall(incomingCall);
    }
  };

  const handleReject = () => {
    webrtcService.rejectCall(incomingCall);
  };

  const isConference =
    incomingCall.isConference || incomingCall.participants?.length > 1;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-matrix-green/30 rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl shadow-matrix-green/10">
        {/* Caller Avatar */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 rounded-full bg-matrix-green/20 border-2 border-matrix-green flex items-center justify-center">
          {isConference ? (
            <Users className="w-10 h-10 text-matrix-green" />
          ) : (
            <span className="text-2xl sm:text-3xl text-matrix-green font-bold">
              {incomingCall.callerAvatar?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Caller Info */}
        <h3 className="text-lg sm:text-xl font-bold text-matrix-green mb-1">
          {isConference ? "Conference Call" : incomingCall.callerAvatar}
        </h3>
        <p className="text-gray-400 text-sm sm:text-base mb-4">
          Incoming {incomingCall.callType === "video" ? "video" : ""} call...
          {isConference &&
            ` (${incomingCall.participants?.length || 2} participants)`}
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

// Active Call UI - WhatsApp Style with Conference Support
export function ActiveCallView() {
  const activeCall = useChatStore((state) => state.activeCall);
  const callStatus = useChatStore((state) => state.callStatus);
  const localStream = useChatStore((state) => state.localStream);
  const remoteStream = useChatStore((state) => state.remoteStream);
  const connectionQuality = useChatStore((state) => state.connectionQuality);
  // For multi-participant calls
  const participants = useChatStore((state) => state.callParticipants) || [];
  const remoteStreams = useChatStore((state) => state.remoteStreams) || {};

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [localVideoEnlarged, setLocalVideoEnlarged] = useState(false);
  const [gridLayout, setGridLayout] = useState("speaker"); // 'grid', 'speaker'
  const [enlargedParticipant, setEnlargedParticipant] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const containerRef = useRef(null);

  const isConference = participants.length > 1;
  const isVideoCall = activeCall?.callType === "video" || activeCall?.hasVideo;

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
    // Use conference variant if in conference, otherwise standard toggle
    if (webrtcService.isConference) {
      const newState = webrtcService.toggleConferenceAudio();
      setIsMuted(!newState);
    } else {
      const newState = webrtcService.toggleAudio();
      setIsMuted(!newState);
    }
  };

  const handleToggleVideo = () => {
    // Use conference variant if in conference, otherwise standard toggle
    if (webrtcService.isConference) {
      const newState = webrtcService.toggleConferenceVideo();
      setIsVideoEnabled(newState);
    } else {
      const newState = webrtcService.toggleVideo();
      setIsVideoEnabled(newState);
    }
  };

  const handleSwitchCamera = () => {
    webrtcService.switchCamera();
  };

  const handleEndCall = () => {
    // Use unified end call that handles both 1:1 and conference
    webrtcService.endCallUnified();
    setCallDuration(0);
  };

  const handleAddParticipant = (avatarName) => {
    webrtcService.addParticipant(avatarName);
    setShowAddParticipant(false);
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

  const toggleLocalVideoSize = () => {
    setLocalVideoEnlarged(!localVideoEnlarged);
  };

  // All participants for rendering
  const allParticipants = isConference
    ? participants
    : activeCall.targetAvatar
      ? [activeCall.targetAvatar]
      : [];

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-dark-900 z-50 flex flex-col ${
        isFullscreen ? "" : "sm:inset-4 sm:rounded-xl sm:shadow-2xl"
      }`}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 sm:p-4 bg-dark-800/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-matrix-green/20 border border-matrix-green flex-shrink-0 flex items-center justify-center">
            {isConference ? (
              <Users className="w-5 h-5 text-matrix-green" />
            ) : (
              <span className="text-matrix-green font-bold text-sm sm:text-base">
                {activeCall.targetAvatar?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-white font-semibold text-sm sm:text-base truncate">
              {isConference
                ? `Conference (${participants.length})`
                : activeCall.targetAvatar}
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
          {callStatus === "connected" && (
            <ConnectionQualityIndicator quality={connectionQuality} />
          )}

          {/* Layout toggle for conference */}
          {isConference && (
            <button
              onClick={() =>
                setGridLayout(gridLayout === "grid" ? "speaker" : "grid")
              }
              className="p-1.5 sm:p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
              title="Toggle layout"
            >
              {gridLayout === "grid" ? (
                <Rows className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              ) : (
                <Grid className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              )}
            </button>
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

      {/* Video/Call Area */}
      <div className="flex-1 relative bg-dark-900 overflow-hidden">
        {isVideoCall ? (
          <>
            {/* Conference Grid Layout */}
            {isConference && gridLayout === "grid" ? (
              <div
                className={`absolute inset-0 p-2 grid gap-2 ${
                  allParticipants.length <= 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : allParticipants.length <= 4
                      ? "grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3"
                }`}
              >
                {allParticipants.map((participant) => (
                  <div
                    key={participant}
                    className="relative rounded-xl overflow-hidden bg-dark-800 border-2 border-dark-600"
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-matrix-green/20 border-2 border-matrix-green flex items-center justify-center">
                        <span className="text-2xl text-matrix-green font-bold">
                          {participant?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
                      <span className="text-xs text-white font-medium">
                        {participant}
                      </span>
                    </div>
                  </div>
                ))}
                {/* Local video in grid */}
                <div className="relative rounded-xl overflow-hidden bg-dark-800 border-2 border-matrix-green">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
                    <span className="text-xs text-white font-medium">You</span>
                  </div>
                </div>
              </div>
            ) : (
              // Speaker/1:1 layout - WhatsApp style
              <>
                {/* Remote Video (Full screen) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Local Video (PIP) - WhatsApp style, tap to enlarge */}
                <div
                  className={`absolute transition-all duration-300 cursor-pointer ${
                    localVideoEnlarged
                      ? "inset-4 rounded-2xl"
                      : "bottom-28 right-4 w-28 sm:w-36 md:w-44 aspect-[3/4] rounded-xl"
                  } overflow-hidden border-2 border-matrix-green/70 shadow-lg shadow-matrix-green/20 bg-dark-800`}
                  onClick={toggleLocalVideoSize}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* Video off overlay */}
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-dark-900 flex items-center justify-center">
                      <VideoOff className="w-8 h-8 text-gray-500" />
                    </div>
                  )}

                  {/* Enlarge/minimize hint */}
                  <div className="absolute top-2 right-2 p-1 bg-black/50 rounded backdrop-blur-sm">
                    {localVideoEnlarged ? (
                      <Minimize2 className="w-3 h-3 text-white" />
                    ) : (
                      <Maximize2 className="w-3 h-3 text-white" />
                    )}
                  </div>

                  {/* "You" label */}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 rounded backdrop-blur-sm">
                    <span className="text-xs text-white">You</span>
                  </div>
                </div>

                {/* Conference participants strip (speaker view) */}
                {isConference && gridLayout === "speaker" && (
                  <div className="absolute top-4 left-4 right-20 flex gap-2 overflow-x-auto pb-2">
                    {allParticipants.map((participant) => (
                      <div
                        key={participant}
                        onClick={() => setEnlargedParticipant(participant)}
                        className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-dark-600 hover:border-matrix-green cursor-pointer bg-dark-800"
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-lg text-matrix-green font-bold">
                            {participant?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status overlay */}
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
            )}
          </>
        ) : (
          /* Audio Call UI */
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            {isConference ? (
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                {allParticipants.map((participant) => (
                  <div key={participant} className="flex flex-col items-center">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-matrix-green/20 border-2 border-matrix-green flex items-center justify-center shadow-lg shadow-matrix-green/30">
                      <span className="text-2xl sm:text-3xl text-matrix-green font-bold">
                        {participant?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="mt-2 text-sm text-white">
                      {participant}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-matrix-green/20 border-4 border-matrix-green flex items-center justify-center mb-4 shadow-lg shadow-matrix-green/30">
                  <span className="text-4xl sm:text-5xl text-matrix-green font-bold">
                    {activeCall.targetAvatar?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center">
                  {activeCall.targetAvatar}
                </h3>
              </>
            )}

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

      {/* Controls */}
      <div className="flex-shrink-0 p-4 sm:p-6 bg-dark-800/90 backdrop-blur-sm border-t border-gray-800">
        <div className="flex items-center justify-center gap-3 sm:gap-4 max-w-lg mx-auto">
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

          {/* Video Toggle */}
          <button
            onClick={handleToggleVideo}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
              !isVideoEnabled
                ? "bg-red-500/20 border-2 border-red-500 scale-95"
                : "bg-dark-700 border-2 border-dark-500 hover:bg-dark-600 hover:border-gray-500"
            }`}
            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {!isVideoEnabled ? (
              <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
            ) : (
              <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all duration-200 shadow-lg shadow-red-500/30"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </button>

          {/* Add Participant */}
          <button
            onClick={() => setShowAddParticipant(true)}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-dark-700 border-2 border-dark-500 flex items-center justify-center hover:bg-matrix-green/20 hover:border-matrix-green transition-all duration-200"
            title="Add Participant"
          >
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>

          {/* Switch Camera */}
          <button
            onClick={handleSwitchCamera}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-dark-700 border-2 border-dark-500 flex items-center justify-center hover:bg-dark-600 hover:border-gray-500 transition-all duration-200"
            title="Switch Camera"
          >
            <SwitchCamera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>

        {/* End Conversation Text */}
        <div className="mt-4 text-center">
          <button
            onClick={handleEndCall}
            className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
          >
            Tap to end conversation
          </button>
        </div>
      </div>

      {/* Add Participant Modal */}
      <AddParticipantModal
        isOpen={showAddParticipant}
        onClose={() => setShowAddParticipant(false)}
        onAdd={handleAddParticipant}
      />
    </div>
  );
}

// Unified Call Button - single button with options
export function CallButton({ targetAvatar, variant = "default" }) {
  const [showOptions, setShowOptions] = useState(false);

  const handleStartCall = (withVideo = true) => {
    webrtcService.initiateCall(targetAvatar, withVideo ? "video" : "audio");
    setShowOptions(false);
  };

  if (variant === "icon") {
    return (
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="p-2 rounded-lg bg-dark-700 hover:bg-matrix-green/20 border border-dark-600 hover:border-matrix-green transition-colors"
          title="Start Call"
        >
          <Phone className="w-5 h-5 text-matrix-green" />
        </button>

        {showOptions && (
          <div className="absolute top-full right-0 mt-2 bg-dark-800 border border-matrix-green/30 rounded-lg shadow-xl overflow-hidden z-10">
            <button
              onClick={() => handleStartCall(false)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-dark-700 transition-colors"
            >
              <Phone className="w-4 h-4 text-matrix-green" />
              <span className="text-white text-sm">Audio Call</span>
            </button>
            <button
              onClick={() => handleStartCall(true)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-dark-700 transition-colors border-t border-dark-700"
            >
              <Video className="w-4 h-4 text-matrix-green" />
              <span className="text-white text-sm">Video Call</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => handleStartCall(true)}
      className="terminal-btn flex items-center justify-center gap-3"
    >
      <Phone className="w-5 h-5" />
      START CALL
    </button>
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
  CallButton,
  CallButtons,
};
