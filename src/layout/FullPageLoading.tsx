import { LoaderCircle } from 'lucide-react'

/** Shown while the session is bootstrapping (guards render it before any route content). */
export function FullPageLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        불러오는 중…
      </p>
    </main>
  )
}
