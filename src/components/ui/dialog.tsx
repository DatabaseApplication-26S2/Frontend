import * as React from 'react'
import { cn } from 'cn'
import { Dialog as DialogPrimitive } from 'radix-ui'

/*
 * Hand-written on radix-ui Dialog (no shadcn CLI output): weights 400/700 only and the scrim
 * uses the --overlay token. Enter/exit use tw-animate-css and stop under reduced motion.
 */

const overlayClass =
  'fixed inset-0 z-50 bg-overlay data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none'

const contentClass =
  'fixed inset-x-4 top-1/2 z-50 mx-auto grid max-h-[calc(100svh-2rem)] max-w-lg -translate-y-1/2 gap-5 overflow-y-auto overscroll-contain rounded-xl bg-card p-6 text-base text-card-foreground shadow-lg ring-1 ring-border outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none'

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className={overlayClass} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(contentClass, className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="dialog-header" className={cn('flex flex-col gap-1.5', className)} {...props} />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-xl leading-7 font-bold text-balance text-heading', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

export interface ReturnFocus {
  /** Call when opening: the element to refocus on close, and where to go if it is unusable. */
  from(opener: HTMLElement, fallback: () => HTMLElement | null): void
  /** The opener is about to be disabled or removed (e.g. its course was closed): use the fallback. */
  redirect(): void
  /** Pass to `DialogContent` / `AlertDialogContent`. */
  onCloseAutoFocus(event: Event): void
}

function createReturnFocus(): ReturnFocus {
  let opener: HTMLElement | null = null
  let fallback: () => HTMLElement | null = () => null
  let redirected = false
  return {
    from(element, alternative) {
      opener = element
      fallback = alternative
      redirected = false
    },
    redirect() {
      redirected = true
    },
    onCloseAutoFocus(event) {
      // Radix refocuses only its own Trigger; these dialogs open from plain buttons
      event.preventDefault()
      const element = opener
      const usable = !redirected && element?.isConnected && !element.matches(':disabled')
      const target = usable ? element : fallback()
      opener = null
      redirected = false
      target?.focus()
    },
  }
}

/**
 * Focus return for a dialog opened by a plain button (no Radix Trigger): back to the opener, or
 * to the fallback when the opener is gone, disabled, or `redirect()` was called.
 */
function useReturnFocus(): ReturnFocus {
  const [returnFocus] = React.useState(createReturnFocus)
  return returnFocus
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  contentClass as dialogContentClass,
  overlayClass as dialogOverlayClass,
  useReturnFocus,
}
