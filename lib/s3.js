class S3 {
  constructor ({ s3, log }) {
    this.s3 = s3
    this.log = log
  }

  async putTopLevelPackages ({ correlationId, extractedDependencies }) {
    return Promise.all(extractedDependencies.map(async ({ language, registry, deps }) => {
      const params = {
        Body: JSON.stringify(deps),
        Bucket: 'org-donation-state',
        Key: `${correlationId}/${language}_${registry}_top_level_packages.json`
      }
      return this.s3.putObject(params).promise()
    }))
  }
}

module.exports = S3
