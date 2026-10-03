---
"@csrf-armor/core": patch
---

Match `skipContentTypes` against the request's parsed media type instead of searching the whole Content-Type header. A header such as `application/x-www-form-urlencoded; x=text/plain` no longer matches a `text/plain` exemption. Matching ignores case and parameters such as `charset`, but configured values must now be full media types: partial values such as `json` or `text/` no longer match.
