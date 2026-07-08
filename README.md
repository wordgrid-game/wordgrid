# WordGrid

[![Netlify Status](https://api.netlify.com/api/v1/badges/ae1f19af-4ebb-4756-82e7-28a3cd5f5dd3/deploy-status)](https://app.netlify.com/projects/wordgridgame/deploys)
![GitHub repo size](https://img.shields.io/github/repo-size/wordgrid-game/wordgrid)
![GitHub Issues](https://img.shields.io/github/issues/wordgrid-game/wordgrid)
![GitHub Pull Requests](https://img.shields.io/github/issues-pr/wordgrid-game/wordgrid)
![GitHub contributors](https://img.shields.io/github/contributors-anon/wordgrid-game/wordgrid)
![GitHub commit activity](https://img.shields.io/github/commit-activity/t/wordgrid-game/wordgrid)

A grid-based puzzle game to test your vocabulary.

## Setting up Local Development

To setup local development, clone the repository and then install the dependencies for both the client and server. Please note that [Bun](https://bun.sh) is used for the server.

> If you are using an editor that does not have built-in support for `.editorconfig` files (e.g. VSCode), please install an extension that provides support for it (e.g. [EditorConfig for VSCode](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)) to follow the style guidelines for this repository.

```bash
git clone https://github.com/wordgrid-game/wordgrid.git
cd wordgrid
npm install
cd server
bun install
cd ..
```

## Core Architecture

The root directory is for the client (our website), with a subdirectory (`server`) for the backend service.

## License

We use a custom source-available license. Please read it over [here](./LICENSE.md).

## Contributing

Please follow the contribution guide [here](./CONTRIBUTING.md).

## Code of Conduct

Please respect our community and maintainers by following the standards set out in our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Follow the [security policy](./SECURITY.md) and use GitHub's built in security vulnerability reporting system if you find any security issues.

## Contributors

<a href="https://github.com/wordgrid-game/wordgrid/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=wordgrid-game/wordgrid" />
</a>

