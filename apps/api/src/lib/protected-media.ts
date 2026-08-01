import crypto from "crypto";
import { env } from "../config.js";
import { fail } from "./error.js";

const PREFIX = "enc:v1:";
const imageExpression = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/;

function encryptionKey(): Buffer {
  if (!env.FILE_ENCRYPTION_KEY) {
    return fail(503, "MEDIA_ENCRYPTION_NOT_CONFIGURED", "El almacenamiento seguro de evidencias no está configurado.");
  }
  return crypto.createHash("sha256").update(env.FILE_ENCRYPTION_KEY).digest();
}

function validateMagicBytes(mimeType: string, bytes: Buffer): void {
  const valid = (
    (mimeType === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (mimeType === "image/png" && bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mimeType === "image/webp" && bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP")
  );

  if (!valid) {
    fail(400, "INVALID_IMAGE_CONTENT", "La evidencia no coincide con el formato de imagen indicado.");
  }
}

/** Validates only JPEG, PNG or WebP data URLs and rejects disguised files. */
export function validateImageDataUrl(value: string): string {
  const match = imageExpression.exec(value);
  if (!match) {
    return fail(400, "INVALID_IMAGE", "La evidencia debe ser una imagen JPEG, PNG o WebP.");
  }

  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > env.MEDIA_MAX_IMAGE_BYTES) {
    return fail(413, "IMAGE_TOO_LARGE", `Cada imagen debe pesar como máximo ${Math.floor(env.MEDIA_MAX_IMAGE_BYTES / 1_000_000)} MB.`);
  }

  validateMagicBytes(match[1], bytes);
  return `data:${match[1]};base64,${bytes.toString("base64")}`;
}

/**
 * Encrypts image payloads before persistence. The data stays encrypted in
 * PostgreSQL backups and is decrypted only for an authorized API response.
 */
export function encryptProtectedImage(dataUrl: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(dataUrl, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

/** Supports legacy plaintext records until the one-time migration is run. */
export function decryptProtectedImage(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;

  const [ivText, tagText, ciphertextText] = value.slice(PREFIX.length).split(".");
  if (!ivText || !tagText || !ciphertextText) {
    return fail(500, "MEDIA_DECRYPTION_FAILED", "No fue posible leer una evidencia protegida.");
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return fail(500, "MEDIA_DECRYPTION_FAILED", "No fue posible leer una evidencia protegida.");
  }
}

export function protectImageInput(value: string): string {
  return encryptProtectedImage(validateImageDataUrl(value));
}
