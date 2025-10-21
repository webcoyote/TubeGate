const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const BuildNotifyPlugin = require('./scripts/webpack-notify-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
    entry: {
      content: './src/content/content.ts',
      popup: './src/popup/popup.ts',
      background: './src/background/background.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'public',
            to: '.',
            globOptions: {
              ignore: ['**/manifest.json']
            }
          },
          {
            from: 'public/manifest.json',
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content.toString());
              // Add version_name for development builds
              if (!isProduction) {
                manifest.version_name = manifest.version + '-dev';
              }
              return JSON.stringify(manifest, null, 2);
            }
          },
          { from: 'src/popup/popup.html', to: 'popup.html' },
          { from: 'src/popup/popup.css', to: 'popup.css' }
        ]
      }),
      new BuildNotifyPlugin({
        enabled: true
      })
    ]
  };
};
