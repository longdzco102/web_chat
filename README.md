# ============================================
# Xianxia Chat - Web Chat Application
# ============================================
> **Discord-style 4-column SPA** – Tu Tiên theme · Dark Mode · WebSocket realtime
> Node.js + Express + Socket.io + MySQL + Docker + Terraform

---

## 🚀 Quick Start

### 🐳 Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/longdzco102/web_chat.git
cd web_chat

# Copy environment file
cp .env.example .env
# Edit .env with your values

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access:**
- Frontend: http://localhost:80
- Backend API: http://localhost:3000
- API Health: http://localhost:3000/api/health

### 💻 Development Mode

```bash
# Start in development mode with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Frontend dev server: http://localhost:3001
# phpMyAdmin: http://localhost:8080
```

---

## 📁 Project Structure

```
xianxia-chat/
├── .gitignore
├── .gitlab-ci.yml          # GitLab CI/CD Pipeline
├── README.md
├── .env.example
│
├── docker/                 # Docker configurations
│   ├── backend/
│   │   ├── Dockerfile       # Production backend image
│   │   └── Dockerfile.dev   # Development backend image
│   ├── frontend/
│   │   ├── Dockerfile       # Production frontend image
│   │   └── Dockerfile.dev   # Development frontend image
│   └── nginx/
│       └── default.conf     # Nginx reverse proxy config
│
├── docker-compose.yml       # Production compose
├── docker-compose.dev.yml   # Development compose
│
├── terraform/               # Infrastructure as Code
│   ├── provider.tf          # AWS provider
│   ├── variables.tf         # Input variables
│   ├── network.tf           # VPC, Subnets, NAT Gateway
│   ├── security_groups.tf   # Security Groups
│   ├── ec2.tf               # EC2 Instance + Docker
│   ├── rds.tf               # RDS PostgreSQL
│   ├── outputs.tf           # Output values
│   ├── backend.tf           # S3 backend config
│   ├── userdata.sh          # EC2 initialization script
│   ├── terraform.tfvars.example
│   └── README.md
│
├── frontend/               # Frontend SPA
│   ├── index.html
│   ├── css/
│   │   ├── main.css
│   │   ├── base/   (_variables, _reset)
│   │   ├── layouts/ (_app.css – 4-column grid)
│   │   └── components/ (8 files)
│   └── js/
│       ├── main.js
│       ├── data/mockData.js
│       ├── models/   (User, Post, Message, Sect)
│       ├── views/    (Sidebar, Blog, Chat, Member)
│       ├── controllers/ (App, Auth, Blog, Chat)
│       └── utils/   (helpers, toast, api, socket)
│
└── backend/                # Node.js REST API
    ├── schema.sql           # MySQL schema
    ├── package.json
    └── src/
        ├── app.js
        ├── config/   (db, jwt)
        ├── models/   (User, Post, Message, Sect, Channel)
        ├── controllers/ (auth, post, sect, message)
        ├── routes/   (auth, posts, sects, channels)
        ├── middlewares/ (auth JWT, validate, errorHandler)
        ├── sockets/  (index, chatHandler, presenceHandler)
        └── utils/    (logger)
```

---

## ☁️ AWS Infrastructure (Terraform)

### Prerequisites

1. **AWS CLI configured**
   ```bash
   aws configure
   ```

2. **Create SSH Key Pair** in AWS Console
   ```
   EC2 > Key Pairs > Create key pair
   ```

3. **Create S3 Bucket** for Terraform state (optional)
   ```bash
   aws s3 mb s3://your-terraform-state-bucket
   ```

4. **Create DynamoDB Table** for state locking (optional)
   ```bash
   aws dynamodb create-table \
     --table-name terraform-state-lock \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

### Deploy Infrastructure

```bash
cd terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# View outputs
terraform output
```

### Terraform Outputs

| Output | Description |
|--------|-------------|
| `vpc_id` | VPC ID |
| `ec2_public_ip` | EC2 Public IP |
| `ec2_hostname` | EC2 Public DNS |
| `db_endpoint` | RDS Endpoint |
| `app_url` | Application URL |
| `ssh_command` | SSH command |
| `ssm_connect_command` | SSM Session Manager command |

---

## 🐳 Docker Configuration

### Services

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `mysql` | mysql:8.0 | 3306 | MySQL Database |
| `backend` | Node.js 20 | 3000 | Express API + Socket.io |
| `frontend` | nginx:alpine | 80 | React SPA |
| `phpmyadmin` | phpmyadmin | 8080 | DB Management (dev only) |

### Environment Variables

```env
NODE_ENV=production
MYSQL_ROOT_PASSWORD=your-root-password
MYSQL_DATABASE=webchat
MYSQL_USER=webchat
MYSQL_PASSWORD=your-password
JWT_SECRET=your-jwt-secret
```

### Build Images Manually

```bash
# Build backend
docker build -f docker/backend/Dockerfile -t webchat-backend .

# Build frontend
docker build -f docker/frontend/Dockerfile -t webchat-frontend .

# Run with docker-compose
docker-compose up -d
```

---

## 🔌 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | - | Register |
| POST | `/api/auth/login` | - | Login → JWT |
| GET | `/api/auth/me` | ✓ | Profile |
| POST | `/api/auth/logout` | ✓ | Logout |
| GET | `/api/posts` | - | List posts |
| POST | `/api/posts` | ✓ | Create post |
| GET | `/api/posts/:id` | - | Post detail |
| POST | `/api/posts/:id/like` | ✓ | Like |
| POST | `/api/posts/:id/comments` | ✓ | Comment |
| GET | `/api/sects` | - | List sects |
| POST | `/api/sects` | ✓ | Create sect |
| POST | `/api/sects/:id/join` | ✓ | Join sect |
| GET | `/api/channels/:id/messages` | ✓ | Messages |
| POST | `/api/channels/:id/messages` | ✓ | Send message |

---

## 🔌 Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `channel:join` | C→S | Join channel |
| `channel:leave` | C→S | Leave channel |
| `message:send` | C→S | Send message |
| `message:new` | S→C | New message broadcast |
| `typing:start/stop` | C↔S | Typing indicators |
| `user:online/offline` | S→C | Presence updates |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3 Modular, Vanilla JS ES Modules |
| Pattern | MVC (Model/View/Controller) |
| Realtime | Socket.io 4.x |
| Backend | Node.js 18+, Express 4 |
| Auth | JWT + bcryptjs |
| Database | MySQL 8.0 |
| Container | Docker + Docker Compose |
| IaC | Terraform (AWS) |
| CI/CD | GitLab CI |

---

## 📊 AWS Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Public Subnet (10.0.1.0/24)                      │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │              NAT Gateway                   │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Private Subnet 1 (10.0.2.0/24)                   │  │
│  │  ┌────────────┐  ┌─────────────────────────┐     │  │
│  │  │    EC2     │  │         RDS            │     │  │
│  │  │  (Docker)  │  │  (PostgreSQL/MySQL)    │     │  │
│  │  │  Port 3000 │  │       Port 5432        │     │  │
│  │  └────────────┘  └─────────────────────────┘     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Private Subnet 2 (10.0.3.0/24)                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │              RDS Replica                     │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Features

- ✅ Non-root Docker users
- ✅ Health checks for all containers
- ✅ Resource limits (CPU/Memory)
- ✅ JSON log rotation
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ IAM roles with least privilege
- ✅ Security Groups (whitelist access)
- ✅ Secrets management via environment variables
- ✅ No hardcoded credentials

---

## 📝 License

MIT License - Feel free to use for your portfolio!

---

## 👤 Author

**longdzco102**
- GitHub: [@longdzco102](https://github.com/longdzco102)
- Project: [web_chat](https://github.com/longdzco102/web_chat)
