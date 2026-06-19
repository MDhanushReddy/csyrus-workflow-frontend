# Workflow Approval Frontend

This frontend is the React/Vite client for the workflow approval management system.

## Features
- User login and session handling
- Request creation and editing
- Request status viewing
- Reviewer queue and approval/rejection actions
- Dashboard summaries for requester and reviewer workflows

## Tech Stack
- React
- Vite
- Axios
- React Router DOM
- ## Frontend Architecture

The frontend is built using React and Vite and follows a modular, component-based architecture to ensure maintainability, scalability, and separation of concerns.

### Architecture Overview

```text
src/
│
├── api/                # Axios configuration and API clients
├── components/         # Reusable UI components
├── context/            # Authentication and global state management
├── hooks/              # Custom React hooks
├── pages/              # Application pages/screens
├── routes/             # Route configuration and protected routes
├── services/           # Business logic and API service functions
├── utils/              # Helper functions and constants
├── tests/              # Frontend test cases
│
├── App.jsx
└── main.jsx
```

### Component Flow

```text
User
  │
  ▼
React Pages
  │
  ▼
Reusable Components
  │
  ▼
Services Layer
  │
  ▼
Axios API Client
  │
  ▼
FastAPI Backend
```

### Authentication Flow

```text
User
  │
  ▼
Login Page
  │
  ▼
Google OAuth
  │
  ▼
FastAPI Authentication Service
  │
  ▼
JWT Token
  │
  ▼
Protected Routes
```

### Key Pages

* Login Page
* Dashboard
* Request Submission Form
* Request History
* Reviewer Queue
* Approval / Rejection Panel

### Design Principles

* Component-based architecture
* Reusable UI components
* Separation of business logic from UI
* Context API for authentication state management
* Service layer for API communication
* Protected routing for authenticated users
* Responsive and scalable design


## Getting Started

### Install dependencies
```bash
npm install
```

### Run locally
```bash
npm run dev
```

The app will be available at:
- http://localhost:5173

### Build for production
```bash
npm run build
```

## Notes
- Make sure the backend API is running before testing the frontend.
- Update environment settings if your backend URL differs from the default configuration.
