import keytar from "keytar";
import { KEYCHAIN_ACCOUNT, KEYCHAIN_SERVICE } from "../../shared/constants";

export async function getApiKey(): Promise<string | null> {
  return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
}

export async function setApiKey(apiKey: string): Promise<void> {
  const normalized = apiKey.trim();

  if (!normalized) {
    await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    return;
  }

  await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, normalized);
}
