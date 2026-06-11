/**
 * Criptografia simétrica para secrets (AES-256-GCM).
 * Chave derivada de SECRETS_KEY (ou JWT_SECRET como fallback) via scrypt.
 * Formato armazenado: base64(salt).base64(iv).base64(tag).base64(ciphertext)
 */
import crypto from "crypto";

function getKey(salt: Buffer): Buffer {
  const secret = process.env.SECRETS_KEY || process.env.JWT_SECRET || "cacarejar-dev-key";
  return crypto.scryptSync(secret, salt, 32);
}

export function encryptSecret(plain: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = getKey(salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [salt, iv, tag, enc].map(b => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  try {
    const [saltB, ivB, tagB, encB] = stored.split(".");
    const salt = Buffer.from(saltB, "base64");
    const iv = Buffer.from(ivB, "base64");
    const tag = Buffer.from(tagB, "base64");
    const enc = Buffer.from(encB, "base64");
    const key = getKey(salt);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** Máscara para exibir no frontend (nunca o valor pleno). */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 8) return "••••";
  return `${plain.slice(0, 4)}••••${plain.slice(-3)}`;
}
