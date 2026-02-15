interface BadgeProps {
  children: React.ReactNode;
  variant?: "repeat" | "modify" | "stop" | "default";
  className?: string;
}

export default function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const variantStyles = {
    repeat: "bg-accent-green/10 text-accent-green border-accent-green/20",
    modify: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
    stop: "bg-accent-red/10 text-accent-red border-accent-red/20",
    default: "bg-charcoal-lighter text-foreground/70 border-charcoal-lighter",
  };

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
