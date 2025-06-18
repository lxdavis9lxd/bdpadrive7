const crypto = require('crypto');
const util = require('util');

const pbkdf2 = util.promisify(crypto.pbkdf2);

class CryptoService {
  constructor() {
    this.iterations = 100000;
    this.keyLength = 64;
    this.saltLength = 16;
    this.digest = 'sha512';
  }

  async generateSalt() {
    return crypto.randomBytes(this.saltLength).toString('hex');
  }

  async deriveKey(password, salt) {
    const derivedKey = await pbkdf2(
      password,
      Buffer.from(salt, 'hex'),
      this.iterations,
      this.keyLength,
      this.digest
    );
    return derivedKey.toString('hex');
  }

  generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

module.exports = new CryptoService();
