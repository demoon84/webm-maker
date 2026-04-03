# Publishing

This package is set up for GitHub-hosted npm publishing through GitHub Actions.

## Current status

Checked on `2026-04-03`:

- `npm view webm-maker` returned `404`, so the package name appears to be available at that time.
- `https://github.com/demoon84/webm-maker` did not exist yet.

These can change, so re-check before publishing.

## 1. Create the GitHub repository

Create a repository named `webm-maker` under the GitHub account that should own the package.

If you use the current metadata in `package.json`, the expected repository is:

```text
https://github.com/demoon84/webm-maker
```

## 2. Push the local repository

If the remote repository exists, push the current local repo:

```bash
git push -u origin main
```

## 3. Prepare npm access

Make sure the npm account that should own `webm-maker` can publish the package.

Local verification:

```bash
npm whoami
npm test
npm pack --dry-run
```

## 4. Configure npm trusted publishing

In the npm package settings, enable trusted publishing for the GitHub repository that will publish this package.

The existing workflow already includes:

- `id-token: write`
- `npm ci`
- `npm test`
- `npm publish`

Workflow file:

- [`publish.yml`](/Users/demoon/Documents/project/webm-maker/.github/workflows/publish.yml)

## 5. Release

After the repository is on GitHub and trusted publishing is configured:

```bash
git tag v1.0.0
git push origin v1.0.0
```

That tag triggers the publish workflow.

## 6. Manual fallback

If GitHub Actions publishing is not configured yet, publish manually:

```bash
npm publish
```
