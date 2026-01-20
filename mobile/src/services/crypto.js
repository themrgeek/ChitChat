import CryptoJS from "crypto-js";

class CryptoService {
  constructor() {
    this.sessionKey = null;
  }

  generateSessionKey() {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  setSessionKey(key) {
    this.sessionKey = key;
  }

  getSessionKey() {
    return this.sessionKey;
  }

  encryptMessage(message) {
    if (!this.sessionKey) {
      console.error("No session key set");
      return null;
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(
        message,
        this.sessionKey,
      ).toString();
      return encrypted;
    } catch (error) {
      console.error("Encryption error:", error);
      return null;
    }
  }

  decryptMessage(encryptedMessage) {
    if (!this.sessionKey) {
      console.error("No session key set");
      return null;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, this.sessionKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted;
    } catch (error) {
      console.error("Decryption error:", error);
      return null;
    }
  }

  generateMessageId() {
    return `msg_${Date.now()}_${CryptoJS.lib.WordArray.random(4).toString()}`;
  }

  clearSession() {
    this.sessionKey = null;
  }
}

export const cryptoService = new CryptoService();
export default cryptoService;
