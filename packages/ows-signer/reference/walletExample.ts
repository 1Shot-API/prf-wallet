/**
 * This page contains the actual derived wallet for internal 1ShotPay use only.
 * It is hosted via an iframe in the parent window and uses the Postmate library to communicate with the parent window.
 * This version has stricter security (X-Frame-Options: SAMEORIGIN) - only allows same-origin iframe embedding.
 */

"use client";

import {
  BigNumberString,
  EVMAccountAddress,
  Signature,
} from "@1shotapi/1shotpay-common";
import {
  createCaveat,
  createDelegation,
  Delegation,
  getSmartAccountsEnvironment,
  signDelegation,
} from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts";
import { createCaveatBuilder } from "@metamask/smart-accounts-kit/utils";
import { ethers } from "ethers";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import Postmate from "postmate";
import { useState, useEffect } from "react";
import {
  createPublicClient,
  createWalletClient,
  http,
  concat,
  pad,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
  getAddress,
  keccak256,
  Hex,
  verifyMessage,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signAuthorization } from "viem/actions";
import { base } from "viem/chains";

import {
  decryptAESEncryptedString,
  deriveAESKeyFromString,
  encryptString,
  getERC3009Signature,
  signatureComponentsToSignature,
} from "@/clientUtils/ClientCrypto";
import {
  BASE_CHAIN_ID,
  DELEGATION_MANAGER_CONTRACT_ADDRESS,
  ERC20_BALANCE_CHANGE_ENFORCER_ADDRESS,
  ERC20_BALANCE_LIMIT_ENFORCER_ADDRESS,
  ERC7710_CONTRACT_ADDRESS,
  SUB_ACCOUNT_7702_CONTRACT_ADDRESS,
  USDC_TOKEN_ADDRESS,
} from "@/clientUtils/constants";
import {
  IAuthenticationResult,
  IAuthorizeERC7710UpgradeParams,
  IAuthorizeERC7710UpgradeResponse,
  IAuthorizeSubAccountUpgradeParams,
  IAuthorizeSubAccountUpgradeResponse,
  ICreateDisableDelegationDelegationParams,
  ICreateSubAccountDelegationParams,
  IGetAccountAddressResponse,
  IGetAddSignerSignatureParams,
  IGetAddSignerSignatureResponse,
  IGetERC3009SignatureParams,
  IGetERC3009SignatureResponse,
  IGetSubAccountAddressParams,
  IGetSubAccountAddressResponse,
  ISignInParams,
  ISignInWithRecoveryPhraseParams,
  IStoreEncryptedEvmPrivateKeyParams,
  IStoreEncryptedEvmPrivateKeyResponse,
} from "@/clientUtils/ProxyTypes";
import {
  IFullAuthenticationResult,
  WalletFrame,
} from "@/clientUtils/WalletUtils";
import CopyableLink from "@/components/CopyableLink";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Toaster } from "@/components/ui/sonner";
import { USER_ID_KEY, USERNAME_KEY } from "@/constants";
import { ToastProvider } from "@/contexts/ToastContext";
import { ECopyableLinkMode } from "@/interfaces/types/enum";
import {
  UserModel,
  UserWithRecoveryDataModel,
} from "@/interfaces/types/models";
import {
  AccountRecoveryId,
  EVMContractAddress,
  EVMPrivateKey,
  JSONString,
} from "@/interfaces/types/primitives";

// WalletFrame instance - initialized when Postmate is ready
let walletFrame: WalletFrame | null = null;
let handshakePromise: Promise<Postmate.ChildAPI> | null = null;

const ADD_SIGNER_TYPE = "SubWallet:addSigner(address,uint256,uint256)";
// const REMOVE_SIGNER_TYPE = "SubWallet:removeSigner(address,uint256,uint256)";

function initializePostmate(): void {
  // Only initialize in browser - check typeof window, not window != null
  if (typeof window === "undefined") {
    return;
  }

  // Only initialize once
  if (handshakePromise !== null) {
    return;
  }

  const postmateModel = new Postmate.Model({
    // Returns the current user if the current session is valid
    // Never does a passkey ceremony - just checks session status
    getStatus: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper(params, () => {
        return walletFrame!
          .fetchJson<{ session: boolean; user?: UserModel }>("/api/user")
          .map((sessionData) => {
            // If session is valid and user exists, return success
            if (sessionData.session && sessionData.user) {
              // Update authResult with user info but keep walletUnlocked as false
              // (wallet will be unlocked on-demand when signatures are needed)
              const authResult: IAuthenticationResult = {
                success: true,
                user: sessionData.user,
                walletUnlocked: false,
              };
              walletFrame!.setAuthResult(authResult);

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
      });
    },

    // Expose your model to the Parent. Property values may be functions, promises, or regular values
    signIn: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      console.debug(
        "During sign in, navigator.userActivation.isActive",
        navigator.userActivation.isActive,
      );
      walletFrame.rpcWrapper<ISignInParams, IAuthenticationResult>(
        params,
        (callParams) => {
          const authResult = walletFrame!.getAuthResultSync();
          // If we already authenticated, we don't need to do it again
          if (authResult != null && authResult.success) {
            console.log("User is already logged in, skipping passkey ceremony");
            return okAsync({
              success: authResult.success,
              walletUnlocked: authResult.walletUnlocked,
              user: authResult.user,
              error: authResult.error,
              canRetry: authResult.canRetry,
            } satisfies IAuthenticationResult);
          }

          // This is where we'd call authenticateWithPasskey
          // NOTE: This is not awaited intentionally. These postmate model methods do not have a return value.
          // Emiting the event at the end of the function is equivalent to a return value.
          return walletFrame!
            .authenticateWithPasskey(callParams.username)
            .map((auth) => {
              walletFrame!.setAuthResult(auth);
              return {
                success: auth.success,
                walletUnlocked: auth.walletUnlocked,
                user: auth.user,
                error: auth.error,
                canRetry: auth.canRetry,
              } satisfies IAuthenticationResult;
            });
        },
      );
    },

    signInWithRecoveryPhrase: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<
        ISignInWithRecoveryPhraseParams,
        IAuthenticationResult
      >(params, ({ accountRecoveryId, accountRecoveryPhrase }) => {
        const authResult = walletFrame!.getAuthResultSync();
        // If we already authenticated, we don't need to do it again
        if (authResult != null) {
          return okAsync({
            success: authResult.success,
            walletUnlocked: authResult.walletUnlocked,
            user: authResult.user,
            error: authResult.error,
            canRetry: authResult.canRetry,
          } satisfies IAuthenticationResult);
        }

        // Fetch the user's recovery data from the server
        return walletFrame!
          .fetchJson<UserWithRecoveryDataModel>(`/api/user/recover`, {
            method: "POST",
            body: JSON.stringify({
              accountRecoveryId,
            }),
          })
          .andThen((userWithRecoveryData) => {
            return deriveAESKeyFromString(
              accountRecoveryPhrase,
              userWithRecoveryData.id.toLowerCase(),
            )
              .andThen((aesKey) => {
                return decryptAESEncryptedString(
                  userWithRecoveryData.accountRecoveryData,
                  aesKey,
                  userWithRecoveryData.id.toLowerCase(),
                );
              })
              .andThen((evmPrivateKey) => {
                return completeAuthentication(
                  accountRecoveryId,
                  EVMPrivateKey(evmPrivateKey),
                  userWithRecoveryData,
                );
              })
              .andThen((authResultValue) => {
                if (
                  authResultValue.success == false ||
                  authResultValue.user == null
                ) {
                  return errAsync(new Error("Authentication failed"));
                }
                // Set the global authResult so getAccountAddress and other functions can use it
                walletFrame!.setAuthResult(authResultValue);
                return okAsync({
                  success: true,
                  user: new UserModel(
                    authResultValue.user.id,
                    authResultValue.user.username,
                    authResultValue.user.accountAddress,
                    authResultValue.user.profileText,
                    authResultValue.user.profileImageUrl,
                    true,
                    authResultValue.user.hasApiToken,
                    authResultValue.user.subAccountsEnabled,
                    authResultValue.user.hasSubscriptions,
                  ),
                  walletUnlocked: authResultValue.walletUnlocked,
                } satisfies IAuthenticationResult);
              });
          })
          .orElse((err) => {
            console.warn("Error during authentication", err);
            return okAsync({
              success: false,
              walletUnlocked: false,
              error: err.message,
              canRetry: true,
            } satisfies IAuthenticationResult);
          });
      });
    },

    signOut: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<never, object>(params, () => {
        // Clear the authentication result but leave Postmate handshake intact
        walletFrame!.clearAuthResult();
        console.log("Wallet iframe: authResult cleared (signed out)");
        return okAsync({});
      });
    },

    storeEncryptedEvmPrivateKey: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<
        IStoreEncryptedEvmPrivateKeyParams,
        IStoreEncryptedEvmPrivateKeyResponse
      >(params, ({ passphrase, userId }) => {
        return walletFrame!
          .assureWallet()
          .andThen((wallet) => {
            // Derive AES key from passphrase and user ID
            return deriveAESKeyFromString(
              passphrase,
              userId.toLowerCase(),
            ).andThen((aesKey) => {
              // Encrypt the EVM private key
              return encryptString(
                wallet.privateKey, // Encrypt the wallet's private key
                aesKey,
                userId.toLowerCase(), // Use user ID as initialization vector
              );
            });
          })
          .andThen((encryptedData) => {
            // Send backup data to server
            return walletFrame!.fetchJson<AccountRecoveryId>(
              `/api/user/backup`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "include", // Include cookies
                body: JSON.stringify({
                  encryptedData,
                }),
              },
            );
          })
          .map((accountRecoveryId) => {
            // Update the registered user with the backup data
            return {
              success: true,
              accountRecoveryId: accountRecoveryId,
            } satisfies IStoreEncryptedEvmPrivateKeyResponse;
          });
      });
    },

    getERC3009Signature: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<
        IGetERC3009SignatureParams,
        IGetERC3009SignatureResponse
      >(params, ({ destinationAddress, amount, validUntil, validAfter }) => {
        return walletFrame!.assureWallet().andThen((wallet) => {
          return getERC3009Signature(
            wallet,
            destinationAddress,
            amount,
            validUntil,
            validAfter,
          ).map((signedTransfer) => {
            return {
              transfer: signedTransfer,
            } satisfies IGetERC3009SignatureResponse;
          });
        });
      });
    },

    authorizeERC7710Upgrade: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<
        IAuthorizeERC7710UpgradeParams,
        IAuthorizeERC7710UpgradeResponse
      >(params, () => {
        return walletFrame!.assureWallet().andThen((wallet) => {
          const account = privateKeyToAccount(
            wallet.privateKey as `0x${string}`,
          );
          const publicClient = createPublicClient({
            chain: base,
            transport: http(),
          });
          return ResultAsync.fromPromise(
            publicClient.getTransactionCount({
              address: account.address,
              blockTag: "pending",
            }),
            (e) => e as Error,
          )
            .andThen((nonce) => {
              const walletClient = createWalletClient({
                account,
                chain: base,
                transport: http(),
              });
              return ResultAsync.fromPromise(
                signAuthorization(walletClient, {
                  contractAddress: ERC7710_CONTRACT_ADDRESS as `0x${string}`,
                  chainId: BASE_CHAIN_ID,
                  nonce,
                }),
                (e) => e as Error,
              );
            })
            .map((authorization) => {
              const signature = signatureComponentsToSignature(
                authorization.r,
                authorization.s,
                authorization.yParity as 0 | 1,
              );
              return {
                address: authorization.address,
                nonce: authorization.nonce.toString(),
                chainId: authorization.chainId.toString(),
                signature,
              } satisfies IAuthorizeERC7710UpgradeResponse;
            });
        });
      });
    },

    createSubAccountDelegation: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<ICreateSubAccountDelegationParams, Delegation>(
        params,
        (p) => {
          return walletFrame!.assureWallet().andThen((wallet) => {
            const account = privateKeyToAccount(
              wallet.privateKey as `0x${string}`,
            );
            const mainAccountAddress = account.address;
            const delegateAddress = p.delegateAddress as `0x${string}`;
            const toBigInt = (
              v: number | string | null | undefined,
            ): bigint | undefined => {
              if (v === undefined || v === null) return undefined;
              const n = typeof v === "string" ? BigInt(v) : BigInt(v);
              return n > 0n ? n : undefined;
            };

            const amountPerDayBigInt = toBigInt(p.amountPerDay);
            const totalAmountBigInt = toBigInt(p.totalAmount);
            const minBalanceBigInt = toBigInt(p.minBalance);
            const maxSpendPerCallBigInt = toBigInt(p.maxSpendPerCall);

            const environment = getSmartAccountsEnvironment(base.id);
            const usdcAddress = USDC_TOKEN_ADDRESS as `0x${string}`;
            const scope = {
              type: "functionCall" as const,
              targets: [usdcAddress],
              selectors: ["transfer(address,uint256)"],
            };

            const caveatBuilder = createCaveatBuilder(environment);

            const value = encodeAbiParameters(
              [{ type: "address" }],
              [p.subAccountAddress as `0x${string}`],
            );

            caveatBuilder.addCaveat("allowedCalldata", {
              startIndex: 4,
              value,
            });

            if (totalAmountBigInt != null) {
              caveatBuilder.addCaveat("erc20TransferAmount", {
                tokenAddress: usdcAddress,
                maxAmount: totalAmountBigInt,
              });
            }

            if (amountPerDayBigInt != null) {
              caveatBuilder.addCaveat("erc20PeriodTransfer", {
                tokenAddress: usdcAddress,
                periodAmount: amountPerDayBigInt,
                periodDuration: 86400,
                startDate: Math.floor(Date.now() / 1000),
              });
            }

            if (minBalanceBigInt != null) {
              // ERC20BalanceLimitEnforcer terms: 53 bytes = 1 (enforceLowerLimit) + 20 (token) + 32 (amount)
              const terms = concat([
                "0x01" as `0x${string}`,
                pad(usdcAddress, { size: 20 }),
                pad(toHex(minBalanceBigInt), { size: 32 }),
              ]);
              caveatBuilder.addCaveat(
                createCaveat(
                  ERC20_BALANCE_LIMIT_ENFORCER_ADDRESS as `0x${string}`,
                  terms,
                ),
              );
            }

            if (maxSpendPerCallBigInt != null) {
              // ERC20BalanceChangeEnforcer terms (delegation-framework): 73 bytes =
              // 1 (0x01 = max decrease) + 20 (token) + 20 (recipient) + 32 (amount).
              const maxSpendTerms = concat([
                "0x01" as `0x${string}`,
                pad(usdcAddress, { size: 20 }),
                pad(mainAccountAddress as `0x${string}`, { size: 20 }),
                pad(toHex(maxSpendPerCallBigInt), { size: 32 }),
              ]);
              caveatBuilder.addCaveat(
                createCaveat(
                  ERC20_BALANCE_CHANGE_ENFORCER_ADDRESS as `0x${string}`,
                  maxSpendTerms,
                ),
              );
            }

            const caveats = caveatBuilder.build();
            const delegationWithoutSignature = createDelegation({
              to: delegateAddress,
              from: mainAccountAddress,
              environment,
              scope,
              caveats,
            });

            return ResultAsync.fromPromise(
              signDelegation({
                privateKey: wallet.privateKey as `0x${string}`,
                delegation: delegationWithoutSignature,
                chainId: base.id,
                delegationManager: environment.DelegationManager,
              }),
              (e) => e as Error,
            ).map((signature) => {
              const signedDelegation = {
                ...delegationWithoutSignature,
                signature,
              };
              return {
                delegate: signedDelegation.delegate,
                delegator: signedDelegation.delegator,
                authority: signedDelegation.authority,
                caveats: signedDelegation.caveats.map((c) => ({
                  enforcer: c.enforcer,
                  terms: c.terms,
                  args: c.args,
                })),
                salt: signedDelegation.salt,
                signature: signedDelegation.signature,
              } satisfies Delegation;
            });
          });
        },
      );
    },

    createDisableDelegationDelegation: async (
      params: JSONString,
    ): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<
        ICreateDisableDelegationDelegationParams,
        Delegation
      >(params, (p) => {
        return walletFrame!.assureWallet().andThen((wallet) => {
          const account = privateKeyToAccount(
            wallet.privateKey as `0x${string}`,
          );
          const mainAccountAddress = account.address;
          const delegateAddress = p.delegateAddress as `0x${string}`;
          const delegationToCancel = p.delegationToCancel as Delegation;
          const environment = getSmartAccountsEnvironment(base.id);
          const delegationManagerAddress =
            DELEGATION_MANAGER_CONTRACT_ADDRESS as `0x${string}`;

          const disableCalldata = DelegationManager.encode.disableDelegation({
            delegation: delegationToCancel,
          });

          const scope = {
            type: "functionCall" as const,
            targets: [delegationManagerAddress],
            selectors: [disableCalldata.slice(0, 10) as `0x${string}`],
          };
          const caveatBuilder = createCaveatBuilder(environment);
          caveatBuilder.addCaveat("exactCalldata", {
            calldata: disableCalldata,
          });
          const caveats = caveatBuilder.build();
          const delegationWithoutSignature = createDelegation({
            to: delegateAddress,
            from: mainAccountAddress,
            environment,
            scope,
            caveats,
          });

          return ResultAsync.fromPromise(
            signDelegation({
              privateKey: wallet.privateKey as `0x${string}`,
              delegation: delegationWithoutSignature,
              chainId: base.id,
              delegationManager: environment.DelegationManager,
            }),
            (e) => e as Error,
          ).map((signature) => {
            const signedDelegation = {
              ...delegationWithoutSignature,
              signature,
            };
            return {
              delegate: signedDelegation.delegate,
              delegator: signedDelegation.delegator,
              authority: signedDelegation.authority,
              caveats: signedDelegation.caveats.map((c) => ({
                enforcer: c.enforcer,
                terms: c.terms,
                args: c.args,
              })),
              salt: signedDelegation.salt,
              signature: signedDelegation.signature,
            } satisfies Delegation;
          });
        });
      });
    },

    authorizeSubAccountUpgrade: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<
        IAuthorizeSubAccountUpgradeParams,
        IAuthorizeSubAccountUpgradeResponse
      >(params, (p) => {
        return walletFrame!
          .getSubAccountPrivateKey(p.subAccountId)
          .andThen((subAccountKey) => {
            const account = privateKeyToAccount(subAccountKey as `0x${string}`);
            const publicClient = createPublicClient({
              chain: base,
              transport: http(),
            });
            return ResultAsync.fromPromise(
              publicClient.getTransactionCount({
                address: account.address,
                blockTag: "pending",
              }),
              (e) => e as Error,
            )
              .andThen((nonce) => {
                const walletClient = createWalletClient({
                  account,
                  chain: base,
                  transport: http(),
                });
                return ResultAsync.fromPromise(
                  signAuthorization(walletClient, {
                    contractAddress:
                      SUB_ACCOUNT_7702_CONTRACT_ADDRESS as `0x${string}`,
                    chainId: BASE_CHAIN_ID,
                    nonce,
                  }),
                  (e) => e as Error,
                );
              })
              .map((authorization) => {
                const signature = signatureComponentsToSignature(
                  authorization.r,
                  authorization.s,
                  authorization.yParity as 0 | 1,
                );
                return {
                  address: EVMContractAddress(authorization.address),
                  nonce: authorization.nonce.toString(),
                  chainId: authorization.chainId.toString(),
                  signature: Signature(signature),
                } satisfies IAuthorizeSubAccountUpgradeResponse;
              });
          });
      });
    },

    getAddSignerSignature: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<
        IGetAddSignerSignatureParams,
        IGetAddSignerSignatureResponse
      >(params, (p) => {
        return walletFrame!
          .getSubAccountPrivateKey(p.subAccountId)
          .andThen((subAccountKey) => {
            const account = privateKeyToAccount(subAccountKey as `0x${string}`);
            const nonce = BigInt(Math.floor(Math.random() * 2 ** 32)); // Random nonce, no chain read

            console.debug("Adding signer hash parameters", [
              ADD_SIGNER_TYPE,
              getAddress(p.signerAddress),
              nonce,
              BigInt(BASE_CHAIN_ID),
            ]);

            const encoded = encodeAbiParameters(
              parseAbiParameters("string, address, uint256, uint256"),
              [
                ADD_SIGNER_TYPE,
                getAddress(p.signerAddress),
                nonce,
                BigInt(BASE_CHAIN_ID),
              ],
            );
            const hash = keccak256(encoded);

            return ResultAsync.fromPromise(
              account.signMessage({
                message: { raw: hash as Hex },
              }),
              (e) => e as Error,
            ).map(async (signature) => {
              // Attempt to recover the signer address from the signature
              const recoveredAddressMatches = await verifyMessage({
                address: account.address,
                message: { raw: hash as Hex },
                signature: signature as `0x${string}`,
              });

              console.log(
                `Signer account = ${account.address}, recovered address matches ${recoveredAddressMatches}`,
              );
              return {
                signature: Signature(signature),
                nonce: BigNumberString(nonce.toString()),
              } satisfies IGetAddSignerSignatureResponse;
            });
          });
      });
    },

    getSubAccountAddress: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper<
        IGetSubAccountAddressParams,
        IGetSubAccountAddressResponse
      >(params, (p) => {
        return walletFrame!
          .getSubAccountPrivateKey(p.subAccountId)
          .map((subAccountKey) => {
            const account = privateKeyToAccount(subAccountKey as `0x${string}`);
            return {
              accountAddress: account.address as EVMAccountAddress,
            } satisfies IGetSubAccountAddressResponse;
          });
      });
    },

    getAccountAddress: async (params: JSONString): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      walletFrame.rpcWrapper(params, () => {
        const authResult = walletFrame!.getAuthResultSync();
        if (authResult == null) {
          return errAsync(new Error("Not authenticated"));
        }

        return okAsync({
          accountAddress: authResult!.user!.accountAddress,
        } satisfies IGetAccountAddressResponse);
      });
    },

    displayPrivateKey: async (): Promise<void> => {
      if (!walletFrame) {
        return;
      }
      await ResultAsync.combine([
        walletFrame.assureWallet(),
        walletFrame.getInitialized(),
      ])
        .andThen(([wallet, parent]) => {
          console.log("Wallet unlocked, displaying private key");
          // Trigger the display of the private key in the component
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("displayPrivateKey", {
                detail: { privateKey: wallet.privateKey },
              }),
            );

            // Listen for close event and emit to parent
            const handleClose = () => {
              parent!.emit("PrivateKeyDisplayClosed", "");
              window.removeEventListener(
                "PrivateKeyDisplayClosed",
                handleClose,
              );
            };
            window.addEventListener("PrivateKeyDisplayClosed", handleClose);
          }
          return okAsync(undefined);
        })
        .mapErr((error) => {
          // If wallet is not available, emit error
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("displayPrivateKeyError", {
                detail: { error: error.message },
              }),
            );
          }
          return error;
        });
    },
  });

  // Create WalletFrame instance with the Postmate model
  walletFrame = new WalletFrame(postmateModel);
  handshakePromise = Promise.resolve(postmateModel);
}

// Initialize Postmate when module loads (only in browser)
if (typeof window !== "undefined") {
  initializePostmate();
}

// Default export - Next.js requires a React component
// This page is loaded in an iframe and communicates via Postmate
export default function WalletPage() {
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [, setError] = useState<string | null>(null);

  // Ensure Postmate is initialized (in case component renders before module init)
  useEffect(() => {
    if (typeof window !== "undefined" && handshakePromise === null) {
      initializePostmate();
    }

    // Listen for displayPrivateKey events
    const handleDisplayPrivateKey = (
      event: CustomEvent<{ privateKey: string }>,
    ) => {
      setPrivateKey(event.detail.privateKey);
      setError(null);
    };

    const handleDisplayPrivateKeyError = (
      event: CustomEvent<{ error: string }>,
    ) => {
      setError(event.detail.error);
      setPrivateKey(null);
    };

    window.addEventListener(
      "displayPrivateKey" as keyof WindowEventMap,
      handleDisplayPrivateKey as EventListener,
    );
    window.addEventListener(
      "displayPrivateKeyError" as keyof WindowEventMap,
      handleDisplayPrivateKeyError as EventListener,
    );

    return () => {
      window.removeEventListener(
        "displayPrivateKey" as keyof WindowEventMap,
        handleDisplayPrivateKey as EventListener,
      );
      window.removeEventListener(
        "displayPrivateKeyError" as keyof WindowEventMap,
        handleDisplayPrivateKeyError as EventListener,
      );
    };
  }, []);

  // If private key should be displayed, show it
  if (privateKey) {
    return (
      <ToastProvider>
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-10">
          <div className="max-w-2xl w-full text-center space-y-6">
            <p className="text-base text-red-600 font-bold leading-relaxed text-justify">
              Your private key gives full control of this account. It's a unique
              secret that proves ownership and allows you to access and move
              your funds, including using this account in other wallets or apps
              outside of 1Shot. Anyone who has this key can control the account.
              1ShotPay does not store your private key and cannot recover it if
              it's lost or compromised. We will never ask for your private key.
              Never share it with anyone.
            </p>
            <div className="flex flex-col items-center justify-center text-center">
              <Field className="w-auto">
                <CopyableLink
                  value={privateKey}
                  label="Private Key"
                  mode={ECopyableLinkMode.Obfuscated}
                />
              </Field>
            </div>
            <Button
              onClick={() => {
                setPrivateKey(null);
                setError(null);
                // Emit event to parent that display was closed
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("PrivateKeyDisplayClosed"),
                  );
                }
              }}
              variant="outline"
              className="border-black bg-white text-black hover:bg-gray-50"
            >
              Close
            </Button>
          </div>
        </div>
        <Toaster />
      </ToastProvider>
    );
  }

  // Default: hidden iframe
  return <div style={{ display: "none" }} />;
}

function completeAuthentication(
  accountRecoveryId: AccountRecoveryId,
  evmPrivateKey: EVMPrivateKey,
  user: UserWithRecoveryDataModel,
): ResultAsync<IFullAuthenticationResult, Error> {
  if (!walletFrame) {
    return errAsync(new Error("WalletFrame not initialized"));
  }

  const wallet = new ethers.Wallet(evmPrivateKey);

  console.log(`Account address: ${wallet.address}`);

  // Now that we have a wallet, we need to sign the recovery nonce
  return ResultAsync.fromPromise(wallet.signMessage(user.loginNonce), (e) => {
    return e as Error;
  }).andThen((signature) => {
    return walletFrame!
      .fetchJson<{ success: boolean }>(`/api/auth/login/recover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountRecoveryId: accountRecoveryId,
          signature: signature,
        }),
      })
      .map(() => {
        // Store username and user ID in localStorage (doesn't require React context)
        if (typeof window !== "undefined") {
          localStorage.setItem(USERNAME_KEY, user.username);
          localStorage.setItem(USER_ID_KEY, user.id);
        }

        // Cookie is set automatically by the server, no need to return token
        const authResult: IFullAuthenticationResult = {
          success: true,
          walletUnlocked: true,
          user: user,
          wallet,
        };
        walletFrame!.setAuthResult(authResult);
        return authResult;
      });
  });
}
