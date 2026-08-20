/** Jest + ts-jest per architecture.md §12.5.6 (OQ-16, closed). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // Jest resolves modules itself — tsconfig `paths` is invisible to it, so the alias is
  // restated here. Keep the two in agreement or specs fail on imports the build accepts.
  moduleNameMapper: { '^@api/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
