exports.process = async ({ log, record, db, retriever, resolver, config, s3, sqs }) => {
  const {
    correlationId,
    organizationId // the organization ID who is donating
  } = JSON.parse(record.body)

  // If no org id, throw
  if (!organizationId) throw Error('undefined organization id passed in')

  log.info({ organizationId, correlationId })

  const org = await db.getOrg({ organizationId })
  let installationId
  const { name, installationId: _installationId } = org

  // this is an org that hasn't installed our Github App; we will only be scraping their public repos,
  // and we'll authenticate via Flossbank's installation ID
  if (!_installationId) {
    const flossbank = await db.getOrg({ organizationId: config.getFlossbankOrgId() })
    installationId = flossbank.installationId

    // this shouldn't ever happen, so if it does we'll be noisy
    if (!installationId) throw new Error('no installation id found on flossbank org')
  } else {
    installationId = _installationId
  }

  // get manifest search patterns for each supported registry+language
  // e.g. "package.json" is the only manifest search pattern for JavaScript/NPM
  // this call returns a list of [{ registry, language, patterns }, ...]
  const searchPatterns = resolver.getSupportedManifestPatterns()
  log.info('Using %d search pattern(s) to find package manifest files within org', searchPatterns.length)

  // call the code host (e.g. GitHub) to search all the org's repos for each of the search patterns
  // this call returns a list of [{ registry, language, manifest }, ...] -- that is, a separate
  // object for each manifest file found, alongside its registry and language. the manifest is unparsed (raw utf8)
  const packageManifests = await retriever.getAllManifestsForOrg({ name, installationId }, searchPatterns)
  log.info('Downloaded %d package manifests', packageManifests.length)

  // now ask the registry resolver to parse the manifest files according to whichever registry/language they are
  // so, for example, { registry: npm, language: javascript, manifest: <some JSON string> } will be parsed as
  // JSON and the dependencies+devDependencies fields will be extracted as top level dependencies.
  // this call returns a list of [{ registry, language, deps }, ...] for each registry and language -- even if
  // there are many unique manifests passed in for the registry and language. it will group all the deps for
  // the registry/language combination into a single list.
  const extractedDependencies = resolver.extractDependenciesFromManifests(packageManifests)
  log.info('Dependencies extracted for %d different registry/language combinations', extractedDependencies.length)

  log.info('Writing top level package lists to S3')
  await s3.putTopLevelPackages({ correlationId, extractedDependencies })

  log.info('Sending message to registry resolver for package weight map computation')
  await sqs.sendRegistryResolverMessage({ correlationId })

  return { success: true }
}
