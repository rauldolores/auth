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
          Ese flujo completo llega en v2, cuando el OAuth 2.1 Server de GoTrue salga de beta pública. En v1 la
          integración es de primera parte: tus propias apps React/Next usan el SDK directo contra tu Supabase.
        </p>
      </Q>

      <Q q="¿Soporta MFA / login con Microsoft?">
        <p>
          Son nativos de Supabase Auth (incluso self-hosted) y llegan como features de v2 en la UI/SDK de
          KontrolIA — técnicamente no requieren I+D adicional, es principalmente exponerlos.
        </p>
      </Q>
    </article>
  );
}
