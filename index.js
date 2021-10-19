const AWS = require('aws-sdk')
const Pino = require('pino')
const RegistryResolver = require('@flossbank/registry-resolver')
const Process = require('./lib/process')
const Config = require('./lib/config')
const Db = require('./lib/mongo')
const Dynamo = require('./lib/dynamo')
const GitHub = require('./lib/github')

const kms = new AWS.KMS({ region: 'us-west-2' })
const docs = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })

/*
- Pulls the organization from Mongo (or falls back to Flossbanks as default)
- Generate github access token with the organization installation ID (or Flossbanks)
- Searches for manifests and resolves all top level deps using @flossbank/registry-resolver 
- Writes the TLP's to S3
- Sends off event with the correlationId to dod-registry-resolver
*/
exports.handler = async (event) => {
  const log = Pino()
  const dynamo = new Dynamo({ log, docs })
  const config = new Config({ log, kms, dynamo })

  const retriever = new GitHub({ log, config })
  await retriever.init()

  const db = new Db({ log, config })
  await db.connect()

  const epsilon = await config.getCompensationEpsilon()
  const resolver = new RegistryResolver({ log, epsilon })

  let results
  try {
    results = await Promise.all(
      event.Records.map(record => Process.process({ record, db, dynamo, resolver, retriever, log }))
    )
    if (!results.every(result => result.success)) {
      throw new Error(JSON.stringify(results))
    }
    return results
  } finally {
    await db.close()
  }
}
