import { describe, expect, it } from "vitest";
import { decryptMaybeSecret, encryptSecret, isEncryptedSecret } from "./services/crypto";

describe("integration secret crypto", () => {
  it("encrypts and decrypts stored tokens", () => {
    const encrypted = encryptSecret("token-super-secreto");

    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptMaybeSecret(encrypted)).toBe("token-super-secreto");
  });

  it("keeps legacy plaintext tokens readable", () => {
    expect(isEncryptedSecret("token-antigo-em-texto-puro")).toBe(false);
    expect(decryptMaybeSecret("token-antigo-em-texto-puro")).toBe("token-antigo-em-texto-puro");
  });
});
