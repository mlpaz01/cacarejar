interface BrandLogoProps {
  /** Tamanho */
  size?: "sm" | "md" | "lg" | "sidebar";
  /** "light" = fundo claro -> logo.png (texto escuro)
   *  "dark" = fundo escuro -> logo-dark.png (texto branco, fundo transparente) */
  theme?: "dark" | "light";
  /** "full" = lockup com texto; "icon" = so o mascote para menu retratil */
  variant?: "full" | "icon";
  /** Mantido por compatibilidade: a logo ja e a lockup completa. */
  hideTagline?: boolean;
  href?: string;
}

const fullHeight = { sm: 53, md: 72, lg: 96, sidebar: 96 };
const fullWidth: Partial<Record<BrandLogoProps["size"], number>> = { sidebar: 228 };
const iconHeight = { sm: 46, md: 52, lg: 64, sidebar: 46 };

export function BrandLogo({
  size = "md",
  theme = "light",
  variant = "full",
  href = "/",
}: BrandLogoProps) {
  const src = variant === "icon"
    ? (theme === "dark" ? "/assets/brand-icon-dark.png" : "/assets/brand-icon.png")
    : theme === "dark" ? "/assets/logo-dark.png" : "/assets/logo.png";
  const h = (variant === "icon" ? iconHeight : fullHeight)[size];
  const w = variant === "icon" ? undefined : fullWidth[size];

  return (
    <a
      href={href}
      style={{ display: "inline-flex", textDecoration: "none", flexShrink: 0 }}
      aria-label="Cacarejar"
    >
      <img
        src={src}
        alt="Cacarejar - motor de marketing com agentes exclusivos"
        style={{ height: h, width: w ?? "auto", display: "block", objectFit: "contain" }}
      />
    </a>
  );
}
