---
"@csrf-armor/express": patch
---

Add `repository`, `publishConfig`, `bugs`, and `homepage` metadata to the published manifest.

The `repository` field is required for npm provenance: the registry rejects an attested publish whose `repository.url` does not match the repository the Sigstore provenance statement was minted from. Releases are now published with `--provenance`, so this package needs the field to be publishable at all.
