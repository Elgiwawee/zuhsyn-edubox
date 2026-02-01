module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    '@react-native-community',
  ],
  plugins: ['react-native'],
  rules: {
    'react-native/no-raw-text': 'error',
  },
};
