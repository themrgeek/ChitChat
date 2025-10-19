class SafeManager {
  constructor() {
    this.dbName = "ChitChatSafe";
    this.dbVersion = 1;
    this.db = null;
    this.initializeDB();
  }

  // Initialize IndexedDB
  async initializeDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store for files
        if (!db.objectStoreNames.contains("files")) {
          const store = db.createObjectStore("files", {
            keyPath: "id",
            autoIncrement: true,
          });

          store.createIndex("name", "name", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("type", "type", { unique: false });
        }

        // Create object store for signatures
        if (!db.objectStoreNames.contains("signatures")) {
          const store = db.createObjectStore("signatures", {
            keyPath: "fileId",
          });
        }
      };
    });
  }

  // Save file to safe
  async saveFile(fileData) {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");

      const fileRecord = {
        ...fileData,
        timestamp: new Date(),
        verified: false,
      };

      const request = store.add(fileRecord);

      request.onsuccess = () => {
        console.log("File saved to SAFE:", fileData.name);
        this.updateSafeUI();
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get all files from safe
  async getAllFiles() {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Verify file signature
  async verifyFile(fileId, publicKey) {
    if (!this.db) await this.initializeDB();

    const file = await this.getFile(fileId);
    if (!file) return false;

    const isValid = chitChatCrypto.verifySignature(
      file.data,
      file.signature,
      publicKey
    );

    // Update verification status
    await this.updateFileVerification(fileId, isValid);

    return isValid;
  }

  // Get specific file
  async getFile(fileId) {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const request = store.get(fileId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Update file verification status
  async updateFileVerification(fileId, verified) {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");

      const getRequest = store.get(fileId);
      getRequest.onsuccess = () => {
        const file = getRequest.result;
        file.verified = verified;

        const updateRequest = store.put(file);
        updateRequest.onsuccess = () => {
          this.updateSafeUI();
          resolve();
        };
        updateRequest.onerror = () => reject(updateRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Delete file from safe
  async deleteFile(fileId) {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");
      const request = store.delete(fileId);

      request.onsuccess = () => {
        this.updateSafeUI();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Download file from safe
  async downloadFile(fileId) {
    const file = await this.getFile(fileId);
    if (!file) return;

    const link = document.createElement("a");
    link.href = `data:${file.type};base64,${file.data}`;
    link.download = file.name;
    link.click();
  }

  // Update safe folder UI
  async updateSafeUI() {
    const files = await this.getAllFiles();
    const safeGrid = document.getElementById("safeGrid");

    if (!safeGrid) return;

    safeGrid.innerHTML = "";

    files.forEach((file) => {
      const fileElement = document.createElement("div");
      fileElement.className = "file-item";
      fileElement.innerHTML = `
                <div class="file-icon">
                    ${this.getFileIcon(file.type)}
                </div>
                <div class="file-name">${file.name}</div>
                <div class="file-info">
                    <small>From: ${file.from}</small><br>
                    <small>${new Date(
                      file.timestamp
                    ).toLocaleDateString()}</small>
                </div>
                <div class="file-verified ${
                  file.verified ? "verified" : "unverified"
                }">
                    ${file.verified ? "✓ Verified" : "⚠ Unverified"}
                </div>
                <div class="file-actions">
                    <button onclick="safeManager.downloadFile(${
                      file.id
                    })" class="terminal-btn">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="safeManager.verifyFile(${file.id}, '${
        file.from
      }')" class="terminal-btn">
                        <i class="fas fa-shield-alt"></i>
                    </button>
                    <button onclick="safeManager.deleteFile(${
                      file.id
                    })" class="terminal-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

      safeGrid.appendChild(fileElement);
    });
  }

  // Get appropriate file icon
  getFileIcon(fileType) {
    if (fileType.startsWith("image/")) return '<i class="fas fa-image"></i>';
    if (fileType.startsWith("video/")) return '<i class="fas fa-video"></i>';
    if (fileType.startsWith("audio/")) return '<i class="fas fa-music"></i>';
    return '<i class="fas fa-file"></i>';
  }
}

// Global safe instance
const safeManager = new SafeManager();
