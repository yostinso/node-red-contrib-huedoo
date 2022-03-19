/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  automock: false,
  transform: {"\\.(ts|tsx)$": "ts-jest"},
  verbose: true,
  collectCoverage: true,
  testTimeout: 2000,
  restoreMocks: true,
  testMatch: [ "**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts" ],
  testPathIgnorePatterns: [ "<rootDir>/dist/" ],
  modulePathIgnorePatterns: [ "<rootDir>/dist/" ],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json"
    }
  },
  coveragePathIgnorePatterns: [
    "<rootDir>/.*/__fixtures__"
  ]
};