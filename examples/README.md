# Example profile wiring

The install script uses the **full** files:

- [`cordis.patch.full.yml`](cordis.patch.full.yml) → `$DSH_HOME/profiles/web/cordis.patch.yml`
- [`profile.package.json.full`](profile.package.json.full) → `$DSH_HOME/profiles/web/package.json` (`__DSH_LINK_PREFIX__` → `/home/node/.dsh` by default)

Smaller snippets for manual merges:

- [`cordis.patch.example.yml`](cordis.patch.example.yml) — partial insert list
- [`profile.package.json.example`](profile.package.json.example) — sample link deps

After any manual edit, run `pnpm install` in the profile directory and restart Harness.
