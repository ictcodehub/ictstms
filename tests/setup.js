import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Firebase
global.firebase = {
  initializeApp: () => {},
  auth: () => ({
    signInWithEmailAndPassword: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
  }),
  firestore: () => ({
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: true, data: () => ({}) }),
        set: () => Promise.resolve(),
      }),
    }),
  }),
};
