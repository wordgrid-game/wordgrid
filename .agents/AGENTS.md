# Agent Instructions & Workspace Rules

## Build Commands

- **DO NOT run `npm run build:full`**. The `build:full` script executes `scripts/gen_version.sh` to generate release version metadata and is intended for **production builds ONLY**.
- For standard verification, testing, and building in development, always use `npm run build`.
