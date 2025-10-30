import jwt from 'jsonwebtoken';
import { getConfig } from '../config/index.js';

const { jwt: jwtConfig } = getConfig();

export function signToken(payload) {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, jwtConfig.secret);
}


