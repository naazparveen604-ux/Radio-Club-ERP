import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { AlertCircle } from 'lucide-react'

export function Unauthorized() {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center space-y-6 text-center">
      <div className="rounded-full bg-error/10 p-4 text-error">
        <AlertCircle className="h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-text">403</h1>
        <h2 className="text-xl font-semibold tracking-tight text-muted-foreground">Unauthorized</h2>
        <p className="max-w-[500px] text-muted-foreground">
          You do not have the required permissions to access this page.
        </p>
      </div>
      <Link to="/dashboard">
        <Button>Return to Dashboard</Button>
      </Link>
    </div>
  )
}
