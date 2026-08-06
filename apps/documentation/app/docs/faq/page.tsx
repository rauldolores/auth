export const metadata = { title: "FAQ — KontrolIA Auth" };

function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <>
      <h3>{q}</h3>
      {children}
    </>
  );
}

export default function FaqPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">FAQ</h1>

      <Q q="¿Mi aplicación necesita saber que usa Supabase por debajo?">
        <p>
          No. El SDK (<code>@kontrolia/auth</code>, <code>@kontrolia/react</code>, <code>@kontrolia/next</code>)
          es la única forma soportada de integrarse. Ninguna app importa <code>supabase-js</code>, maneja un
          redirect de OAuth, o decodifica un JWT — eso incluye el frontend y, casi por completo, el backend
          (ver la siguiente pregunta).
        </p>
      </Q>

      <Q q="Entonces, ¿por qué el ejemplo de Express sí toca un Request/JWT?">
        <p>
          Un resource server (un backend que recibe un <code>Authorization: Bearer</code>) siempre tiene que
          validar ese token — es estándar en cualquier arquitectura OAuth2/OIDC, incluido Auth0. La promesa se
          cumple igual: nunca escribes código de verificación de JWT ni conoces JWKS — solo llamas{" "}
          <code>requirePermission()</code> del SDK, que internamente valida contra el JWKS de tu proyecto.
        </p>
      </Q>

      <Q q="¿Puedo usar mi proyecto Supabase Cloud existente, o tengo que crear uno nuevo?">
        <p>
          Cualquiera de los dos. Ver <a href="/docs/getting-started">Instalación</a> — son dos preguntas
          independientes (de dónde sale tu Supabase, y dónde despliegas las apps), ninguna asume Docker.
        </p>
      </Q>

      <Q q="¿Por qué el JWT no trae todas mis organizaciones?">
        <p>
          Para que el token no crezca sin límite con usuarios en muchas organizaciones, y para no filtrar en un
          solo JWT los permisos de organizaciones que no tienen nada que ver entre sí. Solo la organización{" "}
          <em>activa</em> va en el token; el resto se consulta aparte. Ver{" "}
          <a href="/docs/architecture">Arquitectura</a>.
        </p>
      </Q>

      <Q q="Le quité un permiso a un rol pero el usuario todavía puede hacer la acción">
        <p>
          El JWT es de vida corta (1 hora por defecto) pero válido hasta que expira — la misma limitación que
          tiene cualquier sistema basado en JWT stateless, incluidos Auth0 y Clerk. Para acciones sensibles,
          vuelve a consultar la base directamente en vez de confiar solo en el claim.
        </p>
      </Q>

      <Q q="¿Cómo registro una aplicación de terceros con su propio client_id/secret (estilo Auth0)?">
        <p>
          Registra un cliente en el servidor OAuth 2.1 nativo de GoTrue (Supabase Auth) — el mismo mecanismo que
          usa admin-panel para su propio SSO. Ver <a href="/docs/architecture">Arquitectura</a>, sección "SSO
          entre auth-server y admin-panel", para el flujo completo y el comando <code>curl</code> de registro
          manual.
        </p>
      </Q>

      <Q q="¿Soporta MFA / login con Microsoft?">
        <p>Sí — TOTP (app autenticadora) y login con Google/Microsoft, listos para usar desde el SDK y la UI.</p>
      </Q>

      <Q q="¿Por qué son dos proyectos separados, auth-server y admin-panel?">
        <p>
          Tienen audiencias y ciclos de vida distintos. <code>auth-server</code> es la pantalla de login/registro
          que ven <em>todos</em> tus usuarios finales — vive donde vivan tus otras apps, normalmente en un
          dominio público de cara al usuario. <code>admin-panel</code> es la herramienta de gestión que solo usan
          administradores — muchos equipos prefieren ponerla detrás de una VPN, un dominio interno, o
          restricciones de red distintas a las de la app pública. Separarlos deja esa decisión de despliegue en
          tus manos en vez de forzarlas a vivir juntas. La sesión se mantiene compartida entre ambas de todos
          modos — por cookie si comparten dominio/subdominio, o por el flujo OAuth 2.1 si viven en dominios
          completamente distintos (ver <a href="/docs/architecture">Arquitectura</a>).
        </p>
      </Q>
      <Q q="¿Un token emitido para una app de mi ecosistema sirve en otra (llamadas servicio-a-servicio entre mis propias apps)?">
        <p>
          Sí, siempre que ambas apps verifiquen tokens del <strong>mismo</strong> proyecto Supabase/KontrolIA
          Auth (el modelo que este producto asume: un identity provider, varias aplicaciones registradas).{" "}
          <code>verifyRequest()</code>/<code>requirePermission()</code> no revisan ningún claim de{" "}
          <code>aud</code> — solo la firma contra el JWKS del proyecto y la expiración. No existe (ni hace falta)
          un equivalente a <code>skipAudience</code>: nunca hubo una restricción de audiencia que quitar. Un
          usuario logueado en la App A que use un token de esa sesión contra un endpoint de la App B pasa la
          verificación igual que si fuera un endpoint de la propia App A.
        </p>
        <p>
          Ojo con la distinción: esto cubre un <em>token de sesión de un usuario real</em>, reenviado entre tus
          apps. Para una llamada máquina-a-máquina sin ningún usuario de por medio (una app autenticándose como
          sí misma, no en nombre de nadie), no uses un JWT de usuario — usa un secreto propio de esa aplicación,
          como el que ya genera el registro de aplicaciones para <code>/api/applications/sync</code> (ver{" "}
          <a href="/docs/guides/application-registration">Registro de aplicaciones</a>). Ese mecanismo hoy solo
          autoriza la sincronización del catálogo de permisos — generalizarlo para autorizar cualquier llamada
          servicio-a-servicio es una extensión posible, pero deliberadamente no construida todavía sin un caso de
          uso concreto que la necesite.
        </p>
      </Q>
    </article>
  );
}
