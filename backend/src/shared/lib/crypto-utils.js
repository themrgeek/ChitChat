const crypto = require("crypto");
const CryptoJS = require("crypto-js");

class CryptoUtils {
  // Generate RSA key pair for digital signatures
  static generateKeyPair() {
    return crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });
  }

  // Generate session key for AES encryption
  static generateSessionKey() {
    return crypto.randomBytes(32).toString("hex");
  }

  // AES encryption for messages
  static encryptMessage(message, key) {
    return CryptoJS.AES.encrypt(message, key).toString();
  }

  // AES decryption for messages
  static decryptMessage(encryptedMessage, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Create digital signature
  static signData(data, privateKey) {
    const sign = crypto.createSign("SHA256");
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, "hex");
  }

  // Verify digital signature
  static verifySignature(data, signature, publicKey) {
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, "hex");
  }

  // Hash secret code for authentication
  static hashSecretCode(secretCode) {
    return crypto.createHash("sha256").update(secretCode).digest("hex");
  }
}

module.exports = CryptoUtils;
