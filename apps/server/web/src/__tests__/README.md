# Nexo Messenger Testing Guide

## 📋 Overview

This directory contains comprehensive tests for Nexo Messenger, including:
- **Unit Tests**: Component and utility function tests
- **Integration Tests**: Feature integration tests
- **E2E Tests**: End-to-end user flow tests
- **Load Tests**: Performance and stress tests

## 🧪 Test Stack

- **Vitest**: Fast unit test framework
- **React Testing Library**: Component testing
- **Playwright**: E2E browser testing
- **Artillery**: Load and performance testing

## 🚀 Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run specific browser
npx playwright test --project=chromium
```

### Load Tests

```bash
# Install Artillery globally
npm install -g artillery

# Run API load tests
cd apps/server/tests/load
artillery run artillery.yml

# Run WebSocket load tests
artillery run websocket-load.yml

# Generate HTML report
artillery run artillery.yml --output report.json
artillery report report.json
```

## 📁 Test Structure

```
__tests__/
├── setup.ts                 # Test setup and global mocks
├── components/              # Component tests
│   ├── Avatar.test.tsx
│   ├── Skeleton.test.tsx
│   └── ...
├── hooks/                   # Hook tests
│   ├── useResponsive.test.ts
│   └── ...
├── lib/                     # Utility tests
│   ├── performance.test.ts
│   └── ...
├── e2e/                     # E2E tests
│   ├── auth.spec.ts
│   ├── chat.spec.ts
│   └── responsive.spec.ts
└── README.md
```

## ✅ Test Coverage Goals

- **Unit Tests**: > 80% coverage
- **Integration Tests**: Critical user flows
- **E2E Tests**: Main user scenarios
- **Load Tests**: API and WebSocket performance

## 🎯 Testing Best Practices

### Unit Tests

1. **Test behavior, not implementation**
   ```typescript
   // ✅ Good
   expect(button).toHaveTextContent('Submit');
   
   // ❌ Bad
   expect(button.props.children).toBe('Submit');
   ```

2. **Use descriptive test names**
   ```typescript
   it('should display error message when login fails', () => {
     // test code
   });
   ```

3. **Arrange-Act-Assert pattern**
   ```typescript
   it('should increment counter', () => {
     // Arrange
     const { getByRole } = render(<Counter />);
     
     // Act
     fireEvent.click(getByRole('button'));
     
     // Assert
     expect(getByRole('heading')).toHaveTextContent('1');
   });
   ```

### E2E Tests

1. **Use data-testid for stable selectors**
   ```typescript
   await page.locator('[data-testid="login-button"]').click();
   ```

2. **Wait for elements properly**
   ```typescript
   await expect(page.locator('text=Welcome')).toBeVisible();
   ```

3. **Test user flows, not implementation**
   ```typescript
   // ✅ Good - tests user flow
   test('user can send a message', async ({ page }) => {
     await page.fill('[data-testid="message-input"]', 'Hello');
     await page.click('[data-testid="send-button"]');
     await expect(page.locator('text=Hello')).toBeVisible();
   });
   ```

### Load Tests

1. **Start with realistic scenarios**
2. **Gradually increase load**
3. **Monitor server metrics**
4. **Test both API and WebSocket**

## 🐛 Debugging Tests

### Unit Tests

```bash
# Run specific test file
npm test Avatar.test.tsx

# Run tests matching pattern
npm test -- --grep "Avatar"

# Debug in VS Code
# Add breakpoint and use "Debug Test" in VS Code
```

### E2E Tests

```bash
# Run with headed browser
npx playwright test --headed

# Run in debug mode
npx playwright test --debug

# Generate trace
npx playwright test --trace on
npx playwright show-trace trace.zip
```

## 📊 CI/CD Integration

Tests are automatically run on:
- Pull requests
- Main branch commits
- Pre-deployment

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:e2e
```

## 🔍 Test Reports

### Coverage Report

After running `npm run test:coverage`, open:
```
apps/server/web/coverage/index.html
```

### E2E Report

After running E2E tests, open:
```
playwright-report/index.html
```

### Load Test Report

After running Artillery tests:
```
artillery report report.json
```

## 📝 Writing New Tests

### Component Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '../../components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const { user } = render(<MyComponent />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    await page.click('[data-testid="button"]');
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

## 🎓 Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Artillery Documentation](https://www.artillery.io/docs)

## 🤝 Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain > 80% coverage
4. Add E2E tests for user flows
5. Update this README if needed

## 📞 Support

For testing questions:
- Check existing tests for examples
- Review this README
- Ask in team chat
- Create an issue on GitHub
