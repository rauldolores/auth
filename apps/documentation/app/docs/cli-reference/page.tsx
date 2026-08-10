export const metadata = { title: "Comandos del CLI — KontrolIA Auth" };

export default function CliReferencePage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Comandos del CLI</h1>
      <p>
        <code>create-kontrolia-auth</code> no es solo el instalador — es una herramienta que te acompaña durante
        toda la vida de tu instalación: instalar, mantenerte al día, y (re)conectar un despliegue. Todos los
        comandos se corren con <code>npx</code>, así que nunca necesitas instalar nada de forma permanente:
      </p>
      <pre>
        <code>{`npx create-kontrolia-auth [carpeta]   # instalación completa (por defecto)
npx create-kontrolia-auth update      # traer el código/migraciones más recientes
npx create-kontrolia-auth deploy      # (re)conectar un despliegue sin repetir preguntas
npx create-kontrolia-auth migrate     # aplicar migraciones contra cualquier base
npx create-kontrolia-auth doctor      # solo revisar requisitos del entorno`}</code>
      </pre>

      <h2>Instalación completa</h2>
      <pre>
        <code>npx create-kontrolia-auth mi-app</code>
      </pre>
      <p>
        El comando por defecto (con o sin nombre de carpeta). Es lo único que necesitas correr la primera vez.
        Hace, en orden:
      </p>
      <ol>
        <li>Revisa requisitos (Node, pnpm, git, Docker si aplica) y te dice exactamente qué instalar si falta algo.</li>
        <li>
          Si no estás ya dentro del repo, lo descarga a <code>./mi-app</code> e instala dependencias. Si ya
          estás dentro (por ejemplo, en desarrollo), lo detecta y se salta este paso.
        </li>
        <li>
          Pregunta de dónde sale tu base de datos: un proyecto Supabase que ya tengas (Cloud o self-hosted), o
          uno nuevo que levanta por ti con Docker. Si eliges un proyecto Supabase Cloud existente, además ofrece
          configurar automáticamente los tres ajustes que solo viven en su Dashboard — exponer el schema{" "}
          <code>kontrolia_auth</code> en la API, activar el Custom Access Token Hook, y activar el servidor
          OAuth 2.1 (necesario para que apps de otros dominios inicien sesión) — pidiéndote un{" "}
          <em>Personal Access Token</em> de tu cuenta Supabase (distinto a las keys del proyecto; no se guarda).
        </li>
        <li>Aplica las migraciones contra esa base de datos.</li>
        <li>(Opcional) Registra tu primera aplicación y su catálogo de permisos.</li>
        <li>
          Pregunta dónde van a vivir <code>auth-server</code> y <code>admin-panel</code>, genera sus{" "}
          <code>.env.local</code>, y — si eliges Vercel y el repo está en GitHub — crea los dos proyectos{" "}
          <strong>y los despliega</strong> automáticamente vía la API de Vercel (pidiendo solo un API token, con
          instrucciones de dónde conseguirlo). Para Docker, Railway, Render o Coolify te da los pasos exactos.
        </li>
      </ol>

      <h2>
        <code>update</code> — traer lo más reciente
      </h2>
      <pre>
        <code>npx create-kontrolia-auth update</code>
      </pre>
      <p>
        Para una instalación ya existente (una carpeta con este repo clonado). Hace <code>git pull</code>{" "}
        (solo fast-forward — nunca reescribe cambios locales), reinstala dependencias, y vuelve a aplicar
        migraciones (son idempotentes, así que es seguro correrlo cuantas veces quieras). Si tienes cambios
        propios sin guardar en archivos que ya están en el repo, se detiene y te pide que los guardes primero —
        pero un archivo suelto sin trackear (por ejemplo, algo que dejó otra herramienta) nunca lo bloquea, ya
        que eso <code>git pull</code> nunca lo tocaría de todas formas.
      </p>
      <p>
        <strong>Qué no hace:</strong> no vuelve a desplegar nada por ti — solo actualiza la copia local/el
        código fuente. Si despliegas con Docker, corre{" "}
        <code>docker compose -f docker/docker-compose.yml up -d --build</code> después. Si usas Vercel/Railway/
        etc., vuelve a desplegar desde ahí (o corre <code>deploy</code>, ver abajo).
      </p>

      <h2>
        <code>deploy</code> — (re)conectar un despliegue
      </h2>
      <pre>
        <code>npx create-kontrolia-auth deploy</code>
      </pre>
      <p>
        Va directo al paso de despliegue, sin repetir las preguntas de base de datos ni de aplicación que ya
        respondiste una vez. Pensado para cuando ya tienes todo instalado y funcionando, y solo quieres:
      </p>
      <ul>
        <li>Conectar una segunda app (por ejemplo, agregar <code>admin-panel</code> a Vercel después de haber desplegado solo <code>auth-server</code>).</li>
        <li>Cambiar de destino de despliegue (pasar de Docker local a Vercel, por ejemplo).</li>
        <li>Regenerar los <code>.env.local</code> porque cambiaron las URLs públicas.</li>
      </ul>
      <p>
        Si ya habías corrido el instalador o <code>deploy</code> antes en esta misma carpeta, reutiliza las
        credenciales de Supabase que ya diste (te pregunta si las usa, con opción de capturar otras) en vez de
        pedírtelas de nuevo — igual que las URLs de <code>auth-server</code>/<code>admin-panel</code> y el
        dominio de cookie compartido, que quedan pre-llenados con lo último que guardaste, editable.
      </p>

      <h2>
        <code>migrate</code> — aplicar migraciones a mano
      </h2>
      <pre>
        <code>npx create-kontrolia-auth migrate</code>
      </pre>
      <p>
        Pide una connection string de Postgres y aplica las migraciones del schema <code>kontrolia_auth</code>{" "}
        contra ella. Útil si administras la base de datos por separado del resto del flujo, o si quieres
        aplicar migraciones sin pasar por ninguna otra pregunta. Es lo mismo que corren internamente el
        instalador y <code>update</code> — pero puedes correrlo solo, las veces que quieras (es idempotente).
      </p>

      <h2>
        <code>doctor</code> — solo revisar el entorno
      </h2>
      <pre>
        <code>npx create-kontrolia-auth doctor</code>
      </pre>
      <p>
        Corre nada más el chequeo de requisitos (Node, pnpm, git, Docker) y te dice qué falta instalar, sin
        tocar ninguna base de datos ni escribir ningún archivo. Útil para diagnosticar un entorno antes de
        instalar, o para confirmar que un servidor nuevo ya tiene todo lo necesario.
      </p>
    </article>
  );
}
