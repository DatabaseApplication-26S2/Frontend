import * as React from 'react'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

type FieldProps = {
  id: string
  label: string
  /** Shown under the control as `role="alert"` and linked with `aria-describedby`. */
  error?: string
  className?: string
}

/** Labelled text input with its error. Extra props (including `register()` output) go to the input. */
function TextField({
  id,
  label,
  error,
  className,
  ...input
}: FieldProps & Omit<React.ComponentProps<'input'>, 'id' | 'className'>) {
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  )
}

/** Labelled native select with its error. Extra props go to the `<select>`. */
function SelectField({
  id,
  label,
  error,
  className,
  children,
  ...select
}: FieldProps & Omit<React.ComponentProps<'select'>, 'id' | 'className'>) {
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...select}
      >
        {children}
      </NativeSelect>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  )
}

export { SelectField, TextField }
