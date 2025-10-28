const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Habilitar logs completos
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Deshabilitar Hermes para web (causa problemas con import.meta)
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;

