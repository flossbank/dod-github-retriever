const test = require('ava')
const sinon = require('sinon')
const Process = require('../lib/process')

test.beforeEach((t) => {
  const db = {
    getOrg: sinon.stub().resolves({ name: 'an-ordinary-org', installationId: 'install-me', billingInfo: {} })
  }
  const resolver = {
    getSupportedManifestPatterns: sinon.stub().returns([
      { language: 'javascript', registry: 'npm', searchPatterns: ['package.json'] },
      { language: 'ruby', registry: 'rubygems', searchPatterns: ['Gemfile'] }
    ]),
    extractDependenciesFromManifests: sinon.stub().returns([{
      language: 'javascript',
      registry: 'npm',
      deps: ['standard', 'js-deep-equals', 'yttrium-server']
    }])
  }
  const retriever = {
    getAllManifestsForOrg: sinon.stub().returns([{
      language: 'javascript',
      registry: 'npm',
      manifest: JSON.stringify({ dependencies: { standard: '12.0.1' } })
    }, {
      language: 'php',
      registry: 'idk',
      manifest: 'asdf'
    }])
  }
  const sqs = {
    sendRegistryResolverMessage: sinon.stub().resolves()
  }
  const s3 = {
    putTopLevelPackages: sinon.stub().resolves()
  }
  const log = { info: sinon.stub() }
  const config = {
    getFlossbankOrgId: sinon.stub().returns('flossbank!')
  }

  t.context.services = {
    config,
    db,
    sqs,
    s3,
    resolver,
    retriever,
    log
  }
})

test('process | success', async (t) => {
  const { services } = t.context
  const res = await Process.process({
    record: {
      body: JSON.stringify({
        correlationId: 'asdf',
        organizationId: 'fdsa'
      })
    },
    ...services
  })

  t.deepEqual(res, { success: true })
  t.true(services.resolver.getSupportedManifestPatterns.calledOnce)
  t.true(services.retriever.getAllManifestsForOrg.calledOnce)
  t.true(services.resolver.extractDependenciesFromManifests.calledOnce)
  t.true(services.sqs.sendRegistryResolverMessage.calledOnce)

  // confirming that we put TLPs for _all_ supported lang/reg combos, even if we don't have any manifests for those combos
  t.deepEqual(services.s3.putTopLevelPackages.lastCall.args, [{
    correlationId: 'asdf',
    extractedDependencies: [
      { language: 'javascript', registry: 'npm', deps: ['standard', 'js-deep-equals', 'yttrium-server'] },
      { language: 'ruby', registry: 'rubygems', deps: [] }
    ]
  }])
})

test('process | success | no installation id on org', async (t) => {
  const { services } = t.context
  services.db.getOrg.onFirstCall().resolves({ name: 'an-ordinary-org', installationId: null, billingInfo: {} })
  services.db.getOrg.onSecondCall().resolves({ name: 'flossbank', installationId: 'flossbank-install-id', billingInfo: {} })
  const res = await Process.process({
    record: {
      body: JSON.stringify({
        correlationId: 'asdf',
        organizationId: 'fdsa'
      })
    },
    ...services
  })

  t.deepEqual(res, { success: true })
  t.true(services.db.getOrg.calledTwice)
  t.true(services.resolver.getSupportedManifestPatterns.calledOnce)
  t.true(services.retriever.getAllManifestsForOrg.calledOnce)
  t.true(services.resolver.extractDependenciesFromManifests.calledOnce)
  t.true(services.s3.putTopLevelPackages.calledOnce)
  t.true(services.sqs.sendRegistryResolverMessage.calledOnce)
})

test('process | failure, undefined org id', async (t) => {
  await t.throwsAsync(Process.process({
    ...t.context.services,
    record: {
      body: JSON.stringify({
        correlationId: 'asdf'
        // no org id
      })
    }
  }))
})

test('process | failure, some step fails fails', async (t) => {
  const { services } = t.context
  const { db } = services
  db.getOrg.rejects()
  await t.throwsAsync(Process.process({
    record: {
      body: JSON.stringify({
        correlationId: 'asdf',
        organizationId: 'fdsa'
      })
    },
    ...services
  }))
})
