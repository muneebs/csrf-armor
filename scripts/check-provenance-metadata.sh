#!/usr/bin/env bash
# Guard the preconditions npm enforces for provenance-attested publishes.
#
# The registry rejects an attested publish whose package.json `repository.url`
# does not match the repository the provenance statement was minted from. That
# rejection happens mid-release, after earlier packages are already live, so we
# catch it in PR CI instead.

set -euo pipefail

REPO_URL="https://github.com/muneebs/csrf-armor"
failed=0

for manifest in packages/*/package.json; do
  dir=$(dirname "$manifest")
  name=$(jq -r '.name' "$manifest")

  if [ "$(jq -r '.private // false' "$manifest")" = "true" ]; then
    echo "- ${name}: private, skipped"
    continue
  fi

  url=$(jq -r '.repository.url // ""' "$manifest")
  if [ "$url" != "$REPO_URL" ]; then
    echo "✗ ${name}: repository.url is \"${url}\", expected \"${REPO_URL}\"" >&2
    echo "  npm rejects provenance publishes when this does not match." >&2
    failed=1
    continue
  fi

  if [ "$(jq -r '.repository.directory // ""' "$manifest")" != "$dir" ]; then
    echo "✗ ${name}: repository.directory must be \"${dir}\"" >&2
    failed=1
    continue
  fi

  if [ "$(jq -r '.publishConfig.access // ""' "$manifest")" != "public" ]; then
    echo "✗ ${name}: publishConfig.access must be \"public\"" >&2
    failed=1
    continue
  fi

  echo "✓ ${name}: ready for attested publish"
done

exit "$failed"
