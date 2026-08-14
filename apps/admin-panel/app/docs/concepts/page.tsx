export const metadata = { title: "Conceptos — KontrolIA Auth" };

function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <h3>{term}</h3>
      {children}
    </>
  );
}

export default function ConceptsPage() {
  return (
    <article>
      <h1 className="k-mb-4 k-text-2xl k-font-semibold">Conceptos</h1>
      <p>
        Esta página explica, en lenguaje simple, las palabras técnicas que vas a encontrar en el resto de la
        documentación. No necesitas leerla de corrido — úsala como diccionario cuando algún término no te quede
        claro.
      </p>

      <Term term="IAM (Identity &amp; Access Management)">
        <p>
          El nombre técnico de "quién es esta persona y qué puede hacer". IAM es la categoría de sistema a la
          que pertenece KontrolIA Auth: gestiona identidades (usuarios) y accesos (permisos) para una o varias
          aplicaciones.
        </p>
      </Term>

      <Term term="Autenticación vs. autorización">
        <p>
          Son dos preguntas distintas que se confunden fácil. <strong>Autenticación</strong> es "¿eres quien
          dices ser?" (iniciar sesión con correo y contraseña, o con Google). <strong>Autorización</strong> es
          "ya sé quién eres, ¿tienes permiso para hacer esto?" (por ejemplo, crear una factura). KontrolIA Auth
          resuelve ambas.
        </p>
      </Term>

      <Term term="Organización (multi-tenant)">
        <p>
          Un equipo, empresa o cuenta dentro de tu aplicación — el contenedor al que pertenecen los usuarios,
          los roles y los datos. Un mismo usuario puede pertenecer a varias organizaciones a la vez (por ejemplo,
          trabajar para dos empresas distintas que usan la misma app), pero solo una está "activa" en cada
          momento. "Multi-tenant" es el término técnico para un sistema donde muchas organizaciones distintas
          conviven en la misma instalación, sin ver los datos unas de otras.
        </p>
      </Term>

      <Term term="Rol y permiso">
        <p>
          Un <strong>permiso</strong> es una acción concreta que se puede permitir o negar, como "crear
          facturas" o "eliminar usuarios". Un <strong>rol</strong> es un paquete con nombre que agrupa varios
          permisos — por ejemplo, el rol "Contador" podría incluir "ver facturas" y "crear facturas", pero no
          "eliminar usuarios". En vez de asignar permisos uno por uno a cada persona, le asignas un rol.
        </p>
      </Term>

      <Term term="RBAC (Role-Based Access Control)">
        <p>
          El nombre técnico del sistema de "roles con permisos" descrito arriba. KontrolIA Auth usa una versión
          jerárquica: un permiso como <code>facturacion.facturas.*</code> significa "cualquier acción sobre
          facturas", sin tener que listarlas una por una.
        </p>
      </Term>

      <Term term="OAuth2 / OIDC / &quot;iniciar sesión con Google&quot;">
        <p>
          OAuth2 (y OpenID Connect, construido sobre OAuth2) es el protocolo estándar detrás del botón
          "Continuar con Google" o "Continuar con Microsoft" que ves en casi cualquier app. En vez de crear una
          contraseña nueva, le pides a Google/Microsoft que confirme quién eres. KontrolIA Auth lo soporta de
          forma nativa — activar un proveedor es cuestión de configuración, no de escribir código.
        </p>
      </Term>

      <Term term="JWT (JSON Web Token)">
        <p>
          El "gafete de identificación" digital que recibe una persona al iniciar sesión. Es un texto codificado
          que dice quién es el usuario, en qué organización está activo, y qué permisos tiene — la aplicación lo
          revisa en cada acción para decidir si algo está permitido, sin tener que preguntarle a la base de datos
          cada vez.
        </p>
      </Term>

      <Term term="Self-hosted vs. Cloud">
        <p>
          <strong>Self-hosted</strong> significa que tú (o tu empresa) controlas el servidor donde vive todo —
          tus propios servidores, o cualquier proveedor de hosting que elijas. <strong>Cloud</strong> significa
          usar un servicio ya administrado por un tercero (por ejemplo, Supabase Cloud), sin tener que preocuparte
          por mantener servidores tú mismo. KontrolIA Auth funciona con cualquiera de los dos — es tu decisión,
          no una limitación del producto.
        </p>
      </Term>

      <Term term="Supabase">
        <p>
          El servicio que KontrolIA Auth usa por debajo para guardar la información de forma segura y manejar el
          inicio de sesión de bajo nivel (contraseñas encriptadas, tokens, etc.). No necesitas saber cómo
          funciona Supabase para usar KontrolIA Auth — el SDK y el panel de administración lo esconden por
          completo. Solo lo vas a ver mencionado durante la instalación, porque ahí es donde decides "dónde vive
          mi base de datos".
        </p>
      </Term>

      <Term term="RLS (Row Level Security)">
        <p>
          Una función de seguridad de la base de datos (Postgres) que garantiza que cada organización solo puede
          ver y modificar sus propios datos, sin importar qué parte del código haga la consulta — la protección
          vive en la base de datos misma, no depende de que cada pantalla "se acuerde" de filtrar correctamente.
          Es un detalle técnico interno; no necesitas configurar nada para beneficiarte de él.
        </p>
      </Term>

      <Term term="SDK">
        <p>
          Software Development Kit — un paquete de código listo para usar que le da a tu aplicación funciones ya
          resueltas (iniciar sesión, verificar permisos, etc.) sin que tengas que programarlas desde cero. Los
          SDKs de KontrolIA Auth (<code>@kontrolia/auth</code>, <code>@kontrolia/react</code>,{" "}
          <code>@kontrolia/next</code>) son justamente eso.
        </p>
      </Term>

      <p>
        ¿Listo para instalar? Ve a <a href="/docs/getting-started">Instalación</a>.
      </p>
    </article>
  );
}
