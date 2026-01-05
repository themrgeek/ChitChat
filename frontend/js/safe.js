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

  // Save file to safe (with encryption)
  async saveFile(fileData) {
    if (!this.db) await this.initializeDB();

    return new Promise((resolve, reject) => {
      try {
        // Encrypt the file data before storing
        const encryptedData = dootCrypto.encryptMessage(fileData.data);

        // Generate a unique encryption key for this file
        const fileKey = dootCrypto.generateSessionKey();

        // Encrypt the data with the file-specific key
        const finalEncryptedData = CryptoJS.AES.encrypt(encryptedData, fileKey).toString();

        const fileRecord = {
          ...fileData,
          data: finalEncryptedData, // Store encrypted data
          fileKey: fileKey, // Store the encryption key (in production, this should be encrypted with user's key)
          timestamp: new Date(),
          verified: false,
          encrypted: true, // Mark as encrypted
        };

        const transaction = this.db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        const request = store.add(fileRecord);

        request.onsuccess = () => {
          console.log("File encrypted and saved to SAFE:", fileData.name);
          this.updateSafeUI();
          resolve(request.result);
        };

        request.onerror = () => reject(request.error);
      } catch (error) {
        console.error("Error encrypting file:", error);
        reject(error);
      }
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

    const isValid = dootCrypto.verifySignature(
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

  // Download file from safe (with decryption)
  async downloadFile(fileId) {
    const file = await this.getFile(fileId);
    if (!file) return;

    try {
      let decryptedData = file.data;

      // Decrypt if the file is encrypted
      if (file.encrypted && file.fileKey) {
        // First decrypt with file key
        const decryptedWithFileKey = CryptoJS.AES.decrypt(file.data, file.fileKey).toString(CryptoJS.enc.Utf8);

        // Then decrypt the dootCrypto encryption
        decryptedData = dootCrypto.decryptMessage(decryptedWithFileKey);
      }

      const link = document.createElement("a");
      link.href = `data:${file.type};base64,${decryptedData}`;
      link.download = file.name;
      link.click();

      console.log("File decrypted and downloaded:", file.name);
    } catch (error) {
      console.error("Error decrypting file:", error);
      showQuickToast("Failed to decrypt file", "error");
    }
  }

  // Download file by index (used in chat interface)
  async downloadFileByIndex(index) {
    const files = await this.getAllFiles();
    const file = files[index];
    if (file) {
      await this.downloadFile(file.id);
    }
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

  // Export all safe data as ZIP
  async exportSafe() {
    try {
      const files = await this.getAllFiles();

      // Create a new JSZip instance
      const zip = new JSZip();

      // Add metadata file
      const metadata = {
        exportDate: new Date().toISOString(),
        totalFiles: files.length,
        version: "1.0",
        description: "ChitChat Safe Export - Encrypted Files"
      };
      zip.file("metadata.json", JSON.stringify(metadata, null, 2));

      // Add each file to the ZIP
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `file_${i + 1}_${file.name || 'unnamed'}`;
        const fileData = file.data; // This is already base64 encoded

        zip.file(fileName, fileData, { base64: true });
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Download the ZIP file
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `doot_safe_export_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();

      showQuickToast(`Safe exported successfully (${files.length} files)`, "success", 3000);
    } catch (error) {
      console.error("Export error:", error);
      showQuickToast("Failed to export Safe", "error", 3000);
    }
  }

  // Verify all files in safe
  async verifyAllFiles() {
    try {
      const files = await this.getAllFiles();
      let verifiedCount = 0;
      let failedCount = 0;

      for (const file of files) {
        if (file.from) {
          const isValid = await this.verifyFile(file.id, file.from);
          if (isValid) verifiedCount++;
          else failedCount++;
        }
      }

      showQuickToast(
        `Verification complete: ${verifiedCount} verified, ${failedCount} failed`,
        failedCount > 0 ? "warning" : "success",
        4000
      );
    } catch (error) {
      console.error("Bulk verification error:", error);
      showQuickToast("Failed to verify files", "error", 3000);
    }
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
