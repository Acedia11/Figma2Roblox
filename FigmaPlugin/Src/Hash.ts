import { sha256 } from "js-sha256";

export function HashBytes(Bytes: Uint8Array): string {
  return sha256(Bytes);
}
