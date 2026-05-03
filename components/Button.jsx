// Reużywalny komponent przycisku.
// Warianty: primary (zielony, główna akcja), secondary (przezroczysty z obramowaniem),
//           ghost (sam tekst). type domyślnie 'button' - w formularzach trzeba dać 'submit'.

export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
  ...props
}) {
  const baza =
    'inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 disabled:opacity-50 disabled:cursor-not-allowed';

  const warianty = {
    primary: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400',
    secondary:
      'border border-emerald-500/40 bg-transparent text-emerald-100 hover:bg-emerald-500/10',
    ghost: 'text-emerald-300 hover:text-emerald-200',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${baza} ${warianty[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
