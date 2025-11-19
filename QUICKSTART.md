# CDN Infrastructure - Quick Start Guide

## 🚀 5-Minute Quick Start

This guide gets you up and running locally in 5 minutes.

### Prerequisites
- Docker & Docker Compose installed
- Domain with Cloudflare (for production)
- Node.js 20+ (for scripts)

### Local Development

```bash
# 1. Clone and setup
git clone <repo-url>
cd cdn
make env-setup

# 2. Generate secrets
make secrets-generate

# Copy the output and add to .env file

# 3. Start services (local mode, no Cloudflare required)
docker-compose up -d

# 4. Check health
make health-check

# 5. Test upload
curl -X POST -F "file=@test-image.jpg" \
  http://localhost:8080/v1/media/upload
```

### Testing

```bash
# Run all tests
make test

# Run with coverage
make test-go-coverage

# Watch mode
make watch-test
```

### Available Commands

```bash
make help          # Show all available commands
make dev           # Start in development mode
make logs          # View logs
make test          # Run tests
make lint          # Run linters
make clean         # Clean up
```

## 🏗️ Production Deployment

See [docs/SETUP.md](docs/SETUP.md) for detailed production setup.

### Quick Deploy

```bash
# 1. Configure production environment
cp .env.example .env.production
# Edit .env.production with production values

# 2. Build images
make docker-build

# 3. Push to registry
make docker-push

# 4. Deploy
make deploy-production

# 5. Deploy worker
make deploy-worker
```

## 📊 Monitoring

```bash
# View metrics
make metrics

# Check service status
docker-compose ps

# View detailed health
curl http://localhost:8080/health/detailed
```

## 🔧 Troubleshooting

### Services won't start
```bash
make logs          # Check logs
docker-compose ps  # Check status
make clean && make dev  # Clean and restart
```

### Upload fails
```bash
# Check Go service logs
docker-compose logs go-media

# Test R2 connectivity
docker-compose exec go-media wget -O- $R2_ENDPOINT
```

## 📚 Next Steps

- Read [REVIEW.md](REVIEW.md) for improvement suggestions
- Check [docs/SETUP.md](docs/SETUP.md) for detailed setup
- Review [openapi.yaml](openapi.yaml) for API documentation

## 🆘 Support

- Issues: [GitHub Issues](https://github.com/WomB0ComB0/cdn/issues)
- Docs: [Full Documentation](docs/)
- Cloudflare: [R2 Documentation](https://developers.cloudflare.com/r2/)
