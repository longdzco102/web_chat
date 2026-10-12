#!/bin/bash
# ============================================
# EC2 User Data - Docker Setup & App Deploy
# ============================================
# This script runs on first boot of the EC2 instance
# Installs Docker, Docker Compose, and deploys the app
# ============================================

set -e

echo "=========================================="
echo "Starting EC2 instance initialization..."
echo "=========================================="

# Update system
apt-get update -y
apt-get upgrade -y

# Install prerequisites
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    wget \
    unzip

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker ubuntu
    systemctl enable docker
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

# Verify Docker installation
docker --version
docker-compose --version

# Create app directory
mkdir -p /app
cd /app

# Pull application code from S3 or GitHub
# In production, use CodeDeploy, CodePipeline, or other CI/CD
# For now, we'll use a placeholder that you can customize
echo "Fetching application code..."
# Example: git clone https://github.com/your-org/web-chat.git /app
# Or: aws s3 sync s3://your-bucket/web-chat /app

# Create docker-compose.yml
cat > /app/docker-compose.yml << 'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: webchat
      MYSQL_USER: webchat
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app_network

  backend:
    image: node:20-alpine
    restart: always
    working_dir: /app/backend
    command: npm start
    environment:
      NODE_ENV: production
      DB_HOST: mysql
      DB_PORT: 3306
      DB_NAME: webchat
      DB_USER: webchat
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - ./backend:/app/backend
    depends_on:
      - mysql
    networks:
      - app_network
    ports:
      - "3000:3000"

  frontend:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./frontend:/usr/share/nginx/html
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend
    networks:
      - app_network

networks:
  app_network:
    driver: bridge

volumes:
  mysql_data:
EOF

# Create environment file
cat > /app/.env << EOF
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
EOF

# Create nginx config for reverse proxy
mkdir -p /app/docker
cat > /app/docker/nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;

    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Pull Docker images
echo "Pulling Docker images..."
docker-compose pull

# Start containers
echo "Starting application..."
docker-compose up -d

# Verify containers are running
echo "Checking container status..."
docker-compose ps

# Setup log rotation
cat > /etc/logrotate.d/docker-compose << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=10M
    missingok
    delaycompress
    copytruncate
}
EOF

echo "=========================================="
echo "EC2 initialization complete!"
echo "=========================================="
