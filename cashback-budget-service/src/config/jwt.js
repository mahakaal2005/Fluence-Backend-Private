import jwt from 'jsonwebtoken';
import { getConfig } from '../config/index.js';

const config = getConfig();

export function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}



