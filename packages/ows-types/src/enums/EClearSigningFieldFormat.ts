import { z } from "zod";

/**
 * ERC-7730 field `format` identifiers (spec "Field formats" reference).
 */
export enum EClearSigningFieldFormat {
  Raw = "raw",
  Amount = "amount",
  TokenAmount = "tokenAmount",
  NftName = "nftName",
  Date = "date",
  Duration = "duration",
  Unit = "unit",
  Enum = "enum",
  ChainId = "chainId",
  Calldata = "calldata",
  AddressName = "addressName",
  TokenTicker = "tokenTicker",
  InteroperableAddressName = "interoperableAddressName",
}

const KNOWN_FORMATS = new Set<string>(Object.values(EClearSigningFieldFormat));

/**
 * Zod schema: ERC-7730 field format. Formats this version does not know are mapped to
 * {@link EClearSigningFieldFormat.Raw}, which the spec treats as the safe display.
 */
export const EClearSigningFieldFormatSchema = z
  .string()
  .transform((value) =>
    KNOWN_FORMATS.has(value)
      ? (value as EClearSigningFieldFormat)
      : EClearSigningFieldFormat.Raw,
  );
