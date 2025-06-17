# WriteBright AI - AI-Enhanced Language Writing Tool

An MVP for an AI-powered writing assistant focused on real-time spelling, clarity, and engagement suggestions for academic writing.

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Authentication**: Firebase Auth (Email/Password + Google)
- **Database**: Firebase Firestore + Realtime Database
- **Hosting**: Firebase Hosting (planned)
- **AI Integration**: GPT-4o via Cloud Functions (planned)

## 📁 Project Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── AuthProvider.tsx       # Authentication state provider
│   │   ├── LoginForm.tsx          # Login form component
│   │   ├── RegisterForm.tsx       # Registration form component
│   │   └── ProtectedRoute.tsx     # Route protection wrapper
│   └── dashboard/
│       └── Dashboard.tsx          # Main dashboard component
├── lib/
│   └── firebase.ts               # Firebase configuration
├── services/
│   └── authService.ts            # Authentication service functions
├── store/
│   └── authStore.ts              # Zustand authentication store
├── App.tsx                       # Main application component with routing
├── main.tsx                      # Application entry point
└── index.css                     # Global styles with Tailwind
```

## 🛠️ Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password and Google providers
4. Create Firestore Database:
   - Go to Firestore Database > Create database
   - Start in test mode (for development)
5. Create Realtime Database:
   - Go to Realtime Database > Create database
   - Start in test mode (for development)
6. Get your Firebase config:
   - Go to Project settings > General
   - Scroll down to "Your apps" and click "Web" icon
   - Copy the configuration object

### 2. Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Replace the placeholder values in `.env` with your actual Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your_actual_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_actual_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
   VITE_FIREBASE_APP_ID=your_actual_app_id
   VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
   ```

### 3. Installation & Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

## 🎯 Epic 1 Features (Completed)

- ✅ **Vite Project Setup**: React 18 + TypeScript configuration
- ✅ **Tailwind CSS**: Styling system with custom theme
- ✅ **Firebase Integration**: Auth, Firestore, and Realtime Database setup
- ✅ **Authentication System**:
  - Email/password registration and login
  - Google OAuth integration
  - Protected routes with authentication guards
  - User profile management
- ✅ **Navigation & UI**: Basic dashboard with user management

## 🎯 Upcoming Features

### Epic 2: Document Editor
- Rich text editor with real-time collaboration
- Document creation, saving, and management
- Auto-save functionality

### Epic 3: AI Suggestion Engine
- Real-time spelling and grammar checking
- Clarity and readability analysis
- Engagement and tone suggestions
- Academic writing style recommendations

### Epic 4: Advanced Features
- Collaboration and sharing
- Export capabilities
- Performance analytics
- Offline support

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔐 Authentication Flow

1. **Public Routes**: Login and registration pages
2. **Protected Routes**: Dashboard and app features (requires authentication)
3. **Auto-redirect**: Authenticated users are redirected away from auth pages
4. **Persistent Sessions**: Firebase handles session persistence across browser refreshes

## 📱 User Interface

- **Clean, modern design** with Tailwind CSS
- **Responsive layout** for desktop and mobile
- **Accessible forms** with proper labeling and focus management
- **Loading states** and error handling
- **Consistent spacing and typography** with Inter font

## 🚨 Important Notes

1. **Environment Variables**: Make sure to update the `.env` file with your actual Firebase configuration before running the app.

2. **Firebase Rules**: Currently using test mode for development. Update security rules before production deployment.

3. **Authentication**: Google OAuth requires proper domain configuration in Firebase console for production use.

## 📞 Support

If you encounter any issues during setup:

1. Verify Firebase configuration is correct
2. Check that all required Firebase services are enabled
3. Ensure `.env` file has correct values
4. Check browser console for detailed error messages

---

**Next Steps**: Configure Firebase settings and start the development server to begin using WriteBright AI!
