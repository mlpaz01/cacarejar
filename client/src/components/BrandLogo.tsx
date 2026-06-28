interface BrandLogoProps {
  /** Tamanho */
  size?: "sm" | "md" | "lg" | "sidebar";
  /** "light" = fundo claro -> logo.png; "dark" = fundo escuro -> logo-dark.png */
  theme?: "dark" | "light";
  /** "full" = lockup com texto; "icon" = so o mascote para menu retratil */
  variant?: "full" | "icon";
  /** Mantido por compatibilidade: a logo ja e a lockup completa. */
  hideTagline?: boolean;
  href?: string;
}

// Logos oficiais recortadas; os icones isolados permanecem os mesmos.
const fullHeight = { sm: 48, md: 64, lg: 88, sidebar: 60 };
const iconHeight = { sm: 56, md: 60, lg: 72, sidebar: 56 };

export function BrandLogo({
  size = "md",
  theme = "light",
  variant = "full",
  href = "/",
}: BrandLogoProps) {
  const src =
    variant === "icon"
      ? theme === "dark"
        ? "/assets/brand-icon-dark.png"
        : "/assets/brand-icon.png"
      : theme === "dark"
        ? "/assets/logo-dark.png"
        : "/assets/logo.png";
  const h = (variant === "icon" ? iconHeight : fullHeight)[size];

  return (
    <a
      href={href}
      style={{ display: "inline-flex", textDecoration: "none", flexShrink: 0 }}
      aria-label="Cacarejar"
    >
      <img
        src={src}
        alt="Cacarejar - Agentes autonomos de marketing"
        style={{ height: h, width: "auto", display: "block" }}
      />
    </a>
  );
}
