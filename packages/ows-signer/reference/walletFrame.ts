/**
 * WalletFrame - Core wallet functionality shared between wallet pages
 * This class encapsulates common wallet operations and state management
 * to reduce code duplication and improve maintainability.
 */

import { EVMAccountAddress, Signature } from "@1shotapi/1shotpay-common";
import { Delegation } from "@metamask/smart-accounts-kit";
import {
  startAuthentication,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { ethers, Wallet } from "ethers";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { ResultUtils } from "neverthrow-result-utils";
import Postmate from "postmate";

import {
  deriveEVMPrivateKeyFromSignature,
  getERC3009Signature,
  normalizePrfOutputToArrayBuffer,
  prfToValidEthPrivKey,
  stringToHexString,
} from "@/clientUtils/ClientCrypto";
import {
  IAuthenticationResult,
  IGetSubscriptionParams,
  IRPCWrapperParams,
  IRPCWrapperReturn,
  rpcCallbackEventName,
} from "@/clientUtils/ProxyTypes";
import { USER_ID_KEY, USERNAME_KEY } from "@/constants";
import { ObjectUtils } from "@/implementations/utils/ObjectUtils";
import { ISignedERC3009TransferWithAuthorization } from "@/interfaces/types/domain";
import { UserModel } from "@/interfaces/types/models";
import {
  BigNumberString,
  EVMPrivateKey,
  JSONString,
  SubAccountId,
  UnixTimestamp,
  USDCAmount,
} from "@/interfaces/types/primitives";

// Narrow clientExtensionResults for PRF reads without extending DOM types (extension
// results use `BufferSource`; Chrome may still surface shapes that need normalization).
type AuthenticationResultsWithPrf = {
  prf?: {
    results?: {
      first?: unknown;
    };
  };
};

function getPrfOutputShapeDebugInfo(
  prfOutput: unknown,
): Record<string, string | number | boolean | null> {
  const constructorName =
    prfOutput !== null &&
    prfOutput !== undefined &&
    typeof prfOutput === "object" &&
    "constructor" in prfOutput &&
    typeof prfOutput.constructor === "function"
      ? prfOutput.constructor.name
      : null;

  let byteLength: number | null = null;
  if (prfOutput instanceof ArrayBuffer) {
    byteLength = prfOutput.byteLength;
  } else if (ArrayBuffer.isView(prfOutput)) {
    byteLength = prfOutput.byteLength;
  } else if (Array.isArray(prfOutput)) {
    byteLength = prfOutput.length;
  }

  return {
    type: typeof prfOutput,
    constructorName,
    isArrayBuffer: prfOutput instanceof ArrayBuffer,
    isArrayBufferView: ArrayBuffer.isView(prfOutput),
    isArray: Array.isArray(prfOutput),
    byteLength,
    stringLength: typeof prfOutput === "string" ? prfOutput.length : null,
  };
}

// Use intersection type to avoid extension conflicts
type IExtendedAuthenticationExtensionsClientInputs =
  AuthenticationExtensionsClientInputs & {
    prf?: {
      eval: {
        first: Uint8Array;
      };
    };
  };

// Use intersection type instead of extends to avoid type conflicts
type IExtendedPublicKeyCredentialRequestOptionsJSON =
  PublicKeyCredentialRequestOptionsJSON & {
    challengeId: string;
    extensions: IExtendedAuthenticationExtensionsClientInputs;
  };

export interface IFullAuthenticationResult extends IAuthenticationResult {
  wallet?: Wallet;
}

export class WalletFrame {
  // Private state - kept in closure for security
  private authResult: IFullAuthenticationResult | null = null;
  private ceremonyResult: ResultAsync<IFullAuthenticationResult, Error> | null =
    null;
  private initialized: ResultAsync<Postmate.ChildAPI, Error> | null = null;

  constructor(readonly postmateModel: Postmate.Model) {
    // Create ResultAsync wrapper for the handshake promise
    this.initialized = ResultAsync.fromPromise(
      Promise.resolve(postmateModel),
      (e) => {
        return e as Error;
      },
    );
  }

  /**
   * Get the initialized Postmate ChildAPI
   */
  public getInitialized(): ResultAsync<Postmate.ChildAPI, Error> {
    if (this.initialized === null) {
      throw new Error(
        "Postmate not initialized - this should only happen in browser",
      );
    }
    return this.initialized;
  }

  /**
   * Get the current authentication result
   * If no authResult exists, checks session status via getStatus()
   * Returns ResultAsync to allow async session checking
   */
  public getAuthResult(): ResultAsync<IFullAuthenticationResult, Error> {
    // If we already have an authResult, return it immediately
    if (this.authResult !== null) {
      return okAsync(this.authResult);
    }

    // No authResult exists - check session status
    return this.getStatus().map((statusResult) => {
      // Convert IAuthenticationResult to IFullAuthenticationResult
      const fullResult: IFullAuthenticationResult = {
        success: statusResult.success,
        walletUnlocked: statusResult.walletUnlocked || false,
        user: statusResult.user,
        error: statusResult.error,
        canRetry: statusResult.canRetry,
        wallet: undefined, // Wallet not unlocked yet
      };
      // Store the result for future calls
      this.authResult = fullResult;
      return fullResult;
    });
  }

  /**
   * Get the current authentication result synchronously (for internal use)
   * This is used when we know the authResult is already set
   */
  public getAuthResultSync(): IFullAuthenticationResult | null {
    return this.authResult;
  }

  /**
   * Check session status by calling /api/user endpoint
   * This is the common implementation used by both WalletProxy and IntegrationWalletProxy
   */
  public getStatus(): ResultAsync<IAuthenticationResult, Error> {
    return this.fetchJson<{ session: boolean; user?: UserModel }>("/api/user")
      .map((sessionData) => {
        // If session is valid and user exists, return success
        if (sessionData.session && sessionData.user) {
          const authResult: IAuthenticationResult = {
            success: true,
            user: sessionData.user,
            walletUnlocked: false,
          };
          // Update internal authResult state
          this.authResult = {
            success: true,
            walletUnlocked: false,
            user: sessionData.user,
            wallet: undefined,
          };
          return authResult;
        } else {
          // No valid session
          return {
            success: false,
            walletUnlocked: false,
            error: "No valid session",
          } satisfies IAuthenticationResult;
        }
      })
      .orElse((error) => {
        return okAsync({
          success: false,
          walletUnlocked: false,
          error: error.message || "Failed to check session status",
        } satisfies IAuthenticationResult);
      });
  }

  /**
   * Set the authentication result
   */
  public setAuthResult(authResult: IFullAuthenticationResult | null): void {
    this.authResult = authResult;
  }

  /**
   * Clear the authentication result
   */
  public clearAuthResult(): void {
    this.authResult = null;
  }

  /**
   * Look up user by account address (1Shot Pay username and profile if registered).
   * Used by the ERC-3009 confirmation UI to show username and avatar instead of raw address.
   */
  public getUserDisplayByAccountAddress(
    accountAddress: EVMAccountAddress,
  ): ResultAsync<
    { userName: string | null; profileImageUrl: string | null },
    Error
  > {
    const url = `/api/user/accountAddress?accountAddress=${encodeURIComponent(accountAddress)}`;
    return this.fetchJson<{
      isUser: boolean;
      username: string | null;
      profileImageUrl: string | null;
    }>(url)
      .map((data) => ({
        userName: data.isUser && data.username ? data.username : null,
        profileImageUrl: data.profileImageUrl ?? null,
      }))
      .orElse(() => okAsync({ userName: null, profileImageUrl: null }));
  }

  public noteExternalActivity(): ResultAsync<void, Error> {
    return this.fetchJson<{ message: string }>("/api/user/ledger/external", {
      method: "GET",
    }).map(() => {
      return undefined;
    });
  }

  /**
   * Fetch JSON from a URL with automatic cookie handling
   */
  public fetchJson<T = object>(
    url: string,
    options: RequestInit = {},
  ): ResultAsync<T, Error> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    // Cookies are automatically included, no need for Authorization header

    return ResultAsync.fromPromise(
      fetch(url, {
        ...options,
        headers,
        credentials: "include", // Include cookies
      }),
      (e) => {
        return e as Error;
      },
    ).andThen((response) => {
      if (response.ok) {
        return ResultAsync.fromPromise(response.json(), (e) => {
          return e as Error;
        }).map((json) => {
          return json as T;
        });
      }
      return errAsync(new Error(`Failed to fetch JSON from ${url}`));
    });
  }

  /**
   * Assure wallet is unlocked, triggering passkey ceremony if needed
   */
  public assureWallet(): ResultAsync<ethers.Wallet, Error> {
    // Use synchronous getter since we need to check immediately
    const currentAuthResult = this.getAuthResultSync();
    if (currentAuthResult == null || currentAuthResult.user == null) {
      return errAsync(new Error("Not authenticated"));
    }

    // Check if the wallet is unlocked!
    if (
      currentAuthResult.walletUnlocked == false ||
      currentAuthResult.wallet == null
    ) {
      // We need to do a passkey ceremony
      return this.authenticateWithPasskey(
        currentAuthResult.user!.username!,
      ).andThen((newAuthResult) => {
        if (newAuthResult.success) {
          this.authResult = newAuthResult;
          return okAsync(newAuthResult.wallet!);
        }
        return errAsync(new Error(newAuthResult.error));
      });
    }

    return okAsync(currentAuthResult.wallet);
  }

  /**
   * Authenticate a user with their passkey and derive their EVM private key
   * This function handles the complete authentication flow:
   * 1. Get authentication options from server
   * 2. Start authentication with PRF extension
   * 3. Derive EVM private key from PRF output
   * 4. Verify authentication with server
   * 5. Return user, token, and wallet
   *
   * @param username - The username to authenticate
   * @returns ResultAsync that resolves to AuthenticationResult with user, token, wallet, and privateKey
   */
  public authenticateWithPasskey(
    username: string,
  ): ResultAsync<IFullAuthenticationResult, Error> {
    if (this.ceremonyResult != null) {
      console.log("Passkey authentication ceremony in progress");
      return this.ceremonyResult;
    }
    // Step 1: Get authentication options with username
    console.log("Beginning passkey authentication ceremony");
    this.ceremonyResult = ResultUtils.backoffAndRetry(
      () => {
        return this.fetchJson<IExtendedPublicKeyCredentialRequestOptionsJSON>(
          "/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username }),
          },
        );
      },
      [Error],
      3,
      2,
    )
      .map((authOptions) => {
        return {
          authOptions: authOptions,
          errorReturn: null as IFullAuthenticationResult | null,
        };
      })
      .orElse(() => {
        console.warn(
          `Failed to get authentcation options for username ${username}`,
        );
        return okAsync({
          authOptions:
            null as IExtendedPublicKeyCredentialRequestOptionsJSON | null,
          errorReturn: {
            success: false,
            walletUnlocked: false,
            error: `Username ${username} not found. Please check your username and try again.`,
            canRetry: true,
          } satisfies IFullAuthenticationResult,
        });
      })
      .andThen((authOptionsOrError) => {
        // The .orElse chain here is inordinately difficult to deal with. We might need to early abort.
        if (authOptionsOrError.errorReturn != null) {
          return okAsync(authOptionsOrError.errorReturn);
        }

        const authOptions = authOptionsOrError.authOptions!;
        // Add the PRF extension to the auth options
        const infoLabel = new TextEncoder().encode("com.example.eth-key-v1");
        authOptions.extensions = {
          prf: {
            eval: {
              first: infoLabel,
            },
          },
        };

        // Step 2: Start authentication on the client
        return ResultAsync.fromPromise(
          startAuthentication({
            optionsJSON: authOptions,
          }),
          (e) => {
            console.error("Error authenticating with passkey");
            console.error(e);
            return e as Error;
          },
        )
          .andThen((credential) => {
            // Extract PRF output and derive EVM private key
            let normalizedPrfOutput: ArrayBuffer | null = null;
            try {
              const rawPrfOutput = (
                credential.clientExtensionResults as AuthenticationResultsWithPrf
              ).prf?.results?.first;
              normalizedPrfOutput =
                normalizePrfOutputToArrayBuffer(rawPrfOutput);
              if (normalizedPrfOutput == null) {
                console.warn(
                  "Passkey PRF output has unsupported shape",
                  getPrfOutputShapeDebugInfo(rawPrfOutput),
                );
              }
            } catch {
              return okAsync({
                success: false,
                walletUnlocked: false,
                error:
                  "Passkey does not have PRF information, authentication failed. Make sure you are using the same passkey provider you registered with.",
                canRetry: false,
              } satisfies IFullAuthenticationResult);
            }

            if (normalizedPrfOutput == null) {
              return okAsync({
                success: false,
                walletUnlocked: false,
                error:
                  "Passkey does not have PRF information, authentication failed. Make sure you are using the same passkey provider you registered with.",
                canRetry: false,
              } satisfies IFullAuthenticationResult);
            }

            return ResultAsync.fromPromise(
              prfToValidEthPrivKey(normalizedPrfOutput, infoLabel),
              (e) => {
                return e as Error;
              },
            ).andThen((privateKey) => {
              const wallet = new ethers.Wallet(privateKey);

              console.log(
                `Successfully derived private key! Account address: ${wallet.address}`,
              );

              // Step 3: Verify authentication with server
              return this.fetchJson<{ user: UserModel }>("/api/auth/login", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  credential,
                  challengeId: authOptions.challengeId,
                  accountAddress: wallet.address,
                }),
              }).map((result) => {
                // Store username and user ID in localStorage (doesn't require React context)
                if (typeof window !== "undefined") {
                  localStorage.setItem(USERNAME_KEY, result.user.username);
                  localStorage.setItem(USER_ID_KEY, result.user.id);
                }

                // Cookie is set automatically by the server, no need to return token
                this.authResult = {
                  success: true,
                  walletUnlocked: true,
                  user: result.user,
                  wallet,
                } satisfies IFullAuthenticationResult;
                return this.authResult;
              });
            });
          })
          .orElse((e) => {
            // If we get here, it means the authentication failed, probably because the user canceled.
            console.error("Authentication failed", e);

            return okAsync({
              success: false,
              walletUnlocked: false,
              error:
                "Passkey authentication cancelled or timed out. Make sure you are in a native browser and not in an in-app web view, as passkey authenticatoin may be restricted.",
              canRetry: true,
            } satisfies IFullAuthenticationResult);
          });
      })
      .map((authResult) => {
        // Clear the ceremonyResult so that we can retry
        this.ceremonyResult = null;
        return authResult;
      });

    return this.ceremonyResult;
  }

  /**
   * RPC wrapper for Postmate communication
   * Handles serialization, deserialization, and event emission
   */
  public async rpcWrapper<T, TReturn extends object>(
    paramString: JSONString,
    callback: (params: T) => ResultAsync<TReturn, Error>,
  ): Promise<void> {
    // First we deserialize the request, which will have a nonce
    await this.getInitialized().andThen((parent) => {
      return ObjectUtils.deserialize<IRPCWrapperParams<T>>(paramString).andThen(
        (params) => {
          console.debug(
            `Processing RPC request for nonce ${params.callbackNonce}`,
          );
          // Then, we do the work
          return callback(params.params)
            .map((returnResult) => {
              // Now we have a result to return. We need to emit an event
              console.debug(
                `Emitting return RPC callback for nonce ${params.callbackNonce}`,
                returnResult,
              );
              parent.emit(
                rpcCallbackEventName,
                ObjectUtils.serialize({
                  success: true,
                  callbackNonce: params.callbackNonce,
                  result: ObjectUtils.serialize(returnResult),
                } satisfies IRPCWrapperReturn),
              );
            })
            .mapErr((e) => {
              // An error is just a different emit
              parent.emit(
                rpcCallbackEventName,
                ObjectUtils.serialize({
                  success: false,
                  callbackNonce: params.callbackNonce,
                  result: ObjectUtils.serialize(e),
                } satisfies IRPCWrapperReturn),
              );

              return e;
            });
        },
      );
    });
  }

  /**
   * Get ERC3009 signature (common implementation without confirmation)
   * This can be overridden by pages that need confirmation UI
   */
  public getERC3009Signature(
    destinationAddress: EVMAccountAddress,
    amount: BigNumberString,
    validUntil: UnixTimestamp,
    validAfter: UnixTimestamp,
  ): ResultAsync<ISignedERC3009TransferWithAuthorization, Error> {
    return this.assureWallet().andThen((wallet) => {
      return getERC3009Signature(
        wallet,
        destinationAddress,
        amount,
        validUntil,
        validAfter,
      );
    });
  }

  /**
   * Persist a signed subscription (delegation) via POST /api/subscriptions.
   * Uses fetchJson so the request is authenticated (session cookie).
   */
  public createSubscription(
    delegation: Delegation,
    params: IGetSubscriptionParams,
    minBalance?: USDCAmount,
  ): ResultAsync<void, Error> {
    const body = {
      name: params.name,
      description: params.description,
      delegateAccountAddress: params.destinationAccountAddress,
      delegation: JSON.stringify(delegation),
      amountPerDay: params.amountPerDay,
      amountPerWeek: params.amountPerWeek,
      amountPerMonth: params.amountPerMonth,
      minBalance: minBalance,
    };
    return this.fetchJson<{ result: { subscription: unknown } }>(
      "/api/subscriptions",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ).map(() => undefined);
  }

  /**
   * Derive the sub-account EVM private key from the main account.
   * Signs subAccountId with the main wallet and derives a key via PBKDF2.
   */
  public getSubAccountPrivateKey(
    subAccountId: SubAccountId,
  ): ResultAsync<EVMPrivateKey, Error> {
    return this.assureWallet()
      .andThen((wallet) => {
        return ResultAsync.fromPromise(
          wallet.signMessage(subAccountId),
          (e) => e as Error,
        );
      })
      .andThen((signatureHex) => {
        const salt = stringToHexString(subAccountId);
        return deriveEVMPrivateKeyFromSignature(
          Signature(signatureHex as `0x${string}`),
          salt,
        ).mapErr((e) => e as Error);
      });
  }
}
