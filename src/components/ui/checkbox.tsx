import * as React from 'react'
import { cn } from 'cn'

/**
 * Native checkbox. Fill comes from `accent-color: var(--control-accent)` in `src/index.css`.
 * Wrap it in a `<label>` sized to the hit area; give it a name with `aria-label` when the
 * row's text is the visible label.
 */
function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'size-5 shrink-0 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Checkbox }
