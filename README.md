# GMK67 Configurator

A responsive 3D configurator for the GMK67 mechanical keyboard. Rotate and zoom the board, customise it,
then press **Test** to try your build in a short typing test.

Built with Vite, React, TypeScript, React Three Fiber and three.js.

## Getting started

Requires Node 22.12 or newer (`.nvmrc` pins the version used in CI).

```sh
npm install
npm run dev
```

## Scripts

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the dev server                      |
| `npm run build`     | Typecheck and build for production        |
| `npm run preview`   | Serve the production build                |
| `npm run lint`      | Lint with oxlint                          |
| `npm run typecheck` | Typecheck                                 |
| `npm run format`    | Format with Prettier                      |
| `npm test`          | Run unit and component tests              |
| `npm run e2e`       | Run browser tests (needs `npm run build`) |
| `npm run model`     | Rebuild the 3D models (needs Blender)     |

## Contributing

Work on a feature branch and open a pull request into `main`. CI runs lint, typecheck, tests, build and
browser tests. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
