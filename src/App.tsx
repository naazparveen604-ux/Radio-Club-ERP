import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './layouts/AppShell'
import { Dashboard } from './pages/Dashboard'
import { Placeholder } from './pages/Placeholder'
import { NotFound } from './pages/NotFound'
import { Login } from './pages/Login'
import { Members } from './pages/Members'
import { Teams } from './pages/Teams'
import { Profile } from './pages/Profile'
import { Attendance } from './pages/Attendance'
import { Programs } from './pages/Programs'
import { Events } from './pages/Events'
import { Tasks } from './pages/Tasks'
import { Progress } from './pages/Progress'
import { Announcements } from './pages/Announcements'
import { Documents } from './pages/Documents'
import { Notifications } from './pages/Notifications'
import { Reports } from './pages/Reports'

import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Unauthorized } from './pages/Unauthorized'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Main Application Shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          <Route path="/members" element={<Members />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/events" element={<Events />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/leave" element={<Placeholder title="Leave Requests" />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
          
          <Route path="*" element={<NotFound />} />
        </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
