module.exports = {
  root: true,

  env: {
    browser: false,
    commonjs: true,
    es6: true,
    node: true,
  },

  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2021,
    sourceType: 'module',
  },

  plugins: ['@typescript-eslint', 'optimize-regex', 'sonarjs', 'unicorn', 'require-extensions'],

  extends: [
    'plugin:sonarjs/recommended',
    'plugin:unicorn/recommended',

    'eslint:recommended',
    'airbnb-base',

    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:require-extensions/recommended',

    'plugin:@typescript-eslint/recommended',

    'plugin:node/recommended',
    'plugin:promise/recommended',

    'plugin:prettier/recommended',
  ],

  settings: {
    'import/resolver': {
      typescript: true,
      node: true,
    },

    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },

  rules: {
    // Optimize regex
    'optimize-regex/optimize-regex': 1,

    // sonarjs
    'sonarjs/cognitive-complexity': 0,
    'sonarjs/no-duplicate-string': 0,
    'sonarjs/no-nested-template-literals': 0,
    'sonarjs/prefer-immediate-return': 0,

    // unicorn
    'unicorn/catch-error-name': 0,
    'unicorn/consistent-destructuring': 0,
    'unicorn/filename-case': 0,
    'unicorn/no-array-callback-reference': 0,
    'unicorn/no-array-for-each': 0,
    'unicorn/no-array-reduce': 0,
    'unicorn/no-await-expression-member': 0,
    'unicorn/no-for-loop': 0,
    'unicorn/no-nested-ternary': 0,
    'unicorn/no-null': 0,
    'unicorn/no-unreadable-array-destructuring': 0,
    'unicorn/no-useless-undefined': 0,
    'array-callback-return': [2, {allowImplicit: true}],
    'unicorn/numeric-separators-style': [2, {onlyIfContainsSeparator: true}],
    'unicorn/prefer-module': 0,
    'unicorn/prefer-node-protocol': 0,
    'unicorn/prefer-regexp-test': 0,
    'unicorn/prefer-spread': 0,
    'unicorn/prefer-switch': [2, {minimumCases: 4, emptyDefaultCase: 'do-nothing-comment'}],
    'unicorn/prevent-abbreviations': 0,
    'unicorn/explicit-length-check': 0,

    // import
    'import/extensions': [
      2,
      'ignorePackages',
      {
        js: 'always',
        ts: 'never',
      },
    ],
    'import/order': [
      2,
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],

        pathGroups: [
          {
            pattern: '@/**',
            group: 'internal',
          },
        ],

        alphabetize: {
          order: 'asc',
        },
      },
    ],
    'import/prefer-default-export': 0,

    // typescript
    '@typescript-eslint/consistent-type-definitions': [2, 'interface'],
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/interface-name-prefix': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-extraneous-class': 2,
    '@typescript-eslint/no-unused-vars': 2,
    '@typescript-eslint/no-useless-constructor': 2,
    '@typescript-eslint/no-shadow': 2,
    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/ban-types': [
      2,
      {
        types: {
          object: false,
          '{}': false,
        },
      },
    ],

    // node
    'node/no-unsupported-features/es-syntax': [
      2,
      {
        ignores: ['modules', 'dynamicImport'],
      },
    ],
    'node/no-missing-import': 0, // Doesn't like .js extension in TS files
    'node/no-unpublished-import': 0,

    // Promise
    'promise/always-return': 1,
    'promise/catch-or-return': [
      2,
      {
        allowThen: true,
        allowFinally: true,
      },
    ],

    // node
    'no-process-exit': 1,

    // airbnb
    camelcase: 1,
    'class-methods-use-this': 0,
    'func-names': 0,
    'lines-between-class-members': 0,
    'max-classes-per-file': 0,
    'no-await-in-loop': 1,
    'no-bitwise': 0,
    'no-continue': 0,
    'no-implicit-coercion': [2, {boolean: true}],
    'no-nested-ternary': 0,
    'no-new': 1,
    'no-param-reassign': [2, {props: false}],
    'no-plusplus': 0,
    'no-restricted-syntax': [2, 'ForInStatement', 'LabeledStatement', 'WithStatement'],
    'no-return-await': 0,
    'no-sequences': 0,
    'no-shadow': 0,
    'no-underscore-dangle': 0,
    'no-unused-expressions': [
      2,
      {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      },
    ],
    'no-useless-constructor': 2,
    'prefer-const': 2,
    'prefer-destructuring': [
      2,
      {
        VariableDeclarator: {
          array: false,
          object: true,
        },
        AssignmentExpression: {
          array: false,
          object: false,
        },
      },
    ],
    'prefer-rest-params': 0,
    'sort-imports': [2, {ignoreDeclarationSort: true}],
  },
};
