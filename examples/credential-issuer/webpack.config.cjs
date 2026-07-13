const path = require("node:path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** @param {import('webpack').Configuration} env */
module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: path.resolve(__dirname, "src/main.ts"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".js", ".css"],
      extensionAlias: {
        ".js": [".ts", ".js"],
      },
      conditionNames: ["import", "module", "browser", "default"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "ts-loader",
            options: { transpileOnly: true },
          },
          exclude: /node_modules/,
        },
        { test: /\.css$/, use: ["style-loader", "css-loader"] },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "index.html"),
        inject: "body",
        scriptLoading: "module",
      }),
      new webpack.DefinePlugin({
        __WALLET_IFRAME_URL__: JSON.stringify(walletIframeUrl()),
      }),
    ],
    devtool: isProd ? "source-map" : "eval-source-map",
    devServer: {
      port: Number(process.env.PORT ?? 5175),
      host: "0.0.0.0",
      allowedHosts: "all",
      historyApiFallback: true,
    },
  };
};

function walletIframeUrl() {
  const domain = normalizeNgrokDomain(process.env.NGROK_DOMAIN);
  if (domain) {
    return `https://${domain}/wallet/`;
  }
  return "http://localhost:5174/wallet/";
}

function normalizeNgrokDomain(value) {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(url).hostname;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

module.exports.walletIframeUrl = walletIframeUrl;
