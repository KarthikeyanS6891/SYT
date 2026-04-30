import { ButtonHTMLAttributes, FC } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
}

export const Button: FC<Props> = ({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className = '',
  children,
  disabled,
  ...rest
}) => {
  const cls = [
    'btn',
    variant === 'secondary' ? 'secondary' : '',
    variant === 'ghost' ? 'ghost' : '',
    variant === 'danger' ? 'danger' : '',
    size === 'sm' ? 'sm' : '',
    block ? 'block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
};
