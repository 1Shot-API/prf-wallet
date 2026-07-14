import {
  Base64UrlEncodedString,
  HexString,
  type ED25519PublicKey,
  type IHolderSigner,
} from "@1shotapi/ows-types";

function utf8ToHex(value: string): HexString {
  const bytes = new TextEncoder().encode(value);
  return HexString(
    `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`,
  );
}

function hexToBytes(hex: HexString): Uint8Array {
  const stripped = hex.slice(2);
  const bytes = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): Base64UrlEncodedString {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return Base64UrlEncodedString(
    btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  );
}

export type OwsEd25519SignerDeps = {
  getEd25519PublicKeyHex: () => Promise<ED25519PublicKey>;
  signDigest: (
    digestData: HexString,
    scheme?: "ed25519",
  ) => Promise<{ signature: HexString }>;
};

/** Bridges OWS Signing Layer Ed25519 to SD-JWT VC holder key binding. */
export function createOwsEd25519HolderSigner(deps: OwsEd25519SignerDeps): IHolderSigner {
  let cachedJwk: JsonWebKey | undefined;

  return {
    async publicKeyJwk() {
      if (cachedJwk) {
        return cachedJwk;
      }
      const hex = await deps.getEd25519PublicKeyHex();
      const bytes = hexToBytes(HexString(hex));
      if (bytes.length !== 32) {
        throw new Error("createOwsEd25519HolderSigner: ed25519 public key must be 32 bytes");
      }
      cachedJwk = {
        kty: "OKP",
        crv: "Ed25519",
        x: bytesToBase64Url(bytes),
      };
      return cachedJwk;
    },
    async signKbJwt(unsignedJwt) {
      const digestHex = utf8ToHex(unsignedJwt);
      const result = await deps.signDigest(digestHex, "ed25519");
      return bytesToBase64Url(hexToBytes(result.signature));
    },
  };
}
