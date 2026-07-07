# Contributing to StellarTrust Protocol

First off, thank you for considering contributing to StellarTrust! We welcome contributions from developers, researchers, designers, and domain experts.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Contributing Code](#contributing-code)
- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
- [Project Structure](#project-structure)
- [Code Style & Standards](#code-style--standards)
  - [Rust (Soroban Contracts)](#rust-soroban-contracts)
  - [TypeScript (Backend & Frontend)](#typescript-backend--frontend)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Security](#security)

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md). We expect all contributors to adhere to it to maintain a welcoming and inclusive community.

## How Can I Contribute?

### Reporting Bugs

When reporting a bug, please include as many details as possible in your issue:

1. A clear, descriptive title
2. Steps to reproduce the issue
3. Expected behavior vs. actual behavior
4. Environment details (OS, browser, Stellar network, etc.)
5. Any relevant logs or screenshots

### Suggesting Enhancements

Have an idea for improving StellarTrust? We'd love to hear it!

1. Check if the enhancement has already been suggested in issues
2. If not, create a new issue with:
   - A clear, descriptive title
   - A detailed description of the proposed enhancement
   - Why you think it would be valuable
   - Any implementation ideas

### Contributing Code

Ready to write some code? Great! Here's how to get started:

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/StellarTrust-Protocol.git`
3. Create a new branch from `develop`: `git checkout -b feature/your-feature-name`
4. Make your changes and commit them following our [commit convention](#commit-convention)
5. Push your changes to your fork
6. Open a pull request to the `develop` branch of the main repository

## Development Setup

### Prerequisites

| Tool          | Version  | Purpose                       |
| ------------- | -------- | ----------------------------- |
| Rust          | 1.75+    | Soroban smart contracts       |
| `stellar-cli` | latest   | Contract deployment & testing |
| Node.js       | 20.x LTS | Backend & frontend            |
| PostgreSQL    | 15+      | Backend database              |
| Redis         | 7+       | Caching & job queues          |
| Docker        | 24+      | Local development stack       |
| IPFS (Kubo)   | 0.27+    | Off-chain credential storage  |

### Local Development

#### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/StellarTrust-Protocol.git
cd StellarTrust-Protocol

# Copy all environment configs
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start the full stack
docker-compose up -d

# Verify services
docker-compose ps
```

#### Manual Setup

##### Contracts

```bash
cd contracts

# Install dependencies
cargo build

# Run tests
cargo test

# Build contracts
make build
```

##### Backend

```bash
cd backend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

##### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

## Project Structure

```
StellarTrust-Protocol/
├── contracts/          # Soroban smart contracts (Rust)
│   ├── identity/       # DID & identity management
│   ├── credit-score/   # Credit scoring engine
│   ├── registry/       # Issuer & schema registry
│   ├── governance/     # Protocol governance
│   └── shared/         # Shared types & utilities
├── backend/            # Node.js/TypeScript backend
│   ├── src/
│   │   ├── api/        # REST API routes
│   │   ├── services/   # Business logic
│   │   ├── workers/    # Background processing
│   │   ├── models/     # Database models
│   │   └── utils/      # Helper functions
│   └── prisma/         # Prisma schema & migrations
├── frontend/           # Next.js frontend
│   └── src/
│       ├── app/        # App Router pages
│       ├── components/ # React components
│       ├── hooks/      # React hooks
│       └── lib/        # Utilities & clients
├── sdk/                # Lender/developer SDK
└── docs/               # Protocol documentation
```

## Code Style & Standards

### Rust (Soroban Contracts)

- Use `cargo fmt` for code formatting
- Use `cargo clippy` for linting (zero warnings policy)
- Write doc comments for all public functions and types
- Keep functions focused and modular
- Test all public interfaces

### TypeScript (Backend & Frontend)

- Use ESLint and Prettier (configurations are in the repository)
- Write type definitions for all functions and interfaces
- Avoid `any` type whenever possible
- Follow functional programming principles where appropriate
- Write tests for all new features

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Code change that improves performance
- `test`: Adding or correcting tests
- `chore`: Changes to build process or auxiliary tools

**Examples:**

- `feat(contracts): add credential expiry support`
- `fix(backend): resolve DID document caching issue`
- `docs(readme): update API reference`
- `test(frontend): add identity flow tests`

## Pull Request Process

1. **Create a Pull Request (PR):** Open a PR with a clear title and description
2. **Fill out the PR template:** Complete all sections of the pull request template
3. **Automated checks:** Ensure all CI/CD checks pass
4. **Code review:** Wait for a maintainer to review your PR
5. **Address feedback:** Make any requested changes
6. **Merge:** Once approved, your PR will be merged

**Pull Request Requirements:**

- All existing tests must pass
- New features must include tests
- Documentation must be updated as needed
- Code must follow style guidelines

## Testing

### Contract Tests

```bash
cd contracts

# Unit tests
cargo test

# Integration tests (requires local Stellar network)
stellar network start local
cargo test --features integration

# Coverage report
cargo tarpaulin --out Html
```

### Backend Tests

```bash
cd backend

# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration
```

### Frontend Tests

```bash
cd frontend

# Component tests (Vitest)
npm test

# E2E tests (Playwright)
npm run test:e2e
```

## Security

If you discover a security vulnerability, please **DO NOT** open a public issue. Instead, email us at `security@stellartrust.io`.

We take security seriously and will respond promptly to any reports. See our [Security Policy](./README.md#security) for more details.

---

Thank you again for contributing to StellarTrust! 🚀
