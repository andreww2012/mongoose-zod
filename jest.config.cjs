/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterEnv: ['./test/setup.ts'],
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        useESM: true,

        // For `ts-jest-mock-import-meta`:
        diagnostics: {
          ignoreCodes: [1343],
        },
        astTransformers: {
          before: [
            {
              path: 'node_modules/ts-jest-mock-import-meta',
            },
          ],
        },
      },
    ],
  },
  verbose: false,
};
