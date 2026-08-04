# Changesets

Este repo usa [Changesets](https://github.com/changesets/changesets) para versionar y publicar los 8 paquetes públicos bajo `@kontrolia/*` (más `create-kontrolia-auth`). Las apps de `apps/` y los ejemplos de `examples/` son privados y quedan excluidos — ver `.changeset/config.json`.

## Flujo

1. Después de un cambio que deba publicarse, corre `pnpm changeset` y sigue el wizard: elige qué paquetes cambiaron y el tipo de bump (patch/minor/major, [SemVer](https://semver.org/)). Esto crea un archivo `.md` en `.changeset/` — commitéalo junto con tu cambio.
2. Al mergear a `main`, el workflow `release.yml` abre (o actualiza) un PR "Version Packages" que consume todos los changesets pendientes, bumpea versiones y genera `CHANGELOG.md` por paquete.
3. Al mergear ese PR, el mismo workflow publica a npm automáticamente — requiere que el secret `NPM_TOKEN` esté configurado en el repo (Settings → Secrets → Actions), con un token de un usuario/organización npm que tenga permiso de publicar bajo el scope `@kontrolia`.

No corras `npm publish` / `pnpm changeset publish` a mano salvo que sepas lo que haces — el flujo normal es 100% a través del PR de versión.
