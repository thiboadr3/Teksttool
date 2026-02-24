import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getAuthCredentials, setAuthCredentials } from "./keychainService";

const HASH_BYTE_LENGTH = 64;

interface StoredCredentials {
  version: 1;
  email: string;
  saltHex: string;
  hashHex: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function deriveHash(password: string, saltHex: string): Buffer {
  return scryptSync(password, Buffer.from(saltHex, "hex"), HASH_BYTE_LENGTH);
}

function parseCredentials(raw: string | null): StoredCredentials | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredCredentials;
    if (
      parsed.version !== 1 ||
      typeof parsed.email !== "string" ||
      typeof parsed.saltHex !== "string" ||
      typeof parsed.hashHex !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isValidEmail(email: string): boolean {
  return email.length >= 5 && email.includes("@");
}

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export class AuthService {
  private authenticated = false;
  private activeEmail: string | null = null;

  async getState(): Promise<{ initialized: boolean; authenticated: boolean; email: string | null }> {
    const credentials = parseCredentials(await getAuthCredentials());

    return {
      initialized: Boolean(credentials),
      authenticated: this.authenticated,
      email: credentials?.email ?? null
    };
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async register(emailRaw: string, passwordRaw: string): Promise<void> {
    const existing = parseCredentials(await getAuthCredentials());
    if (existing) {
      throw new Error("Account bestaat al. Log in om verder te gaan.");
    }

    const email = normalizeEmail(emailRaw);
    const password = passwordRaw.trim();

    if (!isValidEmail(email)) {
      throw new Error("Voer een geldig e-mailadres in.");
    }

    if (!isValidPassword(password)) {
      throw new Error("Wachtwoord moet minstens 8 tekens hebben.");
    }

    const saltHex = randomBytes(16).toString("hex");
    const hashHex = deriveHash(password, saltHex).toString("hex");

    const payload: StoredCredentials = {
      version: 1,
      email,
      saltHex,
      hashHex
    };

    await setAuthCredentials(JSON.stringify(payload));
    this.authenticated = true;
    this.activeEmail = email;
  }

  async login(emailRaw: string, passwordRaw: string): Promise<void> {
    const credentials = parseCredentials(await getAuthCredentials());
    if (!credentials) {
      throw new Error("Nog geen account ingesteld. Maak eerst een account aan.");
    }

    const email = normalizeEmail(emailRaw);
    const password = passwordRaw.trim();

    if (!email || !password) {
      throw new Error("E-mail en wachtwoord zijn verplicht.");
    }

    if (credentials.email !== email) {
      throw new Error("Onjuiste login.");
    }

    const expectedHash = Buffer.from(credentials.hashHex, "hex");
    const candidateHash = deriveHash(password, credentials.saltHex);

    if (expectedHash.length !== candidateHash.length || !timingSafeEqual(expectedHash, candidateHash)) {
      throw new Error("Onjuiste login.");
    }

    this.authenticated = true;
    this.activeEmail = email;
  }

  logout(): void {
    this.authenticated = false;
    this.activeEmail = null;
  }

  getActiveEmail(): string | null {
    return this.activeEmail;
  }
}
