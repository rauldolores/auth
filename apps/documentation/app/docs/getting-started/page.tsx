export const metadata = { title: "Instalación — KontrolIA Auth" };

export default function GettingStartedPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Instalación</h1>
      <p>
        La forma recomendada de instalar KontrolIA Auth es el instalador oficial — te va preguntando lo que
        necesita saber, en orden, y explica cada opción. Si algún término no te suena familiar (¿qué es
        Supabase? ¿qué es Docker?), la página de <a href="/docs/concepts">Conceptos</a> lo explica en lenguaje
        simple.
      </p>

      <h2>Instalador (recomendado)</h2>
      <p>Abre una terminal donde quieras guardar el proyecto y corre:</p>
      <pre>
        <code>npx create-kontrolia-auth</code>
      </pre>
      <p>
        No necesitas instalar nada de antemano — <code>npx</code> descarga el instalador, lo ejecuta una vez, y
        no deja nada instalado permanentemente en tu computadora.
      </p>

      <h3>Paso 1 de 3 — ¿de dónde sale tu base de datos?</h3>
      <p>
        El instalador pregunta si ya tienes un proyecto <a href="https://supabase.com">Supabase</a> (el servicio
        que guarda usuarios, organizaciones y permisos de forma segura) o si quiere crear uno nuevo:
      </p>
      <ul>
        <li>
          <strong>"Ya tengo un proyecto Supabase"</strong> — te pide la URL y las claves que Supabase te dio al
          crear tu proyecto (las encuentras en Settings → API dentro de tu proyecto en supabase.com). El
          instalador prepara tu proyecto sin tocar ninguna tabla que ya tengas ahí.
        </li>
        <li>
          <strong>"Crear uno nuevo self-hosted con Docker"</strong> — si no tienes cuenta en Supabase todavía, o
          quieres probar en tu propia computadora primero. Necesitas tener{" "}
          <a href="https://www.docker.com/products/docker-desktop">Docker Desktop</a> instalado; el instalador
          te avisa si falta y te dice exactamente qué comando correr para levantarlo.
        </li>
      </ul>

      <h3>Paso 2 de 3 — ¿dónde va a vivir la aplicación web?</h3>
      <p>
        Son dos pantallas web normales (la de inicio de sesión y el panel de administración) — el instalador
        pregunta dónde las vas a alojar: tu propia computadora (para probar), Docker, Vercel, Railway, Coolify, o
        cualquier otro servidor. Genera automáticamente los archivos de configuración que esa opción necesita.
      </p>

      <h3>Paso 3 de 3 — registra tu primera aplicación (opcional)</h3>
      <p>
        Una "aplicación" en KontrolIA Auth es lo que le da nombre a tu catálogo de permisos — por ejemplo, si tu
        producto se llama "Facturación", puedes registrar los permisos <code>facturas.crear</code>,{" "}
        <code>facturas.ver</code>, etc. Puedes omitir este paso ahora y hacerlo más tarde.
      </p>

      <h2>Primer usuario y organización</h2>
      <p>Cuando el instalador termina, abre la aplicación en tu navegador y sigue estos tres pasos:</p>
      <ol>
        <li>
          Entra a la pantalla de inicio de sesión (por defecto <code>http://localhost:3000</code>) y regístrate
          en <code>/register</code> con tu correo y una contraseña.
        </li>
        <li>
          En la pantalla de inicio, crea tu primera organización (el nombre de tu equipo/empresa dentro del
          sistema) — quedas inscrito automáticamente como su administrador/a (<code>Owner</code>).
        </li>
        <li>
          Abre el panel de administración (por defecto <code>http://localhost:3001</code>) con la misma cuenta.
          Ahí gestionas usuarios, roles, permisos e invitaciones — todo con clics, sin escribir código.
        </li>
      </ol>
      <p>
        A partir de aquí, invitar a alguien más a tu organización, crear un rol personalizado, o revisar quién
        hizo qué (audit log) se hace desde el panel de administración. No necesitas volver a tocar la terminal
        para el uso del día a día.
      </p>

      <hr />

      <h2>Instalación manual / avanzada</h2>
      <p>
        Lo siguiente es para quien quiere control total sobre cada paso (por ejemplo, para automatizar un
        despliegue), en vez de usar el instalador interactivo. Son las mismas dos decisiones de arriba, hechas a
        mano.
      </p>

      <h3>¿De dónde sale tu Supabase?</h3>
      <p>
        <strong>Ya tengo un proyecto</strong> (Cloud o self-hosted): corre las migraciones apuntando a su
        connection string. No se toca nada de tu schema <code>public</code> — todo vive aislado en el schema{" "}
        <code>kontrolia</code>.
      </p>
      <pre>
        <code>{`DATABASE_URL="postgresql://usuario:password@host:5432/postgres" \\
  npx -p @kontrolia/db kontrolia-db-migrate`}</code>
      </pre>
      <p>
        <strong>No tengo uno</strong>: levanta el stack mínimo self-hosted (Postgres + GoTrue + PostgREST + Kong
        — no el stack completo de 13 servicios de Supabase, solo lo que este producto usa).
      </p>
      <pre>
        <code>{`cp docker/.env.example docker/.env
# genera JWT_SECRET / ANON_KEY / SERVICE_ROLE_KEY reales antes de continuar
docker compose -f docker/docker-compose.yml up -d
DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres" \\
  npx -p @kontrolia/db kontrolia-db-migrate`}</code>
      </pre>

      <h4>Paso manual: el Custom Access Token Hook</h4>
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

      <h4>Si conectas a un proyecto Supabase CLI existente</h4>
      <p>
        Por defecto, PostgREST solo expone el schema <code>public</code>. Agrega <code>kontrolia</code> a la
        lista de schemas expuestos en <code>config.toml</code> y reinicia:
      </p>
      <pre>
        <code>{`[api]
schemas = ["public", "graphql_public", "kontrolia"]`}</code>
      </pre>

      <h3>¿Dónde despliegas auth-server / admin-panel?</h3>
      <p>
        Son apps Next.js estándar — Docker (incluido en el mismo <code>docker-compose</code>), Vercel, Coolify,
        Railway, o cualquier plataforma compatible con Next.js/Node. Solo necesitan las variables de{" "}
        <code>.env.example</code> de cada app.
      </p>
    </article>
  );
}
