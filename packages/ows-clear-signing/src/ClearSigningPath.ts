import { ClearSigningError } from "./ClearSigningError.js";
import { ClearSigningValue, EClearSigningValueKind } from "./ClearSigningValue.js";

/** ERC-7730 path roots. */
export enum EClearSigningPathRoot {
  /** `#.` — decoded structured data. */
  Data = "data",
  /** `@.` — container (from / to / value / chainId). */
  Container = "container",
  /** `$.` — the (merged) descriptor document. */
  Descriptor = "descriptor",
  /** No root — relative to the enclosing group (the structured data at top level). */
  Relative = "relative",
}

export enum EClearSigningPathTokenKind {
  Name = "name",
  Index = "index",
  Slice = "slice",
  All = "all",
}

export interface IClearSigningPathToken {
  kind: EClearSigningPathTokenKind;
  name?: string;
  index?: number;
  start?: number;
  end?: number;
}

/** A value reached by a path, with the concrete (index-resolved) path used to reach it. */
export interface IClearSigningResolvedValue {
  value: ClearSigningValue;
  concrete: IClearSigningPathToken[];
}

const SEGMENT = /^([^[\]]*)((?:\[[^\]]*\])*)$/;
const BRACKET = /\[([^\]]*)\]/g;

/**
 * Parsed ERC-7730 path. Accepts both the normative dot form (`a.[0].b`, `x.[-20:]`) and the
 * bracket-attached form used in some spec examples (`recipients[0]`).
 */
export class ClearSigningPath {
  constructor(
    public readonly root: EClearSigningPathRoot,
    public readonly tokens: IClearSigningPathToken[],
    public readonly source: string,
  ) {}

  static parse(path: string): ClearSigningPath {
    const trimmed = path.trim();
    let root = EClearSigningPathRoot.Relative;
    let rest = trimmed;
    const rootChar = trimmed[0];
    if ((rootChar === "#" || rootChar === "@" || rootChar === "$") &&
        (trimmed.length === 1 || trimmed[1] === ".")) {
      root =
        rootChar === "#"
          ? EClearSigningPathRoot.Data
          : rootChar === "@"
            ? EClearSigningPathRoot.Container
            : EClearSigningPathRoot.Descriptor;
      rest = trimmed.slice(2);
    }
    const tokens: IClearSigningPathToken[] = [];
    if (rest.length > 0) {
      for (const segment of rest.split(".")) {
        const match = SEGMENT.exec(segment);
        if (!match || (match[1] === "" && match[2] === "")) {
          throw new ClearSigningError(`Invalid path: ${path}`);
        }
        if (match[1]) {
          tokens.push({ kind: EClearSigningPathTokenKind.Name, name: match[1] });
        }
        for (const bracket of match[2].matchAll(BRACKET)) {
          tokens.push(ClearSigningPath.parseBracket(bracket[1], path));
        }
      }
    }
    return new ClearSigningPath(root, tokens, trimmed);
  }

  private static parseBracket(body: string, path: string): IClearSigningPathToken {
    const content = body.trim();
    if (content === "") return { kind: EClearSigningPathTokenKind.All };
    if (/^-?\d+$/.test(content)) {
      return { kind: EClearSigningPathTokenKind.Index, index: Number(content) };
    }
    const slice = /^(-?\d*):(-?\d*)$/.exec(content);
    if (slice) {
      return {
        kind: EClearSigningPathTokenKind.Slice,
        start: slice[1] === "" ? undefined : Number(slice[1]),
        end: slice[2] === "" ? undefined : Number(slice[2]),
      };
    }
    throw new ClearSigningError(`Invalid path selector [${body}] in ${path}`);
  }

  /** Walk `tokens` from `start`, expanding `[]` and array slices into multiple results. */
  static walk(
    start: IClearSigningResolvedValue,
    tokens: IClearSigningPathToken[],
    source: string,
  ): IClearSigningResolvedValue[] {
    let current: IClearSigningResolvedValue[] = [start];
    for (const token of tokens) {
      const next: IClearSigningResolvedValue[] = [];
      for (const item of current) {
        next.push(...ClearSigningPath.step(item, token, source));
      }
      current = next;
    }
    return current;
  }

  private static step(
    item: IClearSigningResolvedValue,
    token: IClearSigningPathToken,
    source: string,
  ): IClearSigningResolvedValue[] {
    const { value } = item;
    switch (token.kind) {
      case EClearSigningPathTokenKind.Name: {
        if (value.kind === EClearSigningValueKind.Struct) {
          const member = (value.value as Record<string, ClearSigningValue>)[token.name!];
          if (member) return [{ value: member, concrete: [...item.concrete, token] }];
        }
        if (token.name === "length" && value.kind === EClearSigningValueKind.Array) {
          return [{
            value: ClearSigningValue.leaf("uint256", (value.value as unknown[]).length),
            concrete: [...item.concrete, token],
          }];
        }
        throw new ClearSigningError(`Path not found: ${source}`);
      }
      case EClearSigningPathTokenKind.Index: {
        if (value.kind === EClearSigningValueKind.Array) {
          const elements = value.value as ClearSigningValue[];
          const i = token.index! < 0 ? elements.length + token.index! : token.index!;
          const element = elements[i];
          if (!element) throw new ClearSigningError(`Index out of range: ${source}`);
          return [{
            value: element,
            concrete: [...item.concrete, { kind: EClearSigningPathTokenKind.Index, index: i }],
          }];
        }
        const i = token.index!;
        return [{
          value: value.sliceBytes(i, i === -1 ? undefined : i + 1),
          concrete: [...item.concrete, token],
        }];
      }
      case EClearSigningPathTokenKind.All:
      case EClearSigningPathTokenKind.Slice: {
        if (value.kind === EClearSigningValueKind.Array) {
          const elements = value.value as ClearSigningValue[];
          const from = ClearSigningValue.sliceIndex(token.start, elements.length, 0);
          const to = ClearSigningValue.sliceIndex(token.end, elements.length, elements.length);
          const out: IClearSigningResolvedValue[] = [];
          for (let i = from; i < to; i++) {
            out.push({
              value: elements[i],
              concrete: [...item.concrete, { kind: EClearSigningPathTokenKind.Index, index: i }],
            });
          }
          return out;
        }
        if (token.kind === EClearSigningPathTokenKind.All) {
          throw new ClearSigningError(`[] applied to non-array: ${source}`);
        }
        return [{
          value: value.sliceBytes(token.start, token.end),
          concrete: [...item.concrete, token],
        }];
      }
    }
  }

  /** Plain JSON navigation for `$.` paths over the descriptor document. */
  static lookupJson(document: unknown, tokens: IClearSigningPathToken[], source: string): unknown {
    let current: unknown = document;
    for (const token of tokens) {
      if (token.kind === EClearSigningPathTokenKind.Name && current && typeof current === "object") {
        current = (current as Record<string, unknown>)[token.name!];
      } else if (token.kind === EClearSigningPathTokenKind.Index && Array.isArray(current)) {
        current = current[token.index! < 0 ? current.length + token.index! : token.index!];
      } else {
        throw new ClearSigningError(`Descriptor path not found: ${source}`);
      }
      if (current === undefined) {
        throw new ClearSigningError(`Descriptor path not found: ${source}`);
      }
    }
    return current;
  }
}
