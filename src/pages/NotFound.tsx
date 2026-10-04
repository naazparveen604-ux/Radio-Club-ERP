import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { AlertCircle } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center space-y-6 text-center">
      <div className="rounded-full bg-error/10 p-4 text-error">
        <AlertCircle className="h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-text">404</h1>
        <h2 className="text-xl font-semibold tracking-tight text-muted-foreground">Page Not Found</h2>
        <p className="max-w-[500px] text-muted-foreground">
          The page you are looking for doesn't exist or you don't have permission to access it.
        </p>
      </div>
      <Link to="/dashboard">
        <Button>Return to Dashboard</Button>
      </Link>
    </div>
  )
}
