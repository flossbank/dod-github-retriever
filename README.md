# dod-github-retriever

GitHub Retriever picks up message from Queue and pulls the Organization Record from Mongo using `organizationId`. If no `installationId` is present on the org record, GR pulls the org record for Flossbank and uses its installation ID.

* If the orgId is invalid, the lambda throws and the message ends up in the DLQ after 3 retries.
* If Flossbank also doesn't have an installation ID in Mongo, the lambda throws and the message ends up in the DLQ after 3 retries.

GR uses the installation ID to generate a GitHub access token. It uses @flossbank/registry-resolver to get manifest search patterns and uses those to search GitHub for supported package manifest files. Files found are downloaded and their top-level dependencies are extracted into one long list per-language/registry. The resulting top-level dependency lists are written to the S3 bucket.

```
bucket: org_donation_state/
folder: ${correlationId}/
file: ${language}_${registry}_top_level_packages.json

[ // e.g. javascript_npm_top_level_packages.json
  "standard@^13.0.0",
  "js-deep_equals@*"
]
```

GR creates a message in the RR Input Queue with { correlationId }