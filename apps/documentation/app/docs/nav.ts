export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Empezar",
    items: [
      { href: "/docs", label: "Introducción" },
      { href: "/docs/concepts", label: "Conceptos" },
      { href: "/docs/getting-started", label: "Instalación" },
      { href: "/docs/cli-reference", label: "Comandos del CLI" },
      { href: "/docs/architecture", label: "Arquitectura" },
    ],
  },
  {
    title: "Guías",
    items: [
      { href: "/docs/guides/connect-your-app", label: "Conectar tu aplicación" },
      { href: "/docs/guides/organizations-and-permissions", label: "Organizaciones y permisos" },
      { href: "/docs/guides/application-registration", label: "Registro de aplicaciones" },
      { href: "/docs/guides/invitations-and-sessions", label: "Invitaciones y sesiones" },
      { href: "/docs/guides/social-login", label: "Login social" },
    ],
  },
  {
    title: "Referencia",
    items: [
      { href: "/docs/examples", label: "Ejemplos" },
      { href: "/docs/troubleshooting", label: "Troubleshooting" },
      { href: "/docs/faq", label: "FAQ" },
      { href: "/docs/migration", label: "Migración" },
    ],
  },
];
