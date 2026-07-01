const path = require("node:path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const signerPkgRoot = path.resolve(__dirname, "../../packages/ows-signer");
const signerPkgSrc = path.join(signerPkgRoot, "src");
const signerPublicDir = path.resolve(__dirname, "public/signer");

/** @param {import('webpack').Configuration} env */
module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: path.resolve(__dirname, "src/main.ts"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "wallet/[name].js",
      publicPath: "/wallet/",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".js"],
      conditionNames: ["import", "module", "browser", "default"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "index.html"),
        filename: "wallet/index.html",
        inject: "body",
        scriptLoading: "module",
      }),
      // Production: copy signer into dist. Dev serves live files via devServer.static below.
      ...(isProd
        ? [
            new CopyWebpackPlugin({
              patterns: [
                { from: signerPkgSrc, to: "signer/src" },
                {
                  from: path.join(signerPublicDir, "index.html"),
                  to: "signer/index.html",
                },
              ],
            }),
          ]
        : []),
    ],
    devtool: isProd ? "source-map" : "eval-source-map",
    devServer: {
      port: Number(process.env.PORT ?? 5174),
      host: "0.0.0.0",
      allowedHosts: "all",
      // Use page origin for HMR websocket (required when served via ngrok HTTPS).
      client: isProd
        ? false
        : {
            webSocketURL: "auto://0.0.0.0:0/ws",
          },
      devMiddleware: {
        publicPath: "/wallet/",
      },
      static: isProd
        ? {
            directory: path.resolve(__dirname, "dist"),
            publicPath: "/",
            watch: true,
          }
        : [
            // Live signer modules — avoid stale copies under dist/signer/src
            {
              directory: signerPkgSrc,
              publicPath: "/signer/src",
              watch: true,
            },
            {
              directory: signerPublicDir,
              publicPath: "/signer",
              watch: true,
            },
            {
              directory: path.resolve(__dirname, "dist"),
              publicPath: "/",
              watch: true,
            },
          ],
      historyApiFallback: {
        rewrites: [
          { from: /^\/wallet\/?$/, to: "/wallet/index.html" },
          { from: /^\/wallet\//, to: "/wallet/index.html" },
        ],
      },
    },
  };
};
