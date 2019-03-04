const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'index.js'
  },
  devtool: 'source-map',
  devServer: {
    port: 3000,
	host: '0.0.0.0',
    clientLogLevel: 'none',
    stats: 'errors-only'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
	new CopyPlugin([{from: 'labels.json', to: 'labels.json'}, {from: 'index.css', to: 'index.css'}, {from: 'img', to: 'img'}]),
    new HtmlPlugin({
      template: 'index.html'
    })
  ]
};
