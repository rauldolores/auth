export const metadata = { title: "Introducción — KontrolIA Auth" };

export default function DocsIntroPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">KontrolIA Auth</h1>
      <p>
        Sistema de inicio de sesión, usuarios, organizaciones y permisos, listo para instalar en tu aplicación —
        en vez de construirlo desde cero. Es Open Source (código abierto): puedes instalarlo sobre un proyecto
        Supabase que ya tengas o crear uno nuevo, y desplegarlo en cualquier servidor que elijas.
      </p>
      <p>
        La idea central: tu aplicación deja de administrar usuarios y contraseñas directamente, y en su lugar le
        pregunta a KontrolIA Auth "¿quién es esta persona?" y "¿puede hacer esto?". El SDK (
        <code>@kontrolia/auth</code>, <code>@kontrolia/react</code>, <code>@kontrolia/next</code>) es la única
        forma soportada de integrarse — tu código nunca toca Supabase, OAuth ni JWT directamente.
      </p>

      <h2>¿Por dónde empiezo?</h2>
      <p>Depende de qué vas a hacer:</p>
      <ul>
        <li>
          <strong>¿Vas a instalarlo y administrarlo, sin programar?</strong> Empieza por{" "}
          <a href="/docs/concepts">Conceptos</a> si algún término técnico no te suena familiar, y luego sigue{" "}
          <a href="/docs/getting-started">Instalación</a> paso a paso. Después de instalar, todo el trabajo del
          día a día (crear usuarios, roles, invitaciones) se hace con clics desde el panel de administración.
        </li>
        <li>
          <strong>¿Eres desarrollador/a integrando el SDK en tu app?</strong> Ve directo a{" "}
          <a href="/docs/getting-started">Instalación</a>, y después a las{" "}
          <a href="/docs/guides/organizations-and-permissions">Guías</a> para proteger rutas/componentes por
          permiso, y a <a href="/docs/examples">Ejemplos</a> para ver el SDK integrado en Next.js, React, Express
          y NestJS.
        </li>
        <li>
          <strong>¿Quieres entender cómo funciona por dentro?</strong>{" "}
          <a href="/docs/architecture">Arquitectura</a> explica el schema de base de datos, cómo se generan los
          permisos, y las decisiones de seguridad detrás del diseño.
        </li>
      </ul>

      <h2>Estructura del monorepo</h2>
      <p>
        Esta tabla es para quien vaya a contribuir al código fuente del propio KontrolIA Auth — si solo vas a
        usarlo en tu aplicación, no necesitas conocerla.
      </p>
      <table>
        <thead>
          <tr>
            <th>Paquete/app</th>
            <th>Qué es</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>apps/auth-server</code>
            </td>
            <td>UI de login/registro/recuperación + API de orquestación (organizaciones, invitaciones, dispositivos)</td>
          </tr>
          <tr>
            <td>
              <code>apps/admin-panel</code>
            </td>
            <td>Panel de administración (usuarios, roles, permisos, invitaciones, audit log)</td>
          </tr>
          <tr>
            <td>
              <code>packages/auth-sdk</code>
            </td>
            <td>
              <code>@kontrolia/auth</code> — core sin framework, y <code>@kontrolia/auth/server</code> para
              backends
            </td>
          </tr>
          <tr>
            <td>
              <code>packages/react-sdk</code>
            </td>
            <td>
              <code>@kontrolia/react</code> — <code>AuthProvider</code>, guards, <code>useAuth()</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>packages/next-sdk</code>
            </td>
            <td>
              <code>@kontrolia/next</code> — middleware de rutas para Next.js
            </td>
          </tr>
          <tr>
            <td>
              <code>packages/ui</code>
            </td>
            <td>
              <code>@kontrolia/ui</code> — componentes de login/registro/etc. ya armados
            </td>
          </tr>
          <tr>
            <td>
              <code>packages/permissions</code>
            </td>
            <td>Motor de evaluación RBAC con wildcards jerárquicos</td>
          </tr>
          <tr>
            <td>
              <code>packages/db</code>
            </td>
            <td>Migraciones SQL del schema <code>kontrolia</code>, RLS, triggers</td>
          </tr>
          <tr>
            <td>
              <code>packages/cli</code>
            </td>
            <td>
              <code>create-kontrolia-auth</code> — el instalador
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
