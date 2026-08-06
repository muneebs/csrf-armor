#!/usr/bin/env bash
# Publish every package that carries a jsr.json, core first.
#
# @csrf-armor/nuxt has no jsr.json on purpose: its runtime imports Nuxt's
# virtual modules (`#app`, `#imports`), which only exist inside a Nuxt build.
#
# Core goes first because the adapters declare `jsr:@csrf-armor/core@^x` in
# their import maps and JSR resolves dependencies at publish time.
#
# Re-running is safe — jsr publish skips versions already on the registry. CI
# authenticates over OIDC, so the job needs `id-token: write` and each package
# must be linked to this repo in its jsr.io settings.

set -euo pipefail

dirs=""
for dir in packages/core packages/*; do
  [ -f "$dir/jsr.json" ] || continue
  case " $dirs " in *" $dir "*) continue ;; esac
  dirs="$dirs $dir"
done

for dir in $dirs; do
  echo "==> publishing $dir to JSR"
  (cd "$dir" && npx --yes jsr publish "$@")
done
