import { describe, it, expect } from 'vitest';
import { hashSecret, verifySecret } from './password';

describe('Password & PIN hashing (scrypt)', () => {
  it('hashes and verifies valid secret', () => {
    const hash = hashSecret('Admin@1405');
    expect(hash.startsWith('scrypt:')).toBe(true);
    expect(verifySecret('Admin@1405', hash)).toBe(true);
    expect(verifySecret('WrongPassword', hash)).toBe(false);
  });

  it('returns false on malformed hashes', () => {
    expect(verifySecret('1234', null)).toBe(false);
    expect(verifySecret('1234', 'invalid-hash')).toBe(false);
  });
});
