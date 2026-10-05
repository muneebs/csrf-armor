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
# The registry publishes the version and its bundles asynchronously, and the
# lag is not small: in run 37320860434 @csrf-armor/nextjs only appeared about
# two minutes after `changeset publish` returned. So we poll every pending
# package each round against one shared deadline, rather than giving each
# package its own short budget in turn.

set -euo pipefail

SLSA_PREDICATE='https://slsa.dev/provenance/v1'
TIMEOUT="${PROVENANCE_TIMEOUT:-600}"
DELAY="${PROVENANCE_RETRY_DELAY:-15}"

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

pending=("$@")
deadline=$((SECONDS + TIMEOUT))

while :; do
  waiting=()
  for spec in "${pending[@]}"; do
    if has_slsa_provenance "$spec"; then
      echo "✓ ${spec} has a SLSA provenance attestation"
    else
      waiting+=("$spec")
    fi
  done

  # ${arr[@]+...} keeps an empty array safe under `set -u` on bash < 4.4.
  pending=(${waiting[@]+"${waiting[@]}"})
  [ "${#pending[@]}" -eq 0 ] && break
  [ "$SECONDS" -ge "$deadline" ] && break
  sleep "$DELAY"
done

if [ "${#pending[@]}" -ne 0 ]; then
  for spec in "${pending[@]}"; do
    echo "✗ ${spec} has no SLSA provenance attestation on the npm registry after ${TIMEOUT}s" >&2
  done
  echo "" >&2
  echo "Publishes must be attested. Check that the publishing job sets" >&2
  echo "NPM_CONFIG_PROVENANCE=true and grants 'id-token: write'." >&2
  exit 1
fi
