class ChatManager {
  constructor() {
    this.socket = null;
    this.anonymousId = null;
    this.avatar = null;
    this.currentRoom = null;
  }

  init(socket, anonymousId, avatar) {
    this.socket = socket;
    this.anonymousId = anonymousId;
    this.avatar = avatar;

    this.setupEventListeners();
    this.setupSocketHandlers();
  }

  setupEventListeners() {
    // Send message button
    document.getElementById("send-btn").addEventListener("click", () => {
      this.sendMessage();
    });

    // Send message on Enter key
    document
      .getElementById("message-input")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.sendMessage();
        }
      });

    // Create room button
    document.getElementById("create-room-btn").addEventListener("click", () => {
      this.createRoom();
    });
  }

  setupSocketHandlers() {
    // Handle incoming messages
    this.socket.on("message", (data) => {
      this.displayMessage(data, false);
    });

    // Handle user join/leave events
    this.socket.on("user-joined", (data) => {
      this.addUserToList(data);
      this.displaySystemMessage(`${data.userId} joined the room`);
    });

    this.socket.on("user-left", (data) => {
      this.removeUserFromList(data.userId);
      this.displaySystemMessage(`${data.userId} left the room`);
    });

    // Handle room list updates
    this.socket.on("room-list", (rooms) => {
      this.updateRoomList(rooms);
    });

    // Handle connection status
    this.socket.on("user-connected", (data) => {
      this.addUserToList(data);
    });

    this.socket.on("user-disconnected", (data) => {
      this.removeUserFromList(data.peerId);
    });
  }

  sendMessage() {
    const messageInput = document.getElementById("message-input");
    const content = messageInput.value.trim();

    if (!content) return;

    // Send message through socket
    this.socket.emit("message", {
      roomId: this.currentRoom,
      content: content,
    });

    // Display message locally
    this.displayMessage(
      {
        from: this.anonymousId,
        avatar: this.avatar,
        content: content,
        timestamp: new Date(),
      },
      true
    );

    // Clear input
    messageInput.value = "";
  }

  displayMessage(data, isSent) {
    const messagesContainer = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.className = `message ${isSent ? "sent" : "received"}`;

    messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-avatar">${data.avatar}</span>
                <span class="message-sender">${
                  isSent ? "You" : data.from
                }</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.content)}</div>
            <div class="message-time">${new Date(
              data.timestamp
            ).toLocaleTimeString()}</div>
        `;

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  displaySystemMessage(content) {
    const messagesContainer = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.className = "message system";
    messageElement.innerHTML = `<em>${this.escapeHtml(content)}</em>`;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  addUserToList(user) {
    const usersContainer = document.getElementById("online-users");
    const userElement = document.createElement("div");
    userElement.className = "user-item";
    userElement.id = `user-${user.userId}`;
    userElement.innerHTML = `
            <span class="user-avatar">${user.avatar}</span>
            <span class="user-id">${user.userId}</span>
        `;
    usersContainer.appendChild(userElement);
  }

  removeUserFromList(userId) {
    const userElement = document.getElementById(`user-${userId}`);
    if (userElement) {
      userElement.remove();
    }
  }

  createRoom() {
    const roomNameInput = document.getElementById("room-name");
    const roomName = roomNameInput.value.trim();

    if (!roomName) {
      alert("Please enter a room name");
      return;
    }

    // Join room through socket
    this.socket.emit("join-room", roomName);
    this.currentRoom = roomName;

    // Display system message
    this.displaySystemMessage(`You joined room: ${roomName}`);

    // Clear input
    roomNameInput.value = "";
  }

  updateRoomList(rooms) {
    const roomList = document.getElementById("room-list");
    roomList.innerHTML = "";

    rooms.forEach((room) => {
      const roomElement = document.createElement("div");
      roomElement.className = "room-item";
      roomElement.textContent = room.name;
      roomElement.addEventListener("click", () => {
        this.joinRoom(room.name);
      });
      roomList.appendChild(roomElement);
    });
  }

  joinRoom(roomName) {
    // Leave current room if any
    if (this.currentRoom) {
      this.socket.emit("leave-room", this.currentRoom);
    }

    // Join new room
    this.socket.emit("join-room", roomName);
    this.currentRoom = roomName;

    // Clear messages
    document.getElementById("messages").innerHTML = "";

    // Display system message
    this.displaySystemMessage(`You joined room: ${roomName}`);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize chat manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.chatManager = new ChatManager();
});
