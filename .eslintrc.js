module.exports = {
    env: {
      node: true,
      jest: true,
      es6: true
    },
    extends: 'eslint:recommended',
    parserOptions: {
      ecmaVersion: 'latest'
    },
    rules: {
      'no-unused-vars': 'off'
    }
}