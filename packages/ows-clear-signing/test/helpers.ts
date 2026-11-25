import { readFileSync } from "node:fs";
import {
  ClearSigningLookupResultSchema,
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  type IClearSigningDescriptor,
} from "@1shotapi/ows-types";
import type {
  IClearSigningEnvironment,
  IClearSigningTokenMetadata,
} from "../src/index.js";

export const SIGNER = EVMAccountAddress("0x1111111111111111111111111111111111111111");
export const USDC_BASE = EVMContractAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
export const USDC_OPTIMISM = EVMContractAddress("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85");
export const ONEINCH = EVMContractAddress("0x111111125421cA6dc452d289314280a0f8842A65");
export const BASE = EVMChainId("0x2105");

/** Parse a fixture through the same Zod schema the wallet applies to Relayer responses. */
export function loadDescriptor(name: string): IClearSigningDescriptor {
  const raw = JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
  const parsed = ClearSigningLookupResultSchema.parse(raw);
  if (!parsed.found) throw new Error("fixture is not a hit");
  return parsed.descriptor;
}

export function descriptorFrom(raw: unknown): IClearSigningDescriptor {
  const parsed = ClearSigningLookupResultSchema.parse({
    found: true,
    registrySha: "0123456789abcdef0123456789abcdef01234567",
    path: "test.json",
    descriptor: raw,
  });
  if (!parsed.found) throw new Error("unreachable");
  return parsed.descriptor;
}

export class TestEnvironment implements IClearSigningEnvironment {
  readonly tokens = new Map<string, IClearSigningTokenMetadata>([
    [USDC_BASE.toLowerCase(), { symbol: "USDC", decimals: 6 }],
    [USDC_OPTIMISM.toLowerCase(), { symbol: "USDC", decimals: 6 }],
  ]);
  readonly names = new Map<string, string>();

  async getTokenMetadata(_chainId: EVMChainId, address: EVMContractAddress) {
    return this.tokens.get(address.toLowerCase()) ?? null;
  }
  getNativeCurrency() {
    return { symbol: "ETH", decimals: 18 };
  }
  getChainName(chainId: EVMChainId) {
    return chainId === BASE ? "Base" : null;
  }
  async getAddressName(_chainId: EVMChainId, address: EVMAccountAddress) {
    return this.names.get(address.toLowerCase()) ?? null;
  }
}
