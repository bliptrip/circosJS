const path = require('path');

module.exports = {
  entry: './src/circos',
  output: {
    filename: 'circos.es6.js',
    library: {  type: 'umd',
                name: "circosjs" },
    uniqueName: "circosjs-webpack"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: [
          path.join(__dirname, 'src')
        ],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        loader: 'style-loader'
      },
      {
        test: /\.css$/,
        loader: 'css-loader'
      }
    ]
  }
}
