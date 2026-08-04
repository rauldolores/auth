# Ejemplo: Express (resource server)

Planeado para v1.5 del roadmap. Mostrará cómo un backend Express valida peticiones usando la verificación de token por JWKS del SDK (mismo patrón que `verifyRequest()` en [`packages/next-sdk/src/server.ts`](../../packages/next-sdk/src/server.ts)), sin que la app conozca JWT ni JWKS directamente.
