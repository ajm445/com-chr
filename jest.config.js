/** @type {import('jest').Config} */
module.exports = {
  // ts-jest로 TypeScript 직접 트랜스파일
  preset: 'ts-jest',
  testEnvironment: 'node',

  // 테스트 파일 위치
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.test.ts'],

  // 모듈 경로 매핑 (tsconfig.web.json의 @renderer/* 별칭)
  moduleNameMapper: {
    '^@renderer/(.*)$': '<rootDir>/src/renderer/src/$1',
  },

  // ts-jest 설정: 별도 tsconfig 사용
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: { warnOnly: true },
    }],
  },

  // 커버리지 수집 대상
  collectCoverageFrom: [
    'src/main/persistence.ts',
    'src/renderer/src/store/petStore.ts',
    'src/renderer/src/engine/stateTick.ts',
    'src/renderer/src/types/pet.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },

  modulePathIgnorePatterns: ['<rootDir>/out/'],
  clearMocks: true,
  restoreMocks: true,
}
