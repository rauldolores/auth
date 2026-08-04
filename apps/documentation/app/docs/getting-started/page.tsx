export const metadata = { title: "Instalación — KontrolIA Auth" };

export default function GettingStartedPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Instalación</h1>
      <p>
        Instalar KontrolIA Auth son dos preguntas independientes — ninguna asume Docker, y ninguna asume que
        tienes que crear un proyecto Supabase nuevo.
      </p>

      <h2>Pregunta 1 — ¿de dónde sale tu Supabase?</h2>
      <p>
        <strong>Ya tengo un proyecto</strong> (Cloud o self-hosted): corre las migraciones apuntando a su
        connection string. No se toca nada de tu schema <code>public</code> — todo vive aislado en el schema{" "}
        <code>kontrolia</code>.
      </p>
      <pre>
        <code>{`DATABASE_URL="postgresql://usuario:password@host:5432/postgres" \\
  pnpm --filter @kontrolia/db migrate`}</code>
      </pre>
      <p>
        <strong>No tengo uno</strong>: levanta el stack mínimo self-hosted (Postgres + GoTrue + PostgREST + Kong
        — no el stack completo de 13 servicios de Supabase, solo lo que este producto usa).
      </p>
      <pre>
        <code>{`cp docker/.env.example docker/.env
# genera JWT_SECRET / ANON_KEY / SERVICE_ROLE_KEY reales antes de continuar
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @kontrolia/db migrate`}</code>
      </pre>

      <h3>Paso manual: el Custom Access Token Hook</h3>
      <p>
        Este es el único paso que la migración no puede automatizar por sí sola, porque activar el hook vive
        fuera de la base de datos:
      </p>
      <ul>
        <li>
          <strong>Self-hosted / docker-compose</strong>: ya viene activado vía la variable{" "}
          <code>GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI</code> en <code>docker/docker-compose.yml</code>.
        </li>
        <li>
          <strong>Supabase CLI (desarrollo local)</strong>: agrega en tu <code>supabase/config.toml</code>:
          <pre>
            <code>{`[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/kontrolia/custom_access_token_hook"`}</code>
          </pre>
          y reinicia con <code>supabase stop && supabase start</code>.
        </li>
        <li>
          <strong>Supabase Cloud</strong>: Dashboard → Authentication → Hooks → Custom Access Token → selecciona{" "}
          <code>kontrolia.custom_access_token_hook</code>. No hay API pública para automatizar esto.
        </li>
      </ul>

      <h3>Si conectas a un proyecto Supabase CLI existente</h3>
      <p>
        Por defecto, PostgREST solo expone el schema <code>public</code>. Agrega <code>kontrolia</code> a la
        lista de schemas expuestos en <code>config.toml</code> y reinicia:
      </p>
      <pre>
        <code>{`[api]
schemas = ["public", "graphql_public", "kontrolia"]`}</code>
      </pre>

      <h2>Pregunta 2 — ¿dónde despliegas auth-server / admin-panel?</h2>
      <p>
        Son apps Next.js estándar — Docker (incluido en el mismo <code>docker-compose</code>), Vercel, Coolify,
        Railway, o cualquier plataforma compatible con Next.js/Node. Solo necesitan las variables de{" "}
        <code>.env.example</code> de cada app.
      </p>

      <h2>Primer usuario y organización</h2>
      <ol>
        <li>
          Abre <code>auth-server</code> (por defecto <code>http://localhost:3000</code>) y regístrate en{" "}
          <code>/register</code>.
        </li>
        <li>
          En la pantalla de inicio, crea tu primera organización — quedas inscrito como <code>Owner</code>{" "}
          automáticamente.
        </li>
        <li>
          Abre <code>admin-panel</code> (por defecto <code>http://localhost:3001</code>) con la misma cuenta
          para gestionar roles, permisos e invitaciones.
        </li>
      </ol>

      <h2>Wizard del CLI</h2>
      <p>
        <code>create-kontrolia-auth</code> automatiza las dos preguntas de arriba: pregunta si conectas a un
        Supabase existente o creas uno self-hosted nuevo, corre las migraciones, y genera los{" "}
        <code>.env.local</code> de <code>auth-server</code>/<code>admin-panel</code> según dónde vayas a
        desplegarlos.
      </p>
      <pre>
        <code>{`pnpm install
pnpm --filter create-kontrolia-auth dev`}</code>
      </pre>
    </article>
  );
}
