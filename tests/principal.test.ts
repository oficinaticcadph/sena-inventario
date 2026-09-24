import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrincipal, principalEditError } from '../src/lib/principal';

test('La cuenta principal solo puede editarse a sí misma y no puede cambiar su usuario', () => {
  const owner = { id: 'owner', usuario: 'jucsendoya' };
  assert.ok(principalEditError('other', owner, 'jucsendoya'));
  assert.ok(principalEditError('other', owner, 'nuevo'));
  assert.ok(principalEditError('owner', owner, 'nuevo'));
  assert.equal(principalEditError('owner', owner, 'jucsendoya'), null);
});

test('Ninguna otra cuenta puede asumir el nombre reservado', () => {
  const ordinary = { id: 'other', usuario: 'admin2' };
  assert.ok(principalEditError('other', ordinary, 'jucsendoya'));
  assert.ok(principalEditError('owner', ordinary, 'JUCSENDOYA'));
  assert.equal(principalEditError('owner', ordinary, 'admin3'), null);
  assert.ok(isPrincipal(' JUCSENDOYA '));
  assert.equal(isPrincipal('jucsendoya2'), false);
});
