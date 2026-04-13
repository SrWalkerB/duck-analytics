import test from 'node:test'
import assert from 'node:assert/strict'
import { getQuestionCollectionDestination } from './navigation.ts'

test('returns the root collection when there is no folder id', () => {
  assert.deepEqual(getQuestionCollectionDestination(undefined), { to: '/collection' })
  assert.deepEqual(getQuestionCollectionDestination(null), { to: '/collection' })
  assert.deepEqual(getQuestionCollectionDestination(''), { to: '/collection' })
})

test('returns the folder collection when a folder id is present', () => {
  assert.deepEqual(getQuestionCollectionDestination('folder-123'), {
    to: '/collection/$folderId',
    params: { folderId: 'folder-123' },
  })
})
