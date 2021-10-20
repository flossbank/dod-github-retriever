const test = require('ava')
const sinon = require('sinon')
const Db = require('../lib/mongo')
const Retriever = require('../lib/github')
const Process = require('../lib/process')
const index = require('../')

test.before(() => {
  sinon.stub(Retriever.prototype, 'init').resolves()
  sinon.stub(Db.prototype, 'connect')
  sinon.stub(Db.prototype, 'close')
  sinon.stub(Process, 'process').resolves({ success: true })
})

test.afterEach(() => {
  Db.prototype.connect.reset()
  Db.prototype.close.reset()
  Process.process.reset()
})

test.after.always(() => {
  sinon.restore()
})

test.serial('processes records and closes db', async (t) => {
  await index.handler({
    Records: [{ body: 'blah' }]
  })
  t.true(Process.process.calledOnce)
  t.true(Db.prototype.close.calledOnce)
})

test.serial('throws on processing errors', async (t) => {
  Process.process.rejects()
  await t.throwsAsync(index.handler({
    Records: [{ body: 'blah' }]
  }))
  t.true(Db.prototype.close.calledOnce)
})

test.serial('throws on processing errors | explicit non success', async (t) => {
  Process.process.resolves({ success: false })
  await t.throwsAsync(index.handler({
    Records: [{ body: 'blah' }]
  }))
  t.true(Db.prototype.close.calledOnce)
})
