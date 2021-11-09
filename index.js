const AWS = require('aws-sdk')
const Pino = require('pino')
const RegistryResolver = require('@flossbank/registry-resolver')
const Process = require('./lib/process')
const Config = require('./lib/config')
const Db = require('./lib/mongo')
const GitHub = require('./lib/github')
const S3 = require('./lib/s3')
const SQS = require('./lib/sqs')

const kms = new AWS.KMS({ region: 'us-west-2' })
const awsSqs = new AWS.SQS({ region: 'us-west-2' })
const awsS3 = new AWS.S3({ region: 'us-west-2' })

/*
- Pulls the organization from Mongo (or falls back to Flossbanks as default)
- Generate github access token with the organization installation ID (or Flossbanks)
- Searches for manifests and resolves all top level deps using @flossbank/registry-resolver
- Writes the TLP's to S3
- Sends off event with the correlationId to dod-registry-resolver
*/
exports.handler = async (event) => {
  const log = Pino()
  const config = new Config({ log, kms })
  const s3 = new S3({ log, config, s3: awsS3 })
  const sqs = new SQS({ config, sqs: awsSqs })

  const retriever = new GitHub({ log, config })
  await retriever.init()

  const db = new Db({ log, config })
  await db.connect()

  // no epsilon needed because we are only using the resolver to get search patterns
  const resolver = new RegistryResolver({ log, epsilon: 0 })

  let results
  try {
    results = await Promise.all(
      event.Records.map(record => Process.process({ record, db, sqs, resolver, retriever, s3, log, config }))
    )
    if (!results.every(result => result.success)) {
      throw new Error(JSON.stringify(results))
    }
    return results
  } finally {
    await db.close()
  }
}
