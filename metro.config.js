const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const customConfig = {
  // ✅ Allow Metro to see root assets folder
  watchFolders: [
    path.resolve(__dirname, 'assets'),
  ],

  resolver: {
    // ✅ DO NOT touch json
    assetExts: defaultConfig.resolver.assetExts,
    sourceExts: defaultConfig.resolver.sourceExts,
  },
};

module.exports = mergeConfig(defaultConfig, customConfig);
