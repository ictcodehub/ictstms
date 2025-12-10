# Testing Guide

## 🧪 Test Setup

This project uses **Vitest** and **React Testing Library** for testing.

### Test Structure

```
ictstms/
├── tests/
│   ├── setup.js                      # Test configuration
│   └── integration/                  # Integration tests
│       ├── auth.test.jsx             # Authentication flow tests
│       └── task-flow.test.jsx        # Task management flow tests
├── src/
│   ├── utils/
│   │   ├── classSort.test.js         # Unit tests for sorting
│   │   └── fileUtils.test.js         # Unit tests for file utilities
│   └── components/
│       └── Toast.test.jsx            # Component tests
└── vitest.config.js                  # Vitest configuration
```

---

## 🚀 Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with UI
```bash
npm run test:ui
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

---

## 📊 Test Coverage

Current test coverage:

- **Test Files**: 5 files
- **Total Tests**: 48 tests
- **Pass Rate**: 100% ✅

### Coverage Breakdown:

**Unit Tests (29 tests):**
- ✅ `classSort.test.js` - 8 tests
- ✅ `fileUtils.test.js` - 21 tests

**Component Tests (4 tests):**
- ✅ `Toast.test.jsx` - 4 tests

**Integration Tests (15 tests):**
- ✅ `auth.test.jsx` - 5 tests (Login, Logout, Registration)
- ✅ `task-flow.test.jsx` - 10 tests (Create, Update, Delete, Submit, Grade)

---

## 📝 Writing New Tests

### Unit Test Example

```javascript
// src/utils/myFunction.test.js
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFunction';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

### Component Test Example

```javascript
// src/components/MyComponent.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Integration Test Example

```javascript
// tests/integration/my-flow.test.jsx
import { describe, it, expect, vi } from 'vitest';

describe('My Flow', () => {
  it('should complete the flow', async () => {
    // Arrange
    const mockData = { id: 1, name: 'Test' };
    
    // Act
    const result = await someAction(mockData);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

---

## 🎯 Best Practices

1. **Test File Naming**
   - Unit tests: `filename.test.js`
   - Component tests: `ComponentName.test.jsx`
   - Integration tests: `feature-flow.test.jsx`

2. **Test Organization**
   - Use `describe` blocks to group related tests
   - Use clear, descriptive test names
   - Follow AAA pattern: Arrange, Act, Assert

3. **Mocking**
   - Mock Firebase functions to avoid real database calls
   - Mock external dependencies
   - Use `vi.fn()` for function mocks

4. **Coverage Goals**
   - Utils: 90%+ coverage
   - Components: 80%+ coverage
   - Critical flows: 100% coverage

---

## 🐛 Debugging Tests

### Run Specific Test File
```bash
npm test -- src/utils/classSort.test.js
```

### Run Specific Test
```bash
npm test -- -t "should sort classes by grade"
```

### View Detailed Output
```bash
npm test -- --reporter=verbose
```

---

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## ✅ Continuous Integration

Tests run automatically on:
- Every commit
- Every pull request
- Before deployment

Make sure all tests pass before pushing to `main` branch.
