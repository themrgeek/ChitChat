// Main application initialization
document.addEventListener("DOMContentLoaded", () => {
  console.log("Anonymous P2P Chat initialized");

  // Check if we're already authenticated
  const sessionId = localStorage.getItem("sessionId");
  const anonymousId = localStorage.getItem("anonymousId");
  const avatar = localStorage.getItem("avatar");

  if (sessionId && anonymousId && avatar) {
    // Initialize socket connection directly
    const socket = io("http://localhost:3000/api", {
      auth: {
        sessionId: sessionId,
      },
    });

    socket.on("connect", () => {
      // Show chat screen directly
      document.getElementById("auth-screen").classList.remove("active");
      document.getElementById("chat-screen").classList.add("active");

      // Set user info
      document.getElementById("user-avatar").textContent = avatar;
      document.getElementById("user-id").textContent = anonymousId;

      // Initialize chat manager
      if (window.chatManager) {
        window.chatManager.init(socket, anonymousId, avatar);
      }
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      // Show auth screen if connection fails
      document.getElementById("auth-screen").classList.add("active");
      document.getElementById("chat-screen").classList.remove("active");
    });
  }
});
