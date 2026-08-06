#!/usr/bin/env bash
# changesets bumps package.json; jsr.json needs the same version and JSR won't
# infer it. Runs as part of `version-packages`, so the release PR carries both.
#
# ponytail: only syncs `version`. Cross-package `jsr:` ranges use carets, so
# they self-maintain within a major; a major bump needs a manual bump there.

set -euo pipefail

for config in packages/*/jsr.json; do
  version=$(jq -r .version "$(dirname "$config")/package.json")
  jq --arg v "$version" '.version = $v' "$config" >"$config.tmp"
  mv "$config.tmp" "$config"
  echo "$config → $version"
done
