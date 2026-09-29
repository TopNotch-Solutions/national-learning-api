# Edu Learning Backend

Node.js + Express + MySQL API for the Edu Learning portal.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables and edit as needed:

```bash
copy .env.example .env
```

3. Create / refresh the database (MySQL must be running):

```bash
mysql -u root -p < sql/schema.sql
```

4. Start the API:

```bash
npm run dev
```

API base: `http://localhost:5000`

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Sign in (admin/teacher only) |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/forgot-password` | Request password reset |

Include `Authorization: Bearer <token>` on protected routes.

## Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/staff` | List admins & teachers |
| POST | `/api/admin/staff` | Create admin or teacher |

## Teacher

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/teacher/contents` | List / create content |
| GET/POST | `/api/teacher/quizzes` | List / create quizzes |
| GET/POST | `/api/teacher/past-papers` | List / create past papers |
| GET/POST | `/api/teacher/memos` | List / create memos |

Demo accounts (after schema): password `Password123!`

- `admin@edu.na`
- `teacher@edu.na`
