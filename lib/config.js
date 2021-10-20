class Config {
  constructor ({ kms }) {
    this.kms = kms
  }

  async decrypt (data) {
    return this.kms.decrypt({
      CiphertextBlob: Buffer.from(data, 'base64')
    }).promise().then(decrypted => decrypted.Plaintext.toString())
  }

  async getMongoUri () {
    return this.decrypt(process.env.MONGO_URI)
  }

  async getGithubAppConfig () {
    const ghAppId = await this.decrypt(process.env.GITHUB_APP_ID)
    const ghAppPem = await this.decrypt(process.env.GITHUB_APP_PEM)

    return { id: ghAppId, privateKey: ghAppPem }
  }

  getRegistryResolverInputQueueUrl () {
    return process.env.REGISTRY_RESOLVER_QUEUE_URL
  }

  getFlossbankOrgId () {
    return process.env.FLOSSBANK_ORG_ID
  }
}

module.exports = Config
