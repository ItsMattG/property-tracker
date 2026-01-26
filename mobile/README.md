# PropertyTracker Mobile App

React Native mobile app for PropertyTracker.

## Development

```bash
npm install
npm start
```

## E2E Testing with Detox

### Prerequisites

- Xcode 15+ with Command Line Tools
- iOS Simulator (iPhone 15 Pro recommended)
- applesimutils: `brew tap wix/brew && brew install applesimutils`

### Running Tests Locally

1. Generate native projects (first time only):
   ```bash
   npx expo prebuild
   ```

2. Start the backend server:
   ```bash
   cd .. && npm run dev
   ```

3. Build the app for testing:
   ```bash
   npm run e2e:build
   ```

4. Run the tests:
   ```bash
   npm run e2e:test
   ```

### Test Structure

- `e2e/screens/` - Individual screen tests
- `e2e/flows/` - End-to-end user journey tests
- `e2e/fixtures/` - Test data seeding utilities
- `e2e/utils/` - Helper functions

### CI

Tests run automatically on GitHub Actions for PRs affecting `mobile/` directory.
