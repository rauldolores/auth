export const metadata = { title: "Troubleshooting — KontrolIA Auth" };

function Issue({
  symptom,
  cause,
  fix,
}: {
  symptom: string;
  cause: React.ReactNode;
  fix: React.ReactNode;
}) {
  return (
    <div className="k-mb-8 k-rounded-md k-border k-border-border k-p-4">
      <p className="k-mb-2 k-font-mono k-text-xs k-font-semibold k-text-destructive">{symptom}</p>
      <p className="k-mb-1 k-text-sm k-font-medium">Causa</p>
      <div className="k-mb-3">{cause}</div>
      <p className="k-mb-1 k-text-sm k-font-medium">Solución</p>
      {fix}
    </div>
  );
}

export default function TroubleshootingPage() {
  return (
    <article>
      <h1 className="k-mb-2 k-text-2xl k-font-semibold">Troubleshooting</h1>
      <p className="k-mb-6">
        Todo lo de esta página son bugs reales que aparecieron probando KontrolIA Auth en vivo contra un
        Supabase local durante el desarrollo — no problemas hipotéticos. Si algo de esto te aparece, ya se
        depuró una vez.
      </p>

      <Issue
        symptom='El registro de un usuario nuevo devuelve 500 en /auth/v1/signup'
        cause={
          <p>
            <code>kontrolia_auth.custom_access_token_hook</code> hace{" "}
            <code>jsonb_set(claims, &apos;&#123;organization_id&#125;&apos;, to_jsonb(active_org_id))</code>. Para
            un usuario sin organización todavía, <code>active_org_id</code> es <code>NULL</code>, y{" "}
            <code>to_jsonb(NULL::uuid)</code> es <code>NULL</code> de SQL — no un <code>jsonb null</code>. Como{" "}
            <code>jsonb_set</code> es estricta, eso colapsa el resultado completo de la función a{" "}
            <code>NULL</code>, y GoTrue no sabe qué hacer con un hook que devuelve nada.
          </p>
        }
        fix={
          <p>
            Envolver en <code>coalesce(to_jsonb(active_org_id), &apos;null&apos;::jsonb)</code>. Ya corregido en{" "}
            <code>packages/db/migrations/0007_custom_access_token_hook.sql</code>.
          </p>
        }
      />

      <Issue
        symptom={`PostgREST responde "Could not find the table 'public.X' in the schema cache" (404) o "Invalid schema: kontrolia_auth"`}
        cause={
          <p>
            Por defecto PostgREST solo expone los schemas <code>public</code> y <code>graphql_public</code>. El
            schema <code>kontrolia_auth</code> no está en esa lista hasta que se agrega explícitamente.
          </p>
        }
        fix={
          <p>
            Supabase Cloud: Dashboard → Project Settings → Data API → agrega{" "}
            <code>kontrolia_auth</code> al campo &quot;Exposed schemas&quot; (queda como{" "}
            <code>public, graphql_public, kontrolia_auth</code>). Se aplica solo, sin reiniciar nada. Supabase CLI
            (desarrollo local): agrega <code>&quot;kontrolia_auth&quot;</code> a <code>[api] schemas</code> en{" "}
            <code>config.toml</code> y reinicia con <code>supabase stop &amp;&amp; supabase start</code>{" "}
            (PostgREST necesita reiniciar para tomar el cambio). Docker propio: ya viene en{" "}
            <code>PGRST_DB_SCHEMAS</code> de <code>docker/docker-compose.yml</code>.
          </p>
        }
      />

      <Issue
        symptom="El servidor (middleware, Route Handlers) siempre ve al usuario como anónimo, aunque el navegador esté logueado"
        cause={
          <p>
            El SDK del navegador usaba el <code>createClient</code> plano de <code>supabase-js</code>{" "}
            (localStorage), mientras que el middleware/Route Handlers usan <code>createServerClient</code> de{" "}
            <code>@supabase/ssr</code> (cookies) — dos almacenes de sesión completamente distintos y
            desconectados entre sí.
          </p>
        }
        fix={
          <p>
            Usar <code>createBrowserClient</code> de <code>@supabase/ssr</code> en el navegador también, no{" "}
            <code>createClient</code> de <code>supabase-js</code>. Ya es lo que hace{" "}
            <code>@kontrolia/auth</code> internamente.
          </p>
        }
      />

      <Issue
        symptom='INSERT ... RETURNING falla con "new row violates row-level security policy", pero el mismo INSERT sin RETURNING funciona'
        cause={
          <p>
            Cuando un trigger <code>AFTER INSERT</code> crea una fila relacionada que una policy de{" "}
            <code>SELECT</code> necesita para dar visibilidad (por ejemplo, el trigger que crea el membership de
            Owner al crear una organización), Postgres puede evaluar la visibilidad de{" "}
            <code>RETURNING</code> usando una función <code>STABLE</code> cuyo resultado quedó cacheado antes de
            que el trigger corriera dentro del mismo statement.
          </p>
        }
        fix={
          <p>
            No usar <code>.insert(...).select().single()</code> cuando el resultado depende de un efecto del
            trigger. Hacer el <code>INSERT</code> simple, y un <code>SELECT</code> separado justo después —
            eso sí ve el efecto del trigger de forma confiable.
          </p>
        }
      />

      <Issue
        symptom='La ruta de aceptar invitación (o cualquier código que use el service role) falla con "permission denied for schema kontrolia_auth"'
        cause={
          <p>
            <code>service_role</code> tiene <code>BYPASSRLS</code>, pero eso es independiente de los{" "}
            <code>GRANT</code> a nivel de schema/tabla — nunca se le otorgó <code>USAGE</code> sobre el schema{" "}
            <code>kontrolia_auth</code>.
          </p>
        }
        fix={
          <p>
            <code>grant usage on schema kontrolia_auth to service_role;</code> más los grants de tabla — ya en{" "}
            <code>packages/db/migrations/0008_grants_and_hook_permissions.sql</code>.
          </p>
        }
      />

      <Issue
        symptom='Una página que usa useSearchParams() se queda colgada en su fallback/loading para siempre, sin ningún error en consola'
        cause={
          <p>
            El App Router de Next.js requiere que cualquier componente que use{" "}
            <code>useSearchParams()</code> esté envuelto en <code>&lt;Suspense&gt;</code>. Sin eso, no lanza un
            error — el contenido real se renderiza pero queda oculto detrás del fallback, indefinidamente.
          </p>
        }
        fix={
          <p>
            Envolver el componente en <code>&lt;Suspense fallback=...&gt;</code>. Ver{" "}
            <code>apps/auth-server/app/invitations/accept/page.tsx</code>.
          </p>
        }
      />

      <Issue
        symptom="Consultas contra el schema kontrolia_auth devuelven 404 aunque el cliente se creó con { db: { schema: 'kontrolia_auth' } }"
        cause={
          <p>
            <code>createBrowserClient</code> de <code>@supabase/ssr</code> no reenvía la opción{" "}
            <code>db.schema</code> del constructor al cliente subyacente — las queries terminan pegándole al
            schema <code>public</code> por defecto.
          </p>
        }
        fix={
          <p>
            Llamar <code>.schema(&quot;kontrolia_auth&quot;)</code> explícito en cada query (o guardar el resultado
            de esa llamada y reusarlo), en vez de confiar en la opción del constructor.
          </p>
        }
      />

      <Issue
        symptom='"tsx" (o node --env-file no usado) deja process.env.SUPABASE_URL undefined en un backend Express/NestJS'
        cause={<p><code>tsx</code> no carga archivos <code>.env</code> automáticamente — a diferencia de Next.js, que sí lo hace.</p>}
        fix={
          <p>
            Usar la flag nativa de Node: <code>tsx watch --env-file=.env src/index.ts</code> (Node 20.6+).
          </p>
        }
      />

      <Issue
        symptom="Un guard de NestJS con constructor(private reflector: Reflector) recibe reflector undefined en tiempo de ejecución"
        cause={
          <p>
            La inyección de dependencias de Nest basada en tipo depende de que{" "}
            <code>emitDecoratorMetadata</code> emita <code>design:paramtypes</code> — esbuild (que usa{" "}
            <code>tsx</code> por debajo) no siempre lo genera de forma confiable para parámetros de constructor.
          </p>
        }
        fix={
          <p>
            Leer los metadatos de ruta con el <code>Reflect</code> global directamente (
            <code>Reflect.getMetadata(KEY, context.getHandler())</code>) en vez de depender del servicio{" "}
            <code>Reflector</code> inyectable de Nest. Alternativa más robusta si necesitas DI real: cambiar de{" "}
            <code>tsx</code> a <code>ts-node</code> o <code>@swc/core</code> + <code>unplugin-swc</code>.
          </p>
        }
      />

      <Issue
        symptom='La pantalla de consentimiento OAuth (/oauth/consent) muestra "Solicitud inválida — Cannot read properties of undefined (reading &apos;startsWith&apos;)"'
        cause={
          <p>
            El código asumía que <code>GET /auth/v1/oauth/authorizations/&#123;id&#125;</code> siempre devuelve
            los detalles de una autorización pendiente (<code>&#123;authorization_id, redirect_uri, client,
            user, scope&#125;</code>). Pero para clientes públicos/de confianza, GoTrue puede decidir la
            autorización directamente en ese mismo GET y devolver en su lugar{" "}
            <code>&#123;redirect_url&#125;</code> — la misma forma que devolvería un{" "}
            <code>POST .../consent</code>. El código intentaba leer <code>redirectUri</code> de una respuesta
            que nunca la tuvo.
          </p>
        }
        fix={
          <p>
            <code>getOAuthAuthorizationDetails()</code> del SDK ahora devuelve una unión (
            <code>&#123;status: &quot;pending&quot;, details&#125;</code> o{" "}
            <code>&#123;status: &quot;decided&quot;, redirectUrl&#125;</code>), y{" "}
            <code>/oauth/consent</code> sigue <code>redirectUrl</code> de inmediato cuando ya viene decidida, en
            vez de asumir que siempre hay una pantalla de consentimiento que mostrar.
          </p>
        }
      />

      <Issue
        symptom="Al volver de /oauth/callback, admin-panel dispara una segunda autorización OAuth anidada (el `state` de la nueva URL contiene la URL del callback anterior)"
        cause={
          <p>
            El layout raíz de admin-panel envuelve <em>todas</em> las rutas —incluida{" "}
            <code>/oauth/callback</code>— en el mismo <code>DashboardShell</code> que dispara el redirect
            automático cuando no hay sesión. Mientras el intercambio de código por sesión todavía está en
            vuelo, <code>isAuthenticated</code> sigue en <code>false</code>, y ese mismo guard dispara{" "}
            <em>otra</em> autorización antes de que el callback termine.
          </p>
        }
        fix={
          <p>
            <code>DashboardShell</code> ahora detecta <code>pathname === &quot;/oauth/callback&quot;</code> y
            se salta tanto el <code>useEffect</code> de auto-redirect como el <code>AuthGuard</code> por
            completo en esa ruta — la página de callback ya maneja su propio estado de carga/error.
          </p>
        }
      />
    </article>
  );
}
