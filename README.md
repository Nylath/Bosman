# Bosman

[![CI](https://github.com/Nylath/Bosman/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Nylath/Bosman/actions/workflows/ci.yml)

A full-stack web application for sailing schools that allows participants to prepare for theoretical sailing exams through interactive mock tests.

Bosman provides separate interfaces for school administrators and course participants. Administrators manage participants, access codes and available exams, while participants can complete randomized tests, review results and track their previous attempts.

## Live demo

**Application:** `bosman.up.railway.app`

A dedicated demo participant account can be created for portfolio presentation.

> Administrator credentials are intentionally not published.

## Project overview

Bosman was created as an MVP for sailing schools offering courses such as:

- sailing licence courses,
- motorboat licence courses,
- SRC radio certificate courses.

The application is designed to simplify the process of sharing mock exams with course participants.

Question databases are prepared externally and imported into the application as validated ZIP packages. The school administrator does not need to manage technical file formats or database structures.

## Main features

### Participant application

- login using an individual access code,
- list of assigned exams,
- randomized questions and answers,
- configurable exam duration,
- configurable number of questions,
- automatic score calculation,
- configurable passing threshold,
- review of incorrect answers,
- exam attempt history,
- resume unfinished attempts,
- responsive interface for mobile devices.

### School administrator panel

- administrator authentication,
- participant management,
- generation of individual access codes,
- assignment of exams to participants or courses,
- access expiration management,
- activation and deactivation of participants,
- overview of available exams,
- permanent removal of demonstration data.

### System administrator panel

- management of exams and question packages,
- ZIP package validation,
- importing new exam versions,
- publishing and archiving exams,
- management of system-level data,
- separation between system and school administrator permissions.

## Technology stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- React Icons
- responsive CSS

### Backend

- Node.js
- Express
- TypeScript
- Zod
- bcryptjs
- cookie-based sessions
- Multer
- JSZip

### Database

- PostgreSQL
- Drizzle ORM
- Drizzle Kit migrations

### Infrastructure

- npm workspaces monorepo
- Docker Compose for local PostgreSQL
- Railway deployment
- Railway PostgreSQL
- persistent volume storage for imported assets

## Architecture

```text
Bosman
├── apps
│   ├── backend
│   │   ├── API routes
│   │   ├── authentication
│   │   ├── exam import
│   │   ├── database access
│   │   └── application bootstrap
│   │
│   └── frontend
│       ├── participant application
│       ├── school administrator panel
│       └── system administrator panel
│
├── packages
│   └── shared
│
├── db
│   └── migrations
│
├── data
│   └── assets
│
└── docs
```

The production Express server serves both the REST API and the compiled React application.

## Application modes

Bosman supports two application modes.

### Local mode

```env
APP_MODE=LOCAL
VITE_APP_MODE=LOCAL
```

Local mode automatically creates a demonstration organization and participant profile.

### School mode

```env
APP_MODE=SCHOOL
VITE_APP_MODE=SCHOOL
```

School mode enables participant access codes, administrator authentication and organization-specific data.

## Local installation

### Requirements

- Node.js 22
- npm 10 or newer
- Docker
- Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/<username>/Bosman.git
cd Bosman
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Configure environment variables

Create a `.env` file in the project root.

```env
NODE_ENV=development

DATABASE_URL=postgresql://bosman:bosman@localhost:5432/bosman

APP_MODE=LOCAL

ASSET_STORAGE=local
ASSET_DIRECTORY=./data/assets

ADMIN_PASSWORD_HASH=<bcrypt-hash>
SCHOOL_ADMIN_PASSWORD_HASH=<bcrypt-hash>

ADMIN_SESSION_TTL_HOURS=8
ADMIN_LOGIN_MAX_FAILURES=5
ADMIN_LOGIN_WINDOW_MINUTES=15

EXAM_PACKAGE_MAX_MB=50
```

Create `apps/frontend/.env`:

```env
VITE_APP_MODE=LOCAL

VITE_APP_NAME=Bosman
VITE_ORGANIZATION_NAME=Demo Sailing School

VITE_LOGIN_TITLE=Participant access
VITE_LOGIN_DESCRIPTION=Enter the access code provided by your course organizer.

VITE_HOME_TITLE=Sailing mock exams
VITE_HOME_DESCRIPTION=Select an available exam and test your theoretical knowledge.
```

Do not commit real environment files or passwords.

### 5. Run database migrations

```bash
npm run db:migrate
```

### 6. Start development servers

Backend:

```bash
npm run dev:backend
```

Frontend:

```bash
npm run dev:frontend
```

The frontend is normally available at:

```text
http://localhost:5173
```

The backend is normally available at:

```text
http://localhost:3001
```

## Production build

```bash
npm run build
npm start
```

The production backend serves the compiled frontend from the same application.

Health endpoint:

```text
GET /health
```

## Exam package import

Bosman imports exams using validated ZIP packages.

A package may contain:

```text
exam.json
assets/
├── question-image-1.png
├── chart-2.jpg
└── ...
```

The import process validates:

- package structure,
- JSON syntax,
- required exam settings,
- questions and answers,
- correct answer definitions,
- archive paths,
- referenced images,
- duplicated or missing files.

Imported exams can be stored as separate versions, allowing existing attempts to remain connected to the version used when the exam was started.

## Security features

- passwords stored as bcrypt hashes,
- HTTP-only session cookies,
- role-based authorization,
- separate system and school administrator permissions,
- participant access codes stored securely,
- login attempt rate limiting,
- session expiration,
- protected administrator API routes,
- organization-level data separation,
- validation of imported archive paths,
- environment-based secret management.

## Key technical challenges

### Monorepo deployment

The project uses npm workspaces for the frontend, backend and shared packages. The production build compiles all workspaces and serves the React application through Express.

### Native build dependencies

The production deployment required resolving platform-specific optional dependencies used by Vite and Rolldown. The project uses a single root `package-lock.json` to ensure consistent Linux builds.

### Persistent assets

Images extracted from imported exam packages are stored on a persistent Railway volume, while structured application data is stored in PostgreSQL.

### Multiple user roles

The application separates:

- participants,
- school administrators,
- system administrators.

Each role has a different authentication flow and access scope.

### Responsive participant interface

The participant interface was designed for mobile use because most course participants are expected to complete mock exams on smartphones.

## Future development

Potential future improvements include:

- participant progress statistics,
- average exam results,
- last attempt date,
- course group analytics,
- difficult question analysis,
- automatic email delivery of access codes,
- DOCX question database import,
- school logo upload,
- custom domains,
- multiple organizations within one deployment,
- automated tests and CI/CD checks.

## Screenshots

Recommended screenshots for the repository:

1. Participant login screen.
2. Participant exam list.
3. Mobile exam interface.
4. Exam result and incorrect answers.
5. School administrator participant list.
6. Exam import and configuration panel.

Store screenshots in:

```text
docs/screenshots/
```

Example:

```markdown
![Participant dashboard](docs/screenshots/participant-dashboard.png)
```

## What this project demonstrates

- designing an application around a real business problem,
- building a complete frontend and backend,
- relational database design,
- authentication and authorization,
- file upload and validation,
- versioned data imports,
- responsive user interface development,
- production deployment,
- persistent storage configuration,
- debugging Linux build and dependency issues.

## Project status

The application is an operational MVP.

The core participant, administrator, exam and deployment flows are implemented. Further development will be based on feedback from potential users and portfolio review.

## Author

Created as a full-stack portfolio project.

**Author:** `Bartłomiej K.`
**GitHub:** `Nylath`

## License

No license has been selected yet.
