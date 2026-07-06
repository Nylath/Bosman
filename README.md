# Bosman

[![CI](https://github.com/Nylath/Bosman/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Nylath/Bosman/actions/workflows/ci.yml)

Bosman is a full-stack application for sailing schools. Participants prepare for theoretical sailing exams through randomized mock tests, while administrators manage users, access codes and versioned exam packages.

## Live demo

**Application:** [https://bosman.up.railway.app](https://bosman.up.railway.app)  
**Participant access code:** `BOS-E69P-PJYL`

Administrator credentials are intentionally not published.

## Screenshots

<img width="2001" height="1201" alt="image" src="https://github.com/user-attachments/assets/61f78e09-1796-44c1-9fa6-b18569c3230f" />
<img width="1388" height="862" alt="image" src="https://github.com/user-attachments/assets/3847071c-6e6b-4563-b713-534b858b4042" />
<img width="1004" height="1022" alt="image" src="https://github.com/user-attachments/assets/c16b8b53-63d2-472a-9d8d-823ba7423616" />
<img width="1375" height="1150" alt="image" src="https://github.com/user-attachments/assets/43bf22b0-16e3-49f2-9520-b927bf25738b" />

## Main features

### Participant

- login with an individual access code,
- assigned exam list,
- randomized questions and answers,
- configurable duration, question count and passing score,
- automatic result calculation,
- review of incorrect answers,
- attempt history,
- resume unfinished attempts,
- responsive mobile interface.

### School administrator

- participant management,
- access code generation,
- exam assignment,
- access expiration,
- participant activation and deactivation,
- overview of available exams and participant activity,
- permanent removal of demonstration data.

### System administrator

- ZIP package validation and import,
- exam version management,
- publishing and archiving exams,
- system-level data management,
- separate system and school permissions.

## Technology stack

| Area                | Technologies                            |
| ------------------- | --------------------------------------- |
| Frontend            | React, TypeScript, Vite, React Router   |
| Backend             | Node.js, Express, TypeScript, Zod       |
| Database            | PostgreSQL, Drizzle ORM, Drizzle Kit    |
| Authentication      | bcryptjs, HTTP-only cookie sessions     |
| File processing     | Multer, JSZip                           |
| Testing and quality | Vitest, ESLint, Prettier                |
| Infrastructure      | Docker Compose, Railway, GitHub Actions |
| Repository          | npm workspaces monorepo                 |

## Architecture

```text
Bosman
├── apps
│   ├── backend        # REST API, authentication and exam processing
│   └── frontend       # participant and administrator interfaces
├── packages
│   └── shared         # shared application code
├── db
│   └── migrations     # database migrations
├── data
│   └── assets         # imported exam assets
├── examples
│   └── exam-packages  # example import packages
└── docs
```

The production Express server exposes the REST API and serves the compiled React application. PostgreSQL stores structured data, while imported images are kept on persistent volume storage.

## Application modes

Bosman supports two modes:

- `LOCAL` — creates demonstration data and does not require participant access codes,
- `SCHOOL` — enables access codes, administrator authentication and organization-specific data.

The backend mode is configured with `APP_MODE`, and the frontend mode with `VITE_APP_MODE`.

## Local development

### Requirements

- Node.js 22,
- npm 10 or newer,
- Docker with Docker Compose.

### Installation

```bash
git clone https://github.com/Nylath/Bosman.git
cd Bosman
npm install
docker compose up -d
```

Create `.env` in the project root:

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
```

Run migrations and start both applications:

```bash
npm run db:migrate
npm run dev:backend
```

In another terminal:

```bash
npm run dev:frontend
```

Default addresses:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3001
```

Do not commit real passwords, secrets or environment files.

## Exam package import

Exams are imported as validated ZIP packages. `exam.json` must be placed directly in the archive root, without an additional parent directory.

```text
bosman-zeglarz-jachtowy.zip
├── exam.json
└── assets
    ├── course-cover.webp
    ├── q001.png
    └── q014.jpg
```

The `assets` directory may be empty when the exam contains no images. Supported formats are `.png`, `.jpg`, `.jpeg` and `.webp`.

The package contains:

- exam metadata and optional tile image,
- categories and category sampling minimums,
- questions with stable external identifiers,
- answers with exactly one correct option per question,
- optional question images stored under `assets/`.

Parameters such as duration, number of questions, passing score and random question count may remain `null` during draft import and can be configured later in the administrator panel.

The validator checks:

- ZIP and JSON structure,
- required fields and valid slugs,
- unique category and question identifiers,
- category references,
- consistent answer counts,
- exactly one correct answer per question,
- referenced and missing assets,
- unsafe archive paths,
- publishing requirements.

Example packages are available in:

```text
examples/exam-packages/minimal
examples/exam-packages/with-image
```

## Key technical decisions

- **Versioned exams:** existing attempts remain connected to the exact exam version used when they were started.
- **Validated imports:** invalid JSON, duplicate identifiers, missing images and unsafe paths are rejected before import.
- **Randomized attempts:** question selection respects category minimums and prevents duplicates.
- **Persistent assets:** imported images are stored outside the application build.
- **Role separation:** participants, school administrators and system administrators have different permissions and access scopes.

## Security

- bcrypt password hashing,
- HTTP-only session cookies,
- role-based authorization,
- login rate limiting,
- session expiration,
- protected administrator routes,
- participant access codes,
- ZIP path validation,
- environment-based secret management.

## Quality checks

```bash
npm run format:check
npm run lint
npm test
npm run build
```

GitHub Actions runs the same checks automatically for pushes and pull requests to `main`.

To format the repository:

```bash
npm run format
```

## Production

```bash
npm run build
npm start
```

Health endpoint:

```text
GET /health
```

The application is deployed on Railway with PostgreSQL and persistent asset storage.

## Project status

Bosman is an operational MVP. The participant, administrator, exam import, versioning, testing and deployment flows are implemented.

## Author

Created as a full-stack portfolio project by **Bartłomiej K.**  
GitHub: [Nylath](https://github.com/Nylath)

## License

No license has been selected.
