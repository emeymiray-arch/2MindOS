# Local display fonts

Place licensed `.woff2` files here. Until they exist, the app falls back to
**Cinzel** / **Playfair Display** (via `next/font`) for headings and the
system / `-apple-system` stack for UI body.

## Expected filenames

| Font              | File                          | Role              |
|-------------------|-------------------------------|-------------------|
| Uncage Medium     | `Uncage-Medium.woff2`         | Display / brand   |
| Optimus Princeps  | `OptimusPrinceps-Regular.woff2` | Classic serif   |
| Remul Regular     | `Remul-Regular.woff2`         | Display alternate |
| Pompadur Regular  | `Pompadur-Regular.woff2`      | Display alternate |

`@font-face` rules in `src/app/globals.css` already point at these paths.
After dropping the files, hard-refresh the browser — no code changes needed.
The `.font-display` class prefers local faces first, then Cinzel/Playfair.
