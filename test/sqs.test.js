const test = require('ava')
const sinon = require('sinon')
const Sqs = require('../lib/sqs')

test.beforeEach((t) => {
  t.context.sqs = new Sqs({
    sqs: {
      sendMessage: sinon.stub().returns({
        promise: sinon.stub()
      })
    },
    config: {
      getRegistryResolverInputQueueUrl: sinon.stub().returns('url goes here')
    }
  })
})

test('sqs | send registry resolver message', async (t) => {
  t.context.sqs.sendRegistryResolverMessage({ correlationId: 'asdf' })
  t.deepEqual(t.context.sqs.sqs.sendMessage.lastCall.args, [{
    QueueUrl: t.context.sqs.config.getRegistryResolverInputQueueUrl(),
    MessageBody: JSON.stringify({ correlationId: 'asdf' })
  }])
})
