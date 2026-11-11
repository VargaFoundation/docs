# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
yarn
```

## Local Development

```bash
yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true yarn deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

## Choregos

`docs/choregos/` is imported from `docs/site/` of
[VargaFoundation/choregos](https://github.com/VargaFoundation/choregos), at its latest release tag, by the
*Import the Choregos documentation* workflow (`.github/workflows/import-choregos-docs.yml`): every day,
or by hand with a tag. It opens a pull request; edit the pages in the Choregos repository, not here.

```bash
yarn test                                                  # the import script's tests
yarn import-choregos --source ../choregos --ref v0.26.0    # an import by hand
```
