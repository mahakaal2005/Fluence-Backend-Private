import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { createUser, findUserByEmail } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import { getPool } from '../db/pool.js';
import bcrypt from 'bcrypt';

const approveSchema = z.object({
  adminNotes: z.string().optional()
});

const createAdminUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional()
});

export async function createAdminUser(req, res, next) {
  try {
    const { name, email, password, phone } = createAdminUserSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'User with this email already exists');
    }

    // Hash the password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const adminUser = await createUser({
      name,
      email,
      password_hash,
      auth_provider: 'password',
      phone: phone || null,
      role: 'admin'
    });

    // Generate JWT token
    const token = signToken({ sub: adminUser.id, email: adminUser.email });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        status: adminUser.status
      },
      token
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid input data', err.flatten()));
    }
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 10, role, status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, name, email, role, status, created_at FROM users WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(role);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), offset);

    const result = await getPool().query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;

    if (role) {
      countParamCount++;
      countQuery += ` AND role = $${countParamCount}`;
      countParams.push(role);
    }

    if (status) {
      countParamCount++;
      countQuery += ` AND status = $${countParamCount}`;
      countParams.push(status);
    }

    const countResult = await getPool().query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'merchant', 'moderator'].includes(role)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid role');
    }

    const result = await getPool().query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, status',
      [role, userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      user: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

export async function approveMerchantApplication(req, res, next) {
  try {
    const { applicationId } = req.params;
    const { adminNotes } = approveSchema.parse(req.body || {});

    const merchantServiceUrl = process.env.MERCHANT_SERVICE_URL || 'http://localhost:4003';
    const url = `${merchantServiceUrl}/api/admin/applications/${applicationId}/review`;

    const authHeader = req.headers['authorization'] || '';

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        status: 'approved',
        adminNotes: adminNotes || 'Approved By Admin',
        reviewedBy: req.user?.id
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(response.status, `Merchant service error: ${errorBody}`);
    }

    const data = await response.json();
    res.status(StatusCodes.OK).json({ success: true, message: 'Application approved', data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Invalid input data', err.flatten()));
    }
    next(err);
  }
}

