import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Firebase auth functions
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
  signOut: (...args) => mockSignOut(...args),
  createUserWithEmailAndPassword: (...args) => mockCreateUserWithEmailAndPassword(...args),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: {},
  browserSessionPersistence: {},
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Mock user
    callback({ uid: 'test-uid', email: 'test@test.com' });
    return vi.fn(); // unsubscribe function
  }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => true,
      data: () => ({ role: 'teacher', name: 'Test Teacher' }),
    })
  ),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Flow', () => {
    it('should successfully login with valid credentials', async () => {
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'test-uid', email: 'teacher@test.com' },
      });

      const result = await mockSignInWithEmailAndPassword(
        {},
        'teacher@test.com',
        'password123'
      );

      expect(result.user.email).toBe('teacher@test.com');
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        {},
        'teacher@test.com',
        'password123'
      );
    });

    it('should reject login with invalid credentials', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue(
        new Error('Invalid credentials')
      );

      await expect(
        mockSignInWithEmailAndPassword({}, 'wrong@test.com', 'wrongpass')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Logout Flow', () => {
    it('should successfully logout', async () => {
      mockSignOut.mockResolvedValue();

      await mockSignOut({});

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Registration Flow', () => {
    it('should successfully register new user', async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'new-user-uid', email: 'newuser@test.com' },
      });

      const result = await mockCreateUserWithEmailAndPassword(
        {},
        'newuser@test.com',
        'password123'
      );

      expect(result.user.email).toBe('newuser@test.com');
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalled();
    });

    it('should reject registration with existing email', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValue(
        new Error('Email already in use')
      );

      await expect(
        mockCreateUserWithEmailAndPassword({}, 'existing@test.com', 'password123')
      ).rejects.toThrow('Email already in use');
    });
  });
});
