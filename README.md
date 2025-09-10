# WordWise AI

AI-enhanced writing assistant providing real-time suggestions for spelling, clarity, engagement, and grammar.

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build**: Vite 6
- **Styling**: Tailwind CSS 3
- **State**: Zustand 5
- **Routing**: React Router 7
- **Authentication**: Firebase Auth (Email/Password + Google)
- **Data**: Firebase Firestore + Realtime Database
- **Cloud Functions**: Firebase Functions (Node 22)
- **AI**: OpenAI GPT-4o via Cloud Functions

## Project Structure

```
.
├─ src/
│  ├─ components/
│  │  ├─ ai/
│  │  ├─ auth/
│  │  └─ dashboard/
│  ├─ pages/
│  ├─ services/
│  ├─ stores/   (Zustand stores)
│  ├─ store/    (legacy store)
│  ├─ lib/
│  ├─ types/
│  ├─ utils/
│  ├─ App.tsx
│  └─ main.tsx
├─ functions/   (Firebase Cloud Functions)
└─ public/
```

## Getting Started

### 1) Prerequisites

- Node.js 20+ (Node 22 recommended)
- Firebase project and Firebase CLI installed (`npm i -g firebase-tools`)

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment variables

Create a `.env` file in the project root and add your Firebase web config:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
```

If you need detailed setup steps, see the [Firebase setup guide](firebase-setup.md).

### 4) Run the app

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Available Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run preview` — Preview the production build
- `npm run lint` — Run ESLint

## Cloud Functions (optional during development)

The `functions/` directory contains Firebase Cloud Functions used for AI integration.

```bash
cd functions
npm install

# Serve locally with emulators
npm run serve

# Deploy functions (requires Firebase project access)
npm run deploy
```

## Authentication Flow

1. Public routes: login and registration pages
2. Protected routes: dashboard and editor features (requires authentication)
3. Authenticated users are redirected away from auth pages
4. Sessions persist across browser refreshes (managed by Firebase)

## Notes

1. Environment variables must be configured before running the app.
2. Firestore and Realtime Database are configured for development; tighten rules before production.
3. Google OAuth requires authorized domains configured in the Firebase Console.

## Troubleshooting

- Verify your Firebase configuration and enabled services.
- Ensure `.env` values match your Firebase web app settings.
- Check the browser console for errors during local development.
- For Cloud Functions, check logs:

```bash
firebase functions:log
```

For end-to-end Cloud Functions setup, see the [Firebase setup guide](firebase-setup.md).
