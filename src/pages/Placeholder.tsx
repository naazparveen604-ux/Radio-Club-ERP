
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">
          This module will be implemented in a later phase.
        </p>
      </div>
    </div>
  )
}
