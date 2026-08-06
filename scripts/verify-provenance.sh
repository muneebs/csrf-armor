#!/usr/bin/env bash
# Assert that every published package carries an npm provenance attestation.
#
# Usage: scripts/verify-provenance.sh <name@version> [<name@version> ...]
#
# The npm registry exposes attestation bundles at
#   https://registry.npmjs.org/-/npm/v1/attestations/<name>@<version>
# A package published with `--provenance` gets two bundles: npm's own publish
# attestation and a SLSA build provenance statement. We require the SLSA one,
# because that is what links the tarball back to this repository and workflow.
#
# The bundle is written asynchronously by the registry, so we poll briefly
# before failing.

set -euo pipefail

SLSA_PREDICATE='https://slsa.dev/provenance/v1'
ATTEMPTS="${PROVENANCE_ATTEMPTS:-6}"
DELAY="${PROVENANCE_RETRY_DELAY:-10}"

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <name@version> [<name@version> ...]" >&2
  exit 2
fi

has_slsa_provenance() {
  local spec="$1" body
  body=$(curl -sSf "https://registry.npmjs.org/-/npm/v1/attestations/${spec}" 2>/dev/null) || return 1
  jq -e --arg p "$SLSA_PREDICATE" \
    'any(.attestations[]?; .predicateType == $p)' <<<"$body" >/dev/null
}

failed=0
for spec in "$@"; do
  found=0
  for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
    if has_slsa_provenance "$spec"; then
      found=1
      break
    fi
    [ "$attempt" -lt "$ATTEMPTS" ] && sleep "$DELAY"
  done

  if [ "$found" -eq 1 ]; then
    echo "✓ ${spec} has a SLSA provenance attestation"
  else
    echo "✗ ${spec} has no SLSA provenance attestation on the npm registry" >&2
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  echo "" >&2
  echo "Publishes must be attested. Check that the publishing job sets" >&2
  echo "NPM_CONFIG_PROVENANCE=true and grants 'id-token: write'." >&2
  exit 1
fi
