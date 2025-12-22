# DSFMS - Digitalized Scoring Form Management System for Aviation Academy

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="AWS" />
</p>

<p align="center">
  <strong>A comprehensive assessment management system for aviation training institutions</strong>
</p>

<p align="center">
  Built with modern technologies to streamline assessment workflows, template management, and performance tracking for aviation training programs.
</p>

---

## Description

**DSFMS (Digitalized Scoring Form Management System)** is a robust backend API system designed specifically for aviation training institutions. The system provides comprehensive assessment management capabilities, including:

-  **Assessment Management** - Create, manage, and evaluate trainee assessments
-  **Template Managment** - Dynamic form templates with nested field structures
-  **User Management** - Role-based access control for trainers, trainees, and department heads
-  **Reporting & Analytics** - Comprehensive assessment reports and performance tracking
-  **Academic Management** - Manage multiple departments, courses, and subjects
-  **Security & Authentication** - JWT-based authentication with role-based permissions

## Architecture

The system is built using modern backend technologies:

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport.js
- **File Storage**: AWS S3 integration
- **Email Service**: NodeMailer integration
- **Documentation**: DOCX template generation
- **Validation**: Class-validator and Zod schemas

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Authentication** | JWT-based auth with role management (TRAINER, TRAINEE, DEPARTMENT_HEAD) |
| **Assessment** | Complete assessment workflow from creation to approval |
| **Template Management** | Dynamic form templates with hierarchical field structures |
| **User Management** | Comprehensive user profiles with department assignments |
| **Course & Subject** | Academic structure management with instructor assignments |
| **Media Management** | AWS S3 integration for file uploads and document generation |
| **Email Service** | Automated notifications via AWS SES |
| **Reports** | Assessment analytics and performance tracking |

### Assessment Workflow

```mermaid
graph LR
    A[Create Assessment] --> B[Assign to Trainee]
    B --> C[Trainee Completion]
    C --> D[Trainer Review]
    D --> E[Submit for Approval]
    E --> F[Department Head Approval]
    F --> G[Final Results & Reports]
```

### Key Features

- ✅ **Dynamic Template System** - Create reusable assessment templates with nested field structures
- ✅ **Role-based Permissions** - Granular access control based on user roles and assignments
- ✅ **Assessment Scoring** - Automatic PASS/FAIL determination based on configurable pass scores
- ✅ **Multi-level Approval** - Sequential workflow from trainee → trainer → department head
- ✅ **Document Generation** - Auto-generate assessment reports in DOCX/PDF formats
- ✅ **Real-time Status Tracking** - Complete audit trail of assessment progress
- ✅ **Flexible Field Types** - Support for text, numeric, dropdown, signature, and scoring fields

## 🛠️ Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- AWS Account (for S3 and SES services)

### Installation

```bash
# Clone the repository
git clone https://github.com/GiaoXomDaiDe/dsfms.git
cd dsfms

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Setup database
npx prisma generate
npx prisma db push

# Seed initial data
npm run seed-init-role
npm run create-permissions
npm run seed-departments
```

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/dsfms"

# JWT
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"

# AWS Services
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="your-aws-region"
AWS_S3_BUCKET_NAME="your-s3-bucket"

# Email Service (AWS SES)
AWS_SES_REGION="your-ses-region"
FROM_EMAIL="noreply@yourdomain.com"

# Application
PORT=3000
NODE_ENV="development"
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

## Testing

```bash
# Unit tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## API Documentation

### Main Endpoints

| Endpoint Group | Description | Key Routes |
|---------------|-------------|------------|
| `/auth` | Authentication & Authorization | `POST /login`, `POST /refresh`, `GET /profile` |
| `/assessments` | Assessment Management | `GET /`, `POST /`, `GET /:id`, `PUT /:id/approve` |
| `/templates` | Template Management | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `/users` | User Management | `GET /`, `POST /`, `PUT /:id`, `GET /:id/assessments` |
| `/courses` | Course Management | `GET /`, `POST /`, `PUT /:id`, `GET /:id/subjects` |
| `/subjects` | Subject Management | `GET /`, `POST /`, `PUT /:id`, `GET /:id/assessments` |
| `/departments` | Department Management | `GET /`, `POST /`, `PUT /:id`, `GET /:id/reports` |
| `/reports` | Analytics & Reports | `GET /assessments`, `GET /performance`, `GET /export` |

### Authentication

All protected routes require JWT token in header:
```
Authorization: Bearer <your-jwt-token>
```

## Database Schema

### Core Entities

```sql
-- Key tables and relationships
Users ←→ Assessments (trainee/trainer/approver)
Departments ←→ Courses ←→ Subjects
Templates ←→ TemplateSections ←→ TemplateFields
Assessments ←→ AssessmentSections ←→ AssessmentValues
```

### Database Commands

```bash
# Generate Prisma client
npx prisma generate

# Push schema changes to database
npx prisma db push

# View database in Prisma Studio
npx prisma studio

# Reset database (⚠️ destructive)
npx prisma db reset
```

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### Environment Setup for Production

```bash
# Build application
npm run build

# Set production environment
export NODE_ENV=production

# Start application
npm run start:prod
```

### CI/CD Pipeline

The project includes GitHub Actions workflow for automated deployment:
- Automated testing on pull requests
- Docker image building and pushing
- Automated deployment to production server

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use Prisma for database operations
- Implement proper error handling
- Add unit tests for new features
- Update documentation for API changes

## License

This project is licensed under the **UNLICENSED** - it is proprietary software developed for aviation training institutions.

## Project Status

- **Version**: 0.0.1
- **Status**: Development
- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Target**: Aviation Training Management

---

<p align="center">
  <strong>Built for the future of aviation training assessment management</strong>
</p>
