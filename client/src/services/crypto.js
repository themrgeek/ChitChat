import CryptoJS from "crypto-js";

class CryptoService {
  constructor() {
    this.sessionKey = null;
  }

  generateSessionKey() {
    this.sessionKey = CryptoJS.lib.WordArray.random(32).toString();
    return this.sessionKey;
  }

  setSessionKey(key) {
    this.sessionKey = key;
  }

  encryptMessage(message, key = this.sessionKey) {
    if (!key) {
      console.error("No encryption key available");
      return null;
    }
    try {
      return CryptoJS.AES.encrypt(message, key).toString();
    } catch (error) {
      console.error("Encryption error:", error);
      return null;
    }
  }

  decryptMessage(encryptedMessage, key = this.sessionKey) {
    if (!key) {
      console.error("No decryption key available");
      return null;
    }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || null;
    } catch (error) {
      console.error("Decryption error:", error);
      return null;
    }
  }

  encryptFile(fileData, key = this.sessionKey) {
    return this.encryptMessage(fileData, key);
  }

  decryptFile(encryptedFileData, key = this.sessionKey) {
    return this.decryptMessage(encryptedFileData, key);
  }

  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  base64ToBlob(base64Data, fileType) {
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    return new Blob([bytes], { type: fileType });
  }

  generateMessageId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}

export const cryptoService = new CryptoService();
export default cryptoService;
