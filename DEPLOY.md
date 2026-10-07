# Jason 3D — GitHub Pages deployment

Target repository: `https://github.com/jazblue/jason3d`

Published URL: `https://jazblue.github.io/jason3d/`

## Ready-to-upload package

The complete package is at:

`publish/jason3d-github-pages.zip`

The ZIP has `index.html` at its root, so it is ready for the repository root.

## Why the page may not display

1. `index.html` must be in the repository root, not inside another folder.
2. The Pages URL must include the repository name: `https://jazblue.github.io/jason3d/`.
3. In **Settings → Pages**, choose **Deploy from a branch**, then **main** and **/(root)**.
4. Wait for the Pages build to complete before opening the URL.

A GitHub Actions workflow is also included at `.github/workflows/pages.yml` if you prefer **GitHub Actions** as the Pages source.
