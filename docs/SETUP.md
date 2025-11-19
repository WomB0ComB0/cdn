# CDN Setup Guide

This guide walks you through setting up the complete CDN infrastructure from scratch.

## Prerequisites Checklist

- [ ] Cloudflare account with R2 enabled
- [ ] Domain added to Cloudflare
- [ ] Server with Docker installed (2GB+ RAM recommended)
- [ ] Node.js 20+ installed locally
- [ ] Git installed

## Step 1: Initial Configuration

### 1.1 Clone Repository

```bash
git clone <your-repo-url>
cd cdn
```

### 1.2 Generate Secrets

```bash
# Signing secret for private URLs (save this!)
openssl rand -hex 32

# imgproxy credentials
openssl rand -hex 32  # KEY
openssl rand -hex 32  # SALT

# Hasura JWT secret
openssl rand -hex 32

# Traefik dashboard password
htpasswd -nb admin your-secure-password
```

### 1.3 Create Environment File

```bash
cp .env.example .env
nano .env  # or your preferred editor
```

Fill in all values from the secrets generated above.

## Step 2: Cloudflare Configuration

### 2.1 DNS Setup

In Cloudflare Dashboard → DNS:

1. Add A records:
   ```
   Type  Name  Content          Proxy
   A     api   YOUR_SERVER_IP   ✅ Proxied
   A     cdn   YOUR_SERVER_IP   ✅ Proxied
   ```

2. Wait for DNS propagation (usually instant with Cloudflare)

### 2.2 R2 Bucket Creation

1. Navigate to R2 → Create Bucket
2. Bucket name: `cdn-assets` (or your preference)
3. Location: Auto (or choose closest region)
4. Click **Create**

### 2.3 R2 Custom Domain

1. Go to your bucket → Settings → Public Access
2. Add custom domain: `cdn.mikeodnis.dev`
3. Cloudflare will automatically configure

### 2.4 R2 API Tokens

1. R2 → Manage R2 API Tokens
2. Create API token:
   - Permissions: Read & Write
   - Buckets: Select your bucket
3. Save **Access Key ID** and **Secret Access Key**

### 2.5 API Token for Cache Purge

1. My Profile → API Tokens → Create Token
2. Template: "Edit Zone DNS"
3. Permissions:
   - Zone → Cache Purge → Purge
   - Zone → Zone → Read
4. Zone Resources: Include → Specific zone → mikeodnis.dev
5. Copy the token

## Step 3: Server Setup

### 3.1 Install Docker (if not installed)

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Log out and back in
```

### 3.2 Clone & Configure on Server

```bash
# On your server
git clone <your-repo-url>
cd cdn
nano .env  # Add your configuration
```

### 3.3 Create Traefik ACME Storage

```bash
mkdir -p traefik/certs
touch traefik/certs/acme.json
chmod 600 traefik/certs/acme.json
```

## Step 4: Deploy Services

### 4.1 Start Infrastructure

```bash
docker-compose up -d
```

### 4.2 Check Status

```bash
# View all services
docker-compose ps

# Check logs
docker-compose logs -f

# Check specific service
docker-compose logs -f go-media
```

Expected output:
```
cdn-traefik     Up   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
cdn-go-media    Up   8080/tcp
cdn-node-core   Up   3000/tcp
cdn-hasura      Up   8080/tcp
cdn-imgproxy    Up   8080/tcp
```

### 4.3 Test Endpoints

```bash
# Health checks
curl https://api.mikeodnis.dev/v1/media/health
curl https://api.mikeodnis.dev/v1/core/status

# Should return 200 OK with JSON response
```

## Step 5: Deploy Cloudflare Worker

### 5.1 Install Wrangler

```bash
npm install -g wrangler
```

### 5.2 Login to Cloudflare

```bash
wrangler login
```

### 5.3 Configure Worker

```bash
cd cloudflare-worker
nano wrangler.toml
```

Update:
- `bucket_name`
- `zone_name`
- `IMGPROXY_URL` (your server IP or domain)

### 5.4 Set Secrets

```bash
wrangler secret put SIGNING_SECRET
# Paste the same secret from your .env file
```

### 5.5 Deploy

```bash
wrangler deploy
```

## Step 6: GitHub Actions Setup (Optional)

### 6.1 Add Repository Secrets

In GitHub → Settings → Secrets and Variables → Actions:

Add these secrets:
- `CLOUDFLARE_EMAIL`
- `CLOUDFLARE_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

### 6.2 Enable Actions

Commit and push to trigger workflows:

```bash
git add .
git commit -m "Initial CDN setup"
git push origin main
```

## Step 7: Verification

### 7.1 Test Upload

```bash
curl -X POST -F "file=@test-image.jpg" \
  https://api.mikeodnis.dev/v1/media/upload
```

Expected response:
```json
{
  "url": "https://cdn.mikeodnis.dev/assets/abc123.jpg",
  "key": "assets/abc123.jpg"
}
```

### 7.2 Test Public Asset

```bash
curl -I https://cdn.mikeodnis.dev/assets/abc123.jpg
```

Check for:
- `200 OK`
- `Cache-Control: public, max-age=31536000, immutable`
- `ETag: "..."`

### 7.3 Test Image Transformation

```bash
curl -I "https://cdn.mikeodnis.dev/img/test.jpg?w=800&h=600"
```

### 7.4 Test Signed URL

```bash
# Generate signed URL
SIGNED_URL=$(curl -X POST https://api.mikeodnis.dev/v1/media/sign \
  -H "Content-Type: application/json" \
  -d '{"path":"private/test.pdf","expires_in":300}' | jq -r '.url')

# Access with signature
curl -I "$SIGNED_URL"
```

## Step 8: Production Hardening

### 8.1 Disable Traefik Dashboard

In `docker-compose.yml`, comment out dashboard port:

```yaml
# - "8080:8080"  # Dashboard (disable in prod)
```

In `traefik/traefik.yml`:

```yaml
api:
  dashboard: false
  insecure: false
```

### 8.2 Enable Firewall

```bash
# Ubuntu/Debian with UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 8.3 Set Up Monitoring

Consider adding:
- [BetterStack](https://betterstack.com/) for uptime monitoring
- Prometheus + Grafana for metrics
- Cloudflare Analytics for CDN stats

### 8.4 Backup Configuration

```bash
# Backup environment variables
cp .env .env.backup

# Store securely (not in Git!)
# Consider using a password manager or secrets vault
```

## Step 9: Maintenance

### 9.1 Update Services

```bash
docker-compose pull
docker-compose up -d
```

### 9.2 View Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

### 9.3 Restart Service

```bash
docker-compose restart go-media
```

### 9.4 Purge Cache

```bash
curl -X POST https://api.mikeodnis.dev/v1/media/purge \
  -H "Content-Type: application/json" \
  -d '{"files":["https://cdn.mikeodnis.dev/assets/old-file.jpg"]}'
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Verify .env file
cat .env | grep -v "^#" | grep -v "^$"

# Check Docker resources
docker system df
```

### Can't access via domain

```bash
# Check DNS propagation
dig api.mikeodnis.dev
dig cdn.mikeodnis.dev

# Check Traefik logs
docker-compose logs traefik | grep -i error
```

### Upload fails

```bash
# Check R2 credentials
docker-compose exec go-media env | grep R2

# Test R2 connectivity
docker-compose exec go-media wget -O- ${R2_ENDPOINT}
```

### Image transformations fail

```bash
# Check imgproxy logs
docker-compose logs imgproxy

# Verify imgproxy can access R2
docker-compose exec imgproxy env | grep AWS
```

## Next Steps

1. **Add SSL/TLS**: Traefik handles this automatically with Let's Encrypt
2. **Set up CI/CD**: GitHub Actions are included
3. **Monitor performance**: Add Prometheus metrics
4. **Scale**: Consider multiple replicas for high traffic
5. **Backup**: Regular R2 bucket backups

## Support

- Cloudflare Docs: https://developers.cloudflare.com/r2/
- Traefik Docs: https://doc.traefik.io/traefik/
- imgproxy Docs: https://docs.imgproxy.net/

---

✅ **Setup Complete!** Your CDN is now live at `https://cdn.mikeodnis.dev`
