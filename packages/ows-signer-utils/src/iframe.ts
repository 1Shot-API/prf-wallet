export type CreateSignerIframeOptions = {
  hidden?: boolean;
};

export function createSignerIframe(
  container: HTMLElement,
  signerUrl: string,
  options: CreateSignerIframeOptions = {},
): Promise<HTMLIFrameElement> {
  const hidden = options.hidden !== false;

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.src = signerUrl;
    iframe.allow =
      "publickey-credentials-get *; publickey-credentials-create *";
    iframe.title = "OWS custody signer";
    iframe.style.border = "0";

    if (hidden) {
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.position = "absolute";
      iframe.style.overflow = "hidden";
      iframe.style.clipPath = "inset(50%)";
    }

    iframe.addEventListener(
      "load",
      () => {
        resolve(iframe);
      },
      { once: true },
    );

    iframe.addEventListener(
      "error",
      () => {
        reject(new Error(`Failed to load custody signer iframe: ${signerUrl}`));
      },
      { once: true },
    );

    container.appendChild(iframe);
  });
}

export function getSignerOrigin(signerUrl: string): string {
  return new URL(signerUrl).origin;
}
