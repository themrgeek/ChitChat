class DOOTCrypto {
  constructor() {
    this.sessionKey = null;
  }

  // Generate session key
  generateSessionKey() {
    this.sessionKey = CryptoJS.lib.WordArray.random(32).toString();
    return this.sessionKey;
  }

  // Encrypt message with session key
  encryptMessage(message, key = this.sessionKey) {
    try {
      return CryptoJS.AES.encrypt(message, key).toString();
    } catch (error) {
      console.error("Encryption error:", error);
      return null;
    }
  }

  // Decrypt message with session key
  decryptMessage(encryptedMessage, key = this.sessionKey) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || null;
    } catch (error) {
      console.error("Decryption error:", error);
      return null;
    }
  }

  // Encrypt file data
  encryptFile(fileData, key = this.sessionKey) {
    return this.encryptMessage(fileData, key);
  }

  // Decrypt file data
  decryptFile(encryptedFileData, key = this.sessionKey) {
    return this.decryptMessage(encryptedFileData, key);
  }

  // Convert file to base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Get base64 data without data URL prefix
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // Convert base64 to file for download
  base64ToFile(base64Data, fileName, fileType) {
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    return new Blob([bytes], { type: fileType });
  }
}

// Global crypto instance
window.dootCrypto = new DOOTCrypto();
