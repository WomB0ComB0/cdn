# Contributing to CDN Infrastructure

Thank you for considering contributing to this project! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- Go 1.21+
- Node.js 20+
- Docker & Docker Compose
- Make
- Git

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/cdn.git
cd cdn

# Install dependencies
make deps

# Setup environment
make env-setup

# Generate secrets
make secrets-generate

# Start development environment
make dev
```

## Development Workflow

### Creating a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or a bugfix branch
git checkout -b fix/bug-description
```

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `chore/` - Maintenance tasks

### Making Changes

1. Make your changes in your feature branch
2. Write or update tests as needed
3. Update documentation if required
4. Ensure all tests pass: `make test`
5. Lint your code: `make lint`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

Examples:
```bash
feat(go-media): add multipart upload support

Implements chunked upload for large files over 100MB.
Includes retry logic and progress tracking.

Closes #123

fix(worker): handle CORS preflight correctly

The OPTIONS handler was defined but not called.
Now properly handles CORS preflight requests.

Fixes #456
```

## Coding Standards

### Go

- Follow [Effective Go](https://golang.org/doc/effective_go)
- Use `gofmt` for formatting
- Run `golangci-lint` before committing
- Write godoc comments for exported functions
- Minimum test coverage: 70%

Example:
```go
// Upload handles file upload to R2 storage.
// It validates file size, type, and generates a content-hash filename.
// Returns the CDN URL and key on success.
func (h *MediaHandler) Upload(w http.ResponseWriter, r *http.Request) {
    // Implementation
}
```

### JavaScript

- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use ESLint for linting
- Use Prettier for formatting
- Add JSDoc comments for complex functions

Example:
```javascript
/**
 * Validate HMAC signature for private asset access
 * @param {string} path - Asset path
 * @param {string} expires - Expiration timestamp
 * @param {string} signature - HMAC signature
 * @returns {Promise<boolean>} True if signature is valid
 */
async function validateSignature(path, expires, signature) {
    // Implementation
}
```

### YAML

- Use 2 spaces for indentation
- Run `yamllint` before committing
- Keep lines under 120 characters

## Testing Guidelines

### Unit Tests

- Test file name: `*_test.go` or `*.test.js`
- Test public interfaces
- Use table-driven tests for Go
- Mock external dependencies

Example (Go):
```go
func TestValidateSignature(t *testing.T) {
    tests := []struct {
        name string
        path string
        want bool
    }{
        {"valid", "test.pdf", true},
        {"invalid", "bad.pdf", false},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := validateSignature(tt.path)
            if got != tt.want {
                t.Errorf("got %v, want %v", got, tt.want)
            }
        })
    }
}
```

### Integration Tests

- Test service interactions
- Use Docker Compose for test environment
- Clean up resources after tests

### Running Tests

```bash
# All tests
make test

# Go tests only
make test-go

# With coverage
make test-go-coverage

# Watch mode
make watch-test
```

## Pull Request Process

### Before Submitting

1. ✅ All tests pass
2. ✅ Code is linted
3. ✅ Documentation is updated
4. ✅ CHANGELOG.md is updated
5. ✅ Commits follow conventions
6. ✅ No merge conflicts

### Checklist

```markdown
## Changes
- [ ] Describe your changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Documentation
- [ ] Code comments added
- [ ] README.md updated
- [ ] CHANGELOG.md updated
- [ ] OpenAPI spec updated (if API changed)

## Security
- [ ] No sensitive data in commits
- [ ] Input validation added
- [ ] Authorization checks added (if needed)
```

### Review Process

1. Submit PR with clear description
2. Wait for CI checks to pass
3. Request review from maintainers
4. Address review feedback
5. Maintainer approves and merges

### PR Title Format

```
<type>(<scope>): <description>
```

Example:
```
feat(go-media): add multipart upload support
fix(worker): correct CORS handling
docs(readme): update installation instructions
```

## Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):

- MAJOR version for incompatible API changes
- MINOR version for backwards-compatible functionality
- PATCH version for backwards-compatible bug fixes

### Creating a Release

1. Update version in relevant files
2. Update CHANGELOG.md
3. Create release PR
4. After merge, tag the release:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
5. Create GitHub release from tag
6. Deploy to production

## Architecture Decisions

For significant changes:

1. Create an ADR (Architecture Decision Record)
2. Document in `docs/adr/`
3. Include context, decision, and consequences
4. Get review before implementation

## Getting Help

- 📖 Read the [documentation](docs/)
- 💬 Join discussions in Issues
- 📧 Contact maintainers
- 🐛 Report bugs in Issues

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- GitHub contributors page

Thank you for contributing! 🎉
