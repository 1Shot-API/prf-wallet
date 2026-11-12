import {
  decodeFunctionData,
  domainSeparator,
  formatUnits,
  toFunctionSelector,
  type TypedDataDomain,
} from "viem";
import {
  ChainUtils,
  type ClearSigningCanonicalString,
  EClearSigningFieldFormat,
  EClearSigningIteration,
  EClearSigningVisibility,
  EVMAccountAddress,
  EVMContractAddress,
  EVMContractAddressSchema,
  type EVMChainId,
  type IClearSigningDeployment,
  type IClearSigningDescriptor,
  type IClearSigningField,
} from "@1shotapi/ows-types";
import { ClearSigningError } from "./ClearSigningError.js";
import {
  ClearSigningPath,
  EClearSigningPathRoot,
  type IClearSigningPathToken,
  type IClearSigningResolvedValue,
} from "./ClearSigningPath.js";
import { ClearSigningUtils } from "./ClearSigningUtils.js";
import { ClearSigningValue, EClearSigningValueKind } from "./ClearSigningValue.js";
import {
  EClearSigningDisplayKind,
  type IClearSigningDisplay,
  type IClearSigningDisplayField,
  type IClearSigningEnvironment,
  type IClearSigningIntentDetail,
  type IClearSigningTransaction,
  type IClearSigningTypedData,
} from "./interfaces.js";

/** Largest unix timestamp (seconds) JS `Date` can represent. */
const MAX_DATE_SECONDS = 8_640_000_000_000n;

const SI_PREFIXES: Array<[number, string]> = [
  [24, "Y"], [21, "Z"], [18, "E"], [15, "P"], [12, "T"], [9, "G"], [6, "M"], [3, "k"],
  [0, ""], [-3, "m"], [-6, "µ"], [-9, "n"], [-12, "p"], [-15, "f"], [-18, "a"], [-21, "z"], [-24, "y"],
];

type RenderedValue = Omit<IClearSigningDisplayField, "label" | "optional">;

/**
 * Renders an ERC-7730 descriptor (as resolved by the Relayer) against a transaction or EIP-712
 * message. Every binding the wallet can check locally is re-verified here, so a compromised
 * resolver can at worst mislabel fields — never change decoded values:
 *
 * - calldata: `context.contract.deployments` contains (chainId, to); the format key's selector
 *   equals `data[0:4]`; arguments are decoded by the wallet from the format key.
 * - EIP-712: `context.eip712` deployments / domain / domainSeparator constraints hold; the
 *   format key equals `encodeType(primaryType)` of the message being signed.
 *
 * Throws {@link ClearSigningError} when the descriptor cannot be applied; callers fall back to
 * their generic display.
 */
export class ClearSigningFormatter {
  constructor(private readonly environment: IClearSigningEnvironment) {}

  async formatCalldata(
    descriptor: IClearSigningDescriptor,
    transaction: IClearSigningTransaction,
  ): Promise<IClearSigningDisplay> {
    const deployments = descriptor.context.contract?.deployments;
    if (!deployments?.length) {
      throw new ClearSigningError("Descriptor has no contract binding");
    }
    if (!this.matchesDeployment(deployments, transaction.chainId, transaction.to)) {
      throw new ClearSigningError("Descriptor is not bound to this contract");
    }

    const fn = ClearSigningUtils.parseFunctionKey(descriptor.format.key);
    const selector = toFunctionSelector(fn).toLowerCase();
    if (transaction.data.slice(0, 10).toLowerCase() !== selector) {
      throw new ClearSigningError("Descriptor format does not match calldata selector");
    }
    let args: readonly unknown[];
    try {
      args = decodeFunctionData({ abi: [fn], data: transaction.data }).args ?? [];
    } catch {
      throw new ClearSigningError("Calldata does not decode with descriptor signature");
    }

    const value = /^0x0*$/.test(transaction.value) ? 0n : BigInt(transaction.value);
    return new ClearSigningRenderSession(
      this.environment,
      descriptor,
      ClearSigningValue.fromAbiArguments(fn.inputs, args),
      this.container(transaction.from, transaction.to, value, transaction.chainId),
      transaction.chainId,
    ).render();
  }

  async formatTypedData(
    descriptor: IClearSigningDescriptor,
    typedData: IClearSigningTypedData,
    signer: EVMAccountAddress,
  ): Promise<IClearSigningDisplay> {
    const chainId = ClearSigningUtils.domainChainId(typedData.domain);
    const contract = EVMContractAddressSchema.safeParse(typedData.domain.verifyingContract);
    if (chainId === null || !contract.success) {
      throw new ClearSigningError("EIP-712 domain lacks chainId / verifyingContract");
    }
    this.verifyEip712Binding(descriptor, typedData, chainId, contract.data);

    const encoded = ClearSigningUtils.encodeType(typedData.types, typedData.primaryType);
    if (ClearSigningUtils.normalizeEncodeType(descriptor.format.key) !== encoded) {
      throw new ClearSigningError("Descriptor format does not match EIP-712 type");
    }

    return new ClearSigningRenderSession(
      this.environment,
      descriptor,
      ClearSigningValue.fromTypedData(typedData.types, typedData.primaryType, typedData.message),
      this.container(signer, contract.data, 0n, chainId),
      chainId,
    ).render();
  }

  private verifyEip712Binding(
    descriptor: IClearSigningDescriptor,
    typedData: IClearSigningTypedData,
    chainId: EVMChainId,
    verifyingContract: EVMContractAddress,
  ): void {
    const context = descriptor.context.eip712;
    if (!context) throw new ClearSigningError("Descriptor has no EIP-712 binding");
    let bound = false;

    if (context.deployments?.length) {
      if (!this.matchesDeployment(context.deployments, chainId, verifyingContract)) {
        throw new ClearSigningError("Descriptor is not bound to this verifying contract");
      }
      bound = true;
    }
    if (context.domain) {
      for (const [key, expected] of Object.entries(context.domain)) {
        if (!this.domainValueEquals(typedData.domain[key], expected)) {
          throw new ClearSigningError(`EIP-712 domain ${key} does not match descriptor`);
        }
        if (key === "verifyingContract") bound = true;
      }
    }
    if (context.domainSeparator) {
      let actual: string;
      try {
        actual = domainSeparator({ domain: typedData.domain as TypedDataDomain });
      } catch {
        throw new ClearSigningError("Cannot compute EIP-712 domain separator");
      }
      if (actual.toLowerCase() !== context.domainSeparator.toLowerCase()) {
        throw new ClearSigningError("EIP-712 domain separator does not match descriptor");
      }
      bound = true;
    }
    if (!bound) {
      throw new ClearSigningError("Descriptor is not bound to a verifying contract");
    }
  }

  private domainValueEquals(actual: unknown, expected: unknown): boolean {
    if (actual === undefined || actual === null) return false;
    const a = String(actual);
    const e = String(expected);
    if (/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(a) && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(e)) {
      return BigInt(a) === BigInt(e);
    }
    return a === e;
  }

  private matchesDeployment(
    deployments: IClearSigningDeployment[],
    chainId: EVMChainId,
    address: EVMContractAddress,
  ): boolean {
    const target = address.toLowerCase();
    return deployments.some(
      (d) => d.chainId === chainId && d.address.toLowerCase() === target,
    );
  }

  private container(
    from: EVMAccountAddress,
    to: EVMContractAddress,
    value: bigint,
    chainId: EVMChainId,
  ): ClearSigningValue {
    return ClearSigningValue.struct("container", {
      from: ClearSigningValue.leaf("address", from),
      to: ClearSigningValue.leaf("address", to),
      value: ClearSigningValue.leaf("uint256", value),
      chainId: ClearSigningValue.leaf("uint256", BigInt(chainId)),
    });
  }
}

/** Per-request rendering state (decoded data, container, `$.` document). */
class ClearSigningRenderSession {
  private readonly document: unknown;

  constructor(
    private readonly environment: IClearSigningEnvironment,
    private readonly descriptor: IClearSigningDescriptor,
    private readonly data: ClearSigningValue,
    private readonly containerValue: ClearSigningValue,
    private readonly chainId: EVMChainId,
  ) {
    this.document = {
      context: descriptor.context,
      metadata: descriptor.metadata,
      display: { formats: { [descriptor.format.key]: descriptor.format } },
    };
  }

  async render(): Promise<IClearSigningDisplay> {
    const fields: IClearSigningDisplayField[] = [];
    await this.renderFields(this.descriptor.format.fields, [], "", fields);
    const { intent, intentDetails } = this.intent();
    const metadata = this.descriptor.metadata;
    return {
      intent,
      intentDetails,
      interpolatedIntent: await this.interpolate(),
      contractName: metadata.contractName ?? null,
      owner: metadata.owner ?? null,
      url: metadata.info?.url ?? null,
      fields,
    };
  }

  // ── structure ──────────────────────────────────────────────────────────────

  private async renderFields(
    fields: IClearSigningField[],
    base: IClearSigningPathToken[],
    labelSuffix: string,
    out: IClearSigningDisplayField[],
  ): Promise<void> {
    for (const field of fields) {
      if (field.fields) {
        await this.renderGroup(field, base, labelSuffix, out);
        continue;
      }
      if (field.visible === EClearSigningVisibility.Never) continue;
      const values = this.fieldValues(field, base);
      for (let i = 0; i < values.length; i++) {
        if (!this.isVisible(field, values[i].value)) continue;
        const rendered = await this.formatField(field, values[i], i, values.length, base);
        out.push({
          ...rendered,
          label: this.label(field, i, values.length) + labelSuffix,
          optional: field.visible === EClearSigningVisibility.Optional,
        });
      }
    }
  }

  private async renderGroup(
    group: IClearSigningField,
    base: IClearSigningPathToken[],
    labelSuffix: string,
    out: IClearSigningDisplayField[],
  ): Promise<void> {
    const children = group.fields ?? [];
    if (!group.path) {
      await this.renderFields(children, base, labelSuffix, out);
      return;
    }
    const elements = this.resolve(group.path, base);
    const suffix = (i: number) =>
      elements.length > 1 ? `${labelSuffix} (${i + 1})` : labelSuffix;
    if (group.iteration === EClearSigningIteration.Sequential) {
      for (const child of children) {
        for (let i = 0; i < elements.length; i++) {
          await this.renderFields([child], elements[i].concrete, suffix(i), out);
        }
      }
      return;
    }
    for (let i = 0; i < elements.length; i++) {
      await this.renderFields(children, elements[i].concrete, suffix(i), out);
    }
  }

  private label(field: IClearSigningField, index: number, count: number): string {
    const base = field.label ?? "";
    if (count <= 1) return base;
    if (field.separator) {
      return `${base} ${field.separator.replace(/\{index\}/g, String(index))}`.trim();
    }
    return `${base} (${index + 1})`;
  }

  private fieldValues(
    field: IClearSigningField,
    base: IClearSigningPathToken[],
  ): IClearSigningResolvedValue[] {
    if (field.value !== undefined) {
      return [{ value: ClearSigningValue.constant(this.resolveConstant(field.value, base)), concrete: base }];
    }
    if (!field.path) throw new ClearSigningError("Field has neither path nor value");
    return this.resolve(field.path, base);
  }

  private isVisible(field: IClearSigningField, value: ClearSigningValue): boolean {
    const rule = field.visible;
    if (!rule || typeof rule === "string") return true;
    if (rule.mustMatch) {
      if (!rule.mustMatch.some((x) => this.valueEquals(value, x))) {
        throw new ClearSigningError(`Field ${field.path ?? ""} failed mustMatch`);
      }
      return false;
    }
    if (rule.ifNotIn) return !rule.ifNotIn.some((x) => this.valueEquals(value, x));
    return true;
  }

  private valueEquals(value: ClearSigningValue, expected: unknown): boolean {
    try {
      if (value.isInteger || typeof expected === "number") {
        return value.asBigInt() === ClearSigningValue.constant(expected).asBigInt();
      }
    } catch {
      return false;
    }
    return value.toRawString().toLowerCase() === String(expected).toLowerCase();
  }

  // ── paths & params ─────────────────────────────────────────────────────────

  private resolve(path: string, base: IClearSigningPathToken[]): IClearSigningResolvedValue[] {
    const parsed = ClearSigningPath.parse(path);
    switch (parsed.root) {
      case EClearSigningPathRoot.Descriptor:
        return [{
          value: ClearSigningValue.constant(
            ClearSigningPath.lookupJson(this.document, parsed.tokens, parsed.source),
          ),
          concrete: base,
        }];
      case EClearSigningPathRoot.Container:
        return ClearSigningPath.walk({ value: this.containerValue, concrete: [] }, parsed.tokens, parsed.source);
      case EClearSigningPathRoot.Data:
        return ClearSigningPath.walk({ value: this.data, concrete: [] }, parsed.tokens, parsed.source);
      case EClearSigningPathRoot.Relative:
        return ClearSigningPath.walk(
          { value: this.data, concrete: [] },
          [...base, ...parsed.tokens],
          parsed.source,
        );
    }
  }

  /** Resolve `$.` references and `{ map, keyPath }` map references inside constant params. */
  private resolveConstant(raw: unknown, base: IClearSigningPathToken[]): unknown {
    if (typeof raw === "string" && raw.startsWith("$.")) {
      const parsed = ClearSigningPath.parse(raw);
      return ClearSigningPath.lookupJson(this.document, parsed.tokens, raw);
    }
    if (Array.isArray(raw)) return raw.map((item) => this.resolveConstant(item, base));
    if (raw && typeof raw === "object" && "map" in raw && "keyPath" in raw) {
      const ref = raw as { map: unknown; keyPath: unknown };
      if (typeof ref.map !== "string" || typeof ref.keyPath !== "string") {
        throw new ClearSigningError("Invalid map reference");
      }
      const map = this.resolveConstant(ref.map, base) as { values?: Record<string, unknown> };
      const keys = this.resolve(ref.keyPath, base);
      if (keys.length !== 1 || !map?.values) throw new ClearSigningError("Invalid map reference");
      const key = keys[0].value.toRawString();
      const hit = map.values[key] ?? map.values[key.toLowerCase()];
      if (hit === undefined) throw new ClearSigningError(`No map value for ${key}`);
      return hit;
    }
    return raw;
  }

  /**
   * A `<name>Path` / `<name>` param pair. Path results are matched to the formatted value by
   * index when the field iterates over an array (spec "Array references in parameters").
   */
  private paramValue(
    params: Record<string, unknown>,
    pathKey: string,
    constantKey: string,
    index: number,
    count: number,
    base: IClearSigningPathToken[],
  ): ClearSigningValue | null {
    const path = params[pathKey];
    if (typeof path === "string") {
      const resolved = this.resolve(path, base);
      if (resolved.length === 1) return resolved[0].value;
      if (resolved.length === count) return resolved[index].value;
      throw new ClearSigningError(`Param ${pathKey} does not match field array length`);
    }
    if (params[constantKey] !== undefined) {
      return ClearSigningValue.constant(this.resolveConstant(params[constantKey], base));
    }
    return null;
  }

  private addressList(raw: unknown, base: IClearSigningPathToken[]): string[] {
    if (raw === undefined) return [];
    const resolved = this.resolveConstant(raw, base);
    const list = Array.isArray(resolved) ? resolved : [resolved];
    return list.filter((x): x is string => typeof x === "string").map((x) => x.toLowerCase());
  }

  private paramChainId(
    params: Record<string, unknown>,
    index: number,
    count: number,
    base: IClearSigningPathToken[],
  ): EVMChainId {
    const value = this.paramValue(params, "chainIdPath", "chainId", index, count, base);
    return value ? ChainUtils.asEVMChainId(value.asBigInt()) : this.chainId;
  }

  // ── formats ────────────────────────────────────────────────────────────────

  private async formatField(
    field: IClearSigningField,
    item: IClearSigningResolvedValue,
    index: number,
    count: number,
    base: IClearSigningPathToken[],
  ): Promise<RenderedValue> {
    const value = item.value;
    if (field.encryption) {
      return this.text(field.encryption.fallbackLabel ?? "[Encrypted]", value.toRawString(), "Encrypted value");
    }
    const params = field.params ?? {};
    switch (field.format ?? EClearSigningFieldFormat.Raw) {
      case EClearSigningFieldFormat.Amount:
        return this.formatNativeAmount(value, params, base);
      case EClearSigningFieldFormat.TokenAmount:
        return this.formatTokenAmount(value, params, index, count, base);
      case EClearSigningFieldFormat.Date:
        return this.formatDate(value, params);
      case EClearSigningFieldFormat.Duration:
        return this.formatDuration(value);
      case EClearSigningFieldFormat.Unit:
        return this.formatUnit(value, params);
      case EClearSigningFieldFormat.Enum:
        return this.formatEnum(value, params, base);
      case EClearSigningFieldFormat.ChainId: {
        const id = value.asBigInt();
        const name = this.environment.getChainName(ChainUtils.asEVMChainId(id));
        return this.text(name ?? `Chain ${id}`, ClearSigningValue.canonical(id));
      }
      case EClearSigningFieldFormat.AddressName:
        return this.formatAddressName(value, params, base);
      case EClearSigningFieldFormat.TokenTicker:
        return this.formatTokenTicker(value, params, index, count, base);
      case EClearSigningFieldFormat.NftName:
        return this.formatNftName(value, params, index, count, base);
      case EClearSigningFieldFormat.Calldata:
        return this.formatCalldata(value, params, index, count, base);
      case EClearSigningFieldFormat.Raw:
      case EClearSigningFieldFormat.InteroperableAddressName:
      default:
        return this.formatRaw(value);
    }
  }

  private formatRaw(value: ClearSigningValue): RenderedValue {
    if (value.kind === EClearSigningValueKind.Leaf && value.type === "address") {
      const address = value.asAddress();
      return { ...this.text(address, ClearSigningValue.canonical(address)), kind: EClearSigningDisplayKind.Address, address };
    }
    const raw = value.toRawString();
    return this.text(value.isInteger ? this.groupDigits(raw) : raw, raw);
  }

  private formatNativeAmount(
    value: ClearSigningValue,
    params: Record<string, unknown>,
    base: IClearSigningPathToken[],
  ): RenderedValue {
    const amount = value.asBigInt();
    const native = this.environment.getNativeCurrency(this.chainId);
    const display = this.overThreshold(amount, params, base)
      ? `${this.stringParam(params.message, "All")} ${native.symbol}`
      : `${this.formatDecimal(amount, native.decimals)} ${native.symbol}`;
    return { ...this.text(display, ClearSigningValue.canonical(amount)), kind: EClearSigningDisplayKind.NativeAmount };
  }

  private async formatTokenAmount(
    value: ClearSigningValue,
    params: Record<string, unknown>,
    index: number,
    count: number,
    base: IClearSigningPathToken[],
  ): Promise<RenderedValue> {
    const amount = value.asBigInt();
    const chainId = this.paramChainId(params, index, count, base);
    const tokenValue = this.paramValue(params, "tokenPath", "token", index, count, base);
    const token = tokenValue ? EVMContractAddress(tokenValue.asAddress()) : null;
    const natives = this.addressList(params.nativeCurrencyAddress, base);
    const isNative = token !== null && natives.includes(token.toLowerCase());

    let metadata = isNative ? this.environment.getNativeCurrency(chainId) : null;
    if (!metadata && token) {
      const own = this.descriptor.metadata.token;
      const to = this.containerValue.value as Record<string, ClearSigningValue>;
      if (own?.ticker && own.decimals !== undefined &&
          to.to.asAddress().toLowerCase() === token.toLowerCase()) {
        metadata = { symbol: own.ticker, decimals: own.decimals };
      } else {
        metadata = await this.environment.getTokenMetadata(chainId, token);
      }
    }

    const kind = isNative ? EClearSigningDisplayKind.NativeAmount : EClearSigningDisplayKind.TokenAmount;
    const tokenAddress = isNative ? null : token;
    if (!metadata) {
      return {
        ...this.text(this.groupDigits(amount.toString()), ClearSigningValue.canonical(amount), "Unknown token"),
        kind,
        address: token ? EVMAccountAddress(token) : null,
        tokenAddress,
      };
    }
    const display = this.overThreshold(amount, params, base)
      ? `${this.stringParam(params.message, "Unlimited")} ${metadata.symbol}`
      : `${this.formatDecimal(amount, metadata.decimals)} ${metadata.symbol}`;
    return { ...this.text(display, ClearSigningValue.canonical(amount)), kind, tokenAddress };
  }

  private formatDate(value: ClearSigningValue, params: Record<string, unknown>): RenderedValue {
    const n = value.asBigInt();
    if (params.encoding === "blockheight") {
      return { ...this.text(`Block ${this.groupDigits(n.toString())}`, ClearSigningValue.canonical(n)), kind: EClearSigningDisplayKind.Date };
    }
    if (n < 0n || n > MAX_DATE_SECONDS) {
      return { ...this.text(this.groupDigits(n.toString()), ClearSigningValue.canonical(n)), kind: EClearSigningDisplayKind.Date };
    }
    const iso = new Date(Number(n) * 1000).toISOString();
    return {
      ...this.text(`${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`, ClearSigningValue.canonical(n)),
      kind: EClearSigningDisplayKind.Date,
    };
  }

  private formatDuration(value: ClearSigningValue): RenderedValue {
    const n = value.asBigInt();
    const hours = n / 3600n;
    const minutes = (n % 3600n) / 60n;
    const seconds = n % 60n;
    const pad = (x: bigint) => x.toString().padStart(2, "0");
    return this.text(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, ClearSigningValue.canonical(n));
  }

  private formatUnit(value: ClearSigningValue, params: Record<string, unknown>): RenderedValue {
    const n = value.asBigInt();
    const decimals = typeof params.decimals === "number" ? params.decimals : 0;
    const unit = typeof params.base === "string" ? params.base : "";
    const plain = formatUnits(n, decimals);
    if (params.prefix !== true || n === 0n) {
      return this.text(`${plain}${unit}`, ClearSigningValue.canonical(n));
    }
    const asNumber = Number(plain);
    const exponent = Math.floor(Math.log10(Math.abs(asNumber)));
    const [power, symbol] =
      SI_PREFIXES.find(([p]) => exponent >= p) ?? SI_PREFIXES[SI_PREFIXES.length - 1];
    const mantissa = Number((asNumber / 10 ** power).toPrecision(6));
    return this.text(`${mantissa}${symbol}${unit}`, ClearSigningValue.canonical(n));
  }

  private formatEnum(
    value: ClearSigningValue,
    params: Record<string, unknown>,
    base: IClearSigningPathToken[],
  ): RenderedValue {
    const ref = params.$ref;
    const table = typeof ref === "string" ? this.resolveConstant(ref, base) : undefined;
    const raw = value.toRawString();
    const label =
      table && typeof table === "object" ? (table as Record<string, unknown>)[raw] : undefined;
    return typeof label === "string"
      ? this.text(label, raw)
      : this.text(raw, raw, "Unknown enum value");
  }

  private async formatAddressName(
    value: ClearSigningValue,
    params: Record<string, unknown>,
    base: IClearSigningPathToken[],
  ): Promise<RenderedValue> {
    let address = value.asAddress();
    const container = this.containerValue.value as Record<string, ClearSigningValue>;
    const sender = container.from.asAddress();
    if (this.addressList(params.senderAddress, base).includes(address.toLowerCase())) {
      address = sender;
    }
    if (address.toLowerCase() === sender.toLowerCase()) {
      return { ...this.text("You", ClearSigningValue.canonical(address)), kind: EClearSigningDisplayKind.Address, address };
    }
    const name = await this.environment.getAddressName(this.chainId, address);
    return { ...this.text(name ?? address, ClearSigningValue.canonical(address)), kind: EClearSigningDisplayKind.Address, address };
  }

  private async formatTokenTicker(
    value: ClearSigningValue,
    params: Record<string, unknown>,
    index: number,
    count: number,
    base: IClearSigningPathToken[],
  ): Promise<RenderedValue> {
    const address = value.asAddress();
    const token = EVMContractAddress(address);
    const metadata = await this.environment.getTokenMetadata(
      this.paramChainId(params, index, count, base),
      token,
    );
    return {
      ...this.text(metadata?.symbol ?? address, ClearSigningValue.canonical(address), metadata ? null : "Unknown token"),
      kind: EClearSigningDisplayKind.Address,
      address,
      tokenAddress: token,
    };
  }

  private async formatNftName(
    value: ClearSigningValue,
    params: Record<string, unknown>,
    index: number,
    count: number,
    base: IClearSigningPathToken[],
  ): Promise<RenderedValue> {
    const id = value.asBigInt();
    const collectionValue = this.paramValue(params, "collectionPath", "collection", index, count, base);
    const collection = collectionValue ? collectionValue.asAddress() : null;
    const name = collection
      ? await this.environment.getAddressName(this.chainId, collection)
      : null;
    return {
      ...this.text(`${name ?? collection ?? "Token"} #${id}`, ClearSigningValue.canonical(id)),
      kind: EClearSigningDisplayKind.Nft,
      address: collection,
    };
  }

  private async formatCalldata(
    value: ClearSigningValue,
    params: Record<string, unknown>,
    index: number,
    count: number,
    base: IClearSigningPathToken[],
  ): Promise<RenderedValue> {
    const calleeValue = this.paramValue(params, "calleePath", "callee", index, count, base);
    const callee = calleeValue ? calleeValue.asAddress() : null;
    const name = callee ? await this.environment.getAddressName(this.chainId, callee) : null;
    const raw = value.toRawString();
    return {
      ...this.text(
        `Embedded call to ${name ?? callee ?? "unknown contract"}`,
        raw,
        "Embedded call details are not decoded",
      ),
      kind: EClearSigningDisplayKind.Calldata,
      address: callee,
    };
  }

  // ── intent ─────────────────────────────────────────────────────────────────

  private intent(): { intent: string; intentDetails: IClearSigningIntentDetail[] } {
    const intent = this.descriptor.format.intent;
    if (typeof intent === "string") return { intent, intentDetails: [] };
    const intentDetails = Object.entries(intent).map(([label, value]) => ({ label, value }));
    return { intent: intentDetails.map((d) => d.value).join(" · "), intentDetails };
  }

  /** Render `interpolatedIntent`; any failure yields `null` (spec: fall back to `intent`). */
  private async interpolate(): Promise<string | null> {
    const template = this.descriptor.format.interpolatedIntent;
    if (!template) return null;
    try {
      let out = "";
      let i = 0;
      while (i < template.length) {
        const ch = template[i];
        if ((ch === "{" || ch === "}") && template[i + 1] === ch) {
          out += ch;
          i += 2;
        } else if (ch === "{") {
          const close = template.indexOf("}", i);
          if (close < 0) return null;
          out += await this.interpolateValue(template.slice(i + 1, close).trim());
          i = close + 1;
        } else if (ch === "}") {
          return null;
        } else {
          out += ch;
          i += 1;
        }
      }
      return out;
    } catch {
      return null;
    }
  }

  private async interpolateValue(path: string): Promise<string> {
    const field = this.findField(this.descriptor.format.fields, path, "");
    if (!field || (field.visible !== undefined && field.visible !== EClearSigningVisibility.Always)) {
      throw new ClearSigningError(`Interpolated path ${path} has no visible field`);
    }
    const values = this.fieldValues(field, []);
    const rendered = await Promise.all(
      values.map((v, i) => this.formatField(field, v, i, values.length, [])),
    );
    return rendered.map((r) => r.value).join(", ");
  }

  /** Find the field spec for an interpolation path (top level or flattened through groups). */
  private findField(
    fields: IClearSigningField[],
    path: string,
    prefix: string,
  ): IClearSigningField | null {
    const wanted = this.normalizePath(path);
    for (const field of fields) {
      const full = field.path ? (prefix ? `${prefix}.${field.path}` : field.path) : prefix;
      if (field.fields) {
        const hit = this.findField(field.fields, path, full);
        if (hit) return hit;
      } else if (field.path && this.normalizePath(full) === wanted) {
        return { ...field, path: full };
      }
    }
    return null;
  }

  private normalizePath(path: string): string {
    return path.trim().replace(/^#\./, "").replace(/\.\[/g, "[");
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private overThreshold(
    amount: bigint,
    params: Record<string, unknown>,
    base: IClearSigningPathToken[],
  ): boolean {
    if (params.threshold === undefined) return false;
    const threshold = ClearSigningValue.constant(this.resolveConstant(params.threshold, base));
    return amount >= threshold.asBigInt();
  }

  private stringParam(value: unknown, fallback: string): string {
    return typeof value === "string" && value.length > 0 ? value : fallback;
  }

  private formatDecimal(amount: bigint, decimals: number): string {
    const [whole, fraction] = formatUnits(amount, decimals).split(".");
    const grouped = this.groupDigits(whole);
    return fraction ? `${grouped}.${fraction}` : grouped;
  }

  private groupDigits(digits: string): string {
    const negative = digits.startsWith("-");
    const body = negative ? digits.slice(1) : digits;
    if (!/^\d+$/.test(body)) return digits;
    const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return negative ? `-${grouped}` : grouped;
  }

  private text(value: string, rawValue: ClearSigningCanonicalString, warning: string | null = null): RenderedValue {
    return {
      value,
      rawValue,
      kind: EClearSigningDisplayKind.Text,
      address: null,
      tokenAddress: null,
      warning,
    };
  }
}
