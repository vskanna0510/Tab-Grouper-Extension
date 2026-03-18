const path = require("path");

/** @type {import("webpack").Configuration} */
module.exports = {
  entry: {
    popup: "./src/popup/index.jsx",
    background: "./src/background/index.js"
  },
  output: {
    path: path.resolve(__dirname, "public"),
    filename: "[name].js",
    clean: false
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              [
                "@babel/preset-react",
                {
                  runtime: "automatic"
                }
              ]
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: [".js", ".jsx"]
  }
};

