# Brand presets (maintainers only)

Extra GREEN-API builds of the extension under other names. Same format as a client's `branding/`:

```
brands/<id>/brand.json        { "name": {"en","ru"}, "description": {"en","ru"}, "colors": {"primary","primaryDark"} }
brands/<id>/icons/icon16.png  icon32.png  icon48.png  icon128.png
```

| Preset | Command |
| --- | --- |
| `qr-connector` - QR Connector | `npm run release:qr` |

Any preset: `node scripts/release.mjs --brand <id>` (add `--lang ru`, `--preview-only`). The release goes to
`release/<name>-<version>/` (chrome/, firefox/, ZIPs, preview.html, test/); `branding/` is ignored for these builds.

These presets are **not** offered to clients and are not an example for a white label - see `AGENTS.md`.
To add a preset: create `brands/<id>/` (or build it in `npm run brand-editor` and copy `branding/` here), then add a
`release:<id>` script to `package.json` and a row above.
