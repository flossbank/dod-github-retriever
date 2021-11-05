const test = require('ava')
const sinon = require('sinon')
const S3 = require('../lib/s3')

test.beforeEach((t) => {
  t.context.s3 = new S3({
    s3: {
      putObject: sinon.stub().returns({
        promise: sinon.stub()
      })
    },
    log: {}
  })
})

test('putTopLevelPackages', async (t) => {
  const correlationId = 'asdf'
  const extractedDependencies = [
    {
      language: 'javascript',
      registry: 'npm',
      deps: [
        'standard@1.2.3',
        'js-deep-equals@3.2.1'
      ]
    },
    {
      language: 'ruby',
      registry: 'rubygems',
      deps: [
        'json',
        'json-jwt'
      ]
    }
  ]

  await t.context.s3.putTopLevelPackages({ correlationId, extractedDependencies })

  t.deepEqual(t.context.s3.s3.putObject.firstCall.args, [{
    Body: JSON.stringify(extractedDependencies[0].deps),
    Bucket: 'org-donation-state',
    Key: 'asdf/javascript_npm_top_level_packages.json'
  }])
  t.deepEqual(t.context.s3.s3.putObject.secondCall.args, [{
    Body: JSON.stringify(extractedDependencies[1].deps),
    Bucket: 'org-donation-state',
    Key: 'asdf/ruby_rubygems_top_level_packages.json'
  }])
})
