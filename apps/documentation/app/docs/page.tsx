export const metadata = { title: "Introducción — KontrolIA Auth" };

export default function DocsIntroPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">KontrolIA Auth</h1>
      <p>
        Plataforma Open Source de Identity &amp; Access Management (IAM) para aplicaciones React, Next.js y
        cualquier stack moderno. Autenticación, organizaciones multi-tenant y RBAC jerárquico, instalable sobre un
        proyecto Supabase existente o uno nuevo, y desplegable en cualquier servidor.
      </p>
      <p>
        La idea central: tus aplicaciones dejan de administrar usuarios directamente y pasan a usar
        KontrolIA Auth. El SDK (<code>@kontrolia/auth</code>, <code>@kontrolia/react</code>,{" "}
        <code>@kontrolia/next</code>) es la única forma soportada de integrarse — ninguna app conoce Supabase,
        OAuth ni JWT directamente.
      </p>

      <h2>¿Por dónde empiezo?</h2>
      <ul>
        <li>
          <a href="/docs/getting-started">Instalación</a> — las dos preguntas de cualquier instalación: de dónde
          sale tu Supabase, y dónde despliegas <code>auth-server</code>/<code>admin-panel</code>.
        </li>
        <li>
          <a href="/docs/architecture">Arquitectura</a> — el schema <code>kontrolia</code>, el Custom Access
          Token Hook, RLS, y cómo funciona el multi-tenant.
        </li>
        <li>
          <a href="/docs/guides/organizations-and-permissions">Guías</a> — organizaciones, permisos jerárquicos,
          invitaciones, sesiones, login social.
        </li>
      </ul>

      <h2>Estructura del monorepo</h2>
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
            <td>Dashboard de administración (usuarios, roles, permisos, invitaciones, audit log)</td>
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
              <code>create-kontrolia-auth</code> — wizard de instalación
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
