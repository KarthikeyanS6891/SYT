import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

interface FieldWrap {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export const Field = ({ label, error, hint, children }: FieldWrap) => (
  <div className="field">
    {label && <label>{label}</label>}
    {children}
    {hint && !error && <div className="text-xs muted" style={{ marginTop: 4 }}>{hint}</div>}
    {error && <div className="error">{error}</div>}
  </div>
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, ...rest }, ref) => (
  <Field label={label} error={error} hint={hint}>
    <input ref={ref} className="input" {...rest} />
  </Field>
));
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, ...rest }, ref) => (
    <Field label={label} error={error} hint={hint}>
      <textarea ref={ref} className="textarea" {...rest} />
    </Field>
  )
);
Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, ...rest }, ref) => (
    <Field label={label} error={error} hint={hint}>
      <select ref={ref} className="select" {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  )
);
Select.displayName = 'Select';
