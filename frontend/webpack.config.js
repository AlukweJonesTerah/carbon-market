// webpack.config.js

const webpack = require('webpack');

module.exports = {
  // ... your existing config
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
  resolve: {
    fallback: {
      process: require.resolve('process/browser'),
    },
  },
  rules: [
    {
      test: /\.js$/,
      enforce: 'pre',
      use: ['source-map-loader'],
      exclude: /node_modules\/react-jazzicon/,
    },
  ],
};
