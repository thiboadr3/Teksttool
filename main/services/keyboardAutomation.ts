import { keyboard } from "@nut-tree-fork/nut-js";
import { Key } from "@nut-tree-fork/shared";

function getModifierKey(): Key {
  return process.platform === "darwin" ? Key.LeftCmd : Key.LeftControl;
}

export async function simulateCopyShortcut(): Promise<void> {
  const modifier = getModifierKey();
  await keyboard.pressKey(modifier);
  await keyboard.type(Key.C);
  await keyboard.releaseKey(modifier);
}

export async function simulatePasteShortcut(): Promise<void> {
  const modifier = getModifierKey();
  await keyboard.pressKey(modifier);
  await keyboard.type(Key.V);
  await keyboard.releaseKey(modifier);
}
