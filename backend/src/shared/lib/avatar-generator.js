const adjectives = [
  "Shadow",
  "Silent",
  "Ghost",
  "Phantom",
  "Stealth",
  "Dark",
  "Mystic",
  "Cyber",
  "Digital",
  "Binary",
  "Quantum",
  "Neon",
  "Vector",
  "Null",
  "Zero",
  "Alpha",
  "Omega",
  "Sigma",
  "Steel",
  "Iron",
];

const nouns = [
  "Hunter",
  "Runner",
  "Watcher",
  "Stalker",
  "Operator",
  "Agent",
  "Byte",
  "Hacker",
  "Cipher",
  "Protocol",
  "Firewall",
  "Router",
  "Node",
  "Stream",
  "Virus",
  "Worm",
  "Trojan",
  "Phantom",
  "Ghost",
  "Spectre",
];

class AvatarGenerator {
  static generateAvatarName() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    return `${adj}_${noun}_${number}`;
  }

  static generateTempPassword() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

module.exports = AvatarGenerator;
