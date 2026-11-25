import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { cookieToInitialState } from "wagmi";

import { config } from "../wagmi";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "1Shot Wallet × wagmi",
  description: "Next.js App Router example for @1shotapi/wagmi-connector",
};

export default async function RootLayout(props: { children: ReactNode }) {
  const initialState = cookieToInitialState(
    config,
    (await headers()).get("cookie"),
  );

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: "2rem auto",
          maxWidth: 720,
          padding: "0 1rem",
        }}
      >
        <Providers initialState={initialState}>{props.children}</Providers>
      </body>
    </html>
  );
}
