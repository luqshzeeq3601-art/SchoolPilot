# Project: Enterprise Full-Stack Application

## Stack & Architecture
- **Backend**: Spring Boot 3.x (Java 21) or Node.js / TypeScript (NestJS / Express)
- **Frontend**: React 18+ / Next.js, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL 16+ / Redis
- **Containerization**: Docker & Docker Compose

## Development Guidelines
1. **Layered Architecture**: Strictly maintain Controller -> Service -> Repository layer boundaries.
2. **Database Migrations**: Manage all schema alterations with migration tools (Flyway / Liquibase / Prisma).
3. **API Contracts**: Keep REST endpoints documented and response DTOs strictly typed.
4. **Error Handling**: Standardize error payloads (timestamp, status, error code, message).

## Verification & Testing
```bash
# Backend test suite
mvn test          # or ./gradlew test

# Frontend test & lint
npm run test
npm run lint
npm run build
```
