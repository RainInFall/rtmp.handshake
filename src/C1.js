import crypto from 'crypto';
import hmacFP from './HmacFP';
import is from 'is';
import moment from 'moment';
import random_engine from 'random-js';

const random =  random_engine();
const C1_VERSION = 0x80000702;
const RFC2409_PRIME_1024 = Buffer.from(
            "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
            "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
            "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
            "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
            "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381" +
            "FFFFFFFFFFFFFFFF", "hex");

export default class C1 {
  static fromBuffer(buf) {
    const c1 = new C1();
    c1._buf = buf;

    return c1;
  }

  static create() {
    const c1 = new C1();
    c1._buf = crypto.randomBytes(1536);

    return c1;
  }

  getVersion() {
    return C1_VERSION;
  }

  getTime() {
    return this._buf.readUInt32BE(0);
  }

  getDigestOffset() {
    return this._buf.readUInt32BE(8);
  }

  getDigest() {
    const digest_offset = this.getDigestOffset();

    return this._buf.slice(12 + digest_offset, 44 + digest_offset);
  }

  getKeyOffset() {
    return this._buf.readUInt32BE(1532);
  }

  getkey() {
    const key_offset = this.getKeyOffset();

    return this._buf.slice(772 + key_offset, 900 + key_offset);
  }

  getJoinPart() {
    const digest_offset = this.getDigestOffset();

    return Buffer.concat([
      this._buf.slice(0, 12 + digest_offset),
      this._buf.slice(44 + digest_offset)
    ]);
  }

  encode() {
    this._buf.writeUInt32BE(moment.unix(), 0);
    this._buf.writeUInt32BE(C1_VERSION, 4);

    this._dh = crypto.createDiffieHellman(RFC2409_PRIME_1024);

    const key_offset = random.integer(0, 764 - 128 - 4);
    this._buf.writeUInt32BE(key_offset, 1532);
    const key = this._dh.generateKeys();
    key.copy(this._buf, 772 + key_offset);

    const digest_offset = random.integer(0, 764 - 4 - 32);
    this._buf.writeUInt32BE(digest_offset, 8);
    const digest = hmacFP(this.getJoinPart());
    digest.copy(this._buf, 12 + digest_offset);

    return this._buf;
  }

  validate() {
    const digest_offset = this.getDigestOffset();
    if (!is.within(digest_offset, 0, 764 - 4 - 32)) {
      return false;
    }

    const key_offset = this.getKeyOffset();
    if (!is.within(key_offset, 0, 764 - 4 - 32)) {
      return false;
    }

    return true;
  }
}
