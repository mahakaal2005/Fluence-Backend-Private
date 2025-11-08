import { StatusCodes } from 'http-status-codes';
import { getPool } from '../config/database.js';
import { ApiError } from '../middleware/error.js';

export class ContentController {
  /**
   * Get help section content
   */
  static async getHelpContent(req, res, next) {
    try {
      const { category, search } = req.query;
      const pool = getPool();
      
      let query = `
        SELECT 
          hc.id,
          hc.title,
          hc.content,
          hc.category,
          hc.tags,
          hc.is_active,
          hc.view_count,
          hc.created_at,
          hc.updated_at,
          hc.created_by,
          u.name as created_by_name
        FROM help_content hc
        LEFT JOIN users u ON hc.created_by = u.id
        WHERE hc.is_active = true
      `;
      
      let params = [];
      let paramCount = 0;
      
      if (category) {
        paramCount++;
        query += ` AND hc.category = $${paramCount}`;
        params.push(category);
      }
      
      if (search) {
        paramCount++;
        query += ` AND (hc.title ILIKE $${paramCount} OR hc.content ILIKE $${paramCount} OR hc.tags ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      query += ' ORDER BY hc.view_count DESC, hc.created_at DESC';
      
      const helpContent = await pool.query(query, params);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: helpContent.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get FAQ content
   */
  static async getFAQContent(req, res, next) {
    try {
      const { category, limit = 50, offset = 0 } = req.query;
      const pool = getPool();
      
      let query = `
        SELECT 
          faq.id,
          faq.question,
          faq.answer,
          faq.category,
          faq.tags,
          faq.is_active,
          faq.view_count,
          faq.created_at,
          faq.updated_at,
          faq.created_by,
          u.name as created_by_name
        FROM faq_content faq
        LEFT JOIN users u ON faq.created_by = u.id
        WHERE faq.is_active = true
      `;
      
      let params = [];
      let paramCount = 0;
      
      if (category) {
        paramCount++;
        query += ` AND faq.category = $${paramCount}`;
        params.push(category);
      }
      
      query += ` ORDER BY faq.view_count DESC, faq.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(parseInt(limit), parseInt(offset));
      
      const faqContent = await pool.query(query, params);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          faqs: faqContent.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: faqContent.rows.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Terms & Conditions
   */
  static async getTermsAndConditions(req, res, next) {
    try {
      const { version } = req.query;
      const pool = getPool();
      
      let query = `
        SELECT 
          tc.id,
          tc.title,
          tc.content,
          tc.version,
          tc.is_active,
          tc.effective_date,
          tc.created_at,
          tc.updated_at,
          tc.created_by,
          u.name as created_by_name
        FROM terms_conditions tc
        LEFT JOIN users u ON tc.created_by = u.id
        WHERE tc.is_active = true
      `;
      
      let params = [];
      
      if (version) {
        query += ` AND tc.version = $1`;
        params.push(version);
      } else {
        query += ` ORDER BY tc.effective_date DESC LIMIT 1`;
      }
      
      const terms = await pool.query(query, params);
      
      if (terms.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Terms & Conditions not found');
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: terms.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Privacy Policy
   */
  static async getPrivacyPolicy(req, res, next) {
    try {
      const { version } = req.query;
      const pool = getPool();
      
      let query = `
        SELECT 
          pp.id,
          pp.title,
          pp.content,
          pp.version,
          pp.is_active,
          pp.effective_date,
          pp.created_at,
          pp.updated_at,
          pp.created_by,
          u.name as created_by_name
        FROM privacy_policy pp
        LEFT JOIN users u ON pp.created_by = u.id
        WHERE pp.is_active = true
      `;
      
      let params = [];
      
      if (version) {
        query += ` AND pp.version = $1`;
        params.push(version);
      } else {
        query += ` ORDER BY pp.effective_date DESC LIMIT 1`;
      }
      
      const privacy = await pool.query(query, params);
      
      if (privacy.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Privacy Policy not found');
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: privacy.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get notification templates (admin only)
   */
  static async getNotificationTemplates(req, res, next) {
    try {
      const { type, isActive } = req.query;
      const pool = getPool();
      
      let query = `
        SELECT 
          nt.id,
          nt.name,
          nt.type,
          nt.subject,
          nt.template,
          nt.variables,
          nt.is_active,
          nt.created_at,
          nt.updated_at,
          nt.created_by,
          u.name as created_by_name
        FROM notification_templates nt
        LEFT JOIN users u ON nt.created_by = u.id
        WHERE 1=1
      `;
      
      let params = [];
      let paramCount = 0;
      
      if (type) {
        paramCount++;
        query += ` AND nt.type = $${paramCount}`;
        params.push(type);
      }
      
      if (isActive !== undefined) {
        paramCount++;
        query += ` AND nt.is_active = $${paramCount}`;
        params.push(isActive === 'true');
      }
      
      query += ' ORDER BY nt.created_at DESC';
      
      const templates = await pool.query(query, params);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: templates.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update help content (admin only)
   */
  static async createHelpContent(req, res, next) {
    try {
      const { title, content, category, tags } = req.body;
      const createdBy = req.user.id;
      const pool = getPool();
      
      const newHelp = await pool.query(
        `INSERT INTO help_content (
          title, content, category, tags, created_by
        ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, content, category, tags, createdBy]
      );
      
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: newHelp.rows[0],
        message: 'Help content created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update FAQ content (admin only)
   */
  static async createFAQContent(req, res, next) {
    try {
      const { question, answer, category, tags } = req.body;
      const createdBy = req.user.id;
      const pool = getPool();
      
      const newFAQ = await pool.query(
        `INSERT INTO faq_content (
          question, answer, category, tags, created_by
        ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [question, answer, category, tags, createdBy]
      );
      
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: newFAQ.rows[0],
        message: 'FAQ content created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update FAQ content (admin only)
   */
  static async updateFAQContent(req, res, next) {
    try {
      const { faqId } = req.params;
      const { question, answer, category, tags } = req.body;
      const pool = getPool();
      
      // Check if FAQ exists
      const existingFAQ = await pool.query(
        'SELECT id FROM faq_content WHERE id = $1',
        [faqId]
      );
      
      if (existingFAQ.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'FAQ not found');
      }
      
      // Build dynamic update query based on provided fields
      const updateFields = [];
      const params = [faqId];
      let paramCount = 1;
      
      if (question !== undefined) {
        paramCount++;
        updateFields.push(`question = $${paramCount}`);
        params.push(question);
      }
      
      if (answer !== undefined) {
        paramCount++;
        updateFields.push(`answer = $${paramCount}`);
        params.push(answer);
      }
      
      if (category !== undefined) {
        paramCount++;
        updateFields.push(`category = $${paramCount}`);
        params.push(category);
      }
      
      if (tags !== undefined) {
        paramCount++;
        updateFields.push(`tags = $${paramCount}`);
        params.push(tags);
      }
      
      // Always update the updated_at timestamp
      updateFields.push('updated_at = NOW()');
      
      if (updateFields.length === 1) {
        // Only updated_at would be updated, no actual changes
        throw new ApiError(StatusCodes.BAD_REQUEST, 'No fields provided for update');
      }
      
      const updateQuery = `
        UPDATE faq_content 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;
      
      const updatedFAQ = await pool.query(updateQuery, params);
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedFAQ.rows[0],
        message: 'FAQ updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete FAQ content (admin only)
   * Uses soft delete by setting is_active to false
   */
  static async deleteFAQContent(req, res, next) {
    try {
      const { faqId } = req.params;
      const pool = getPool();
      
      // Check if FAQ exists
      const existingFAQ = await pool.query(
        'SELECT id, is_active FROM faq_content WHERE id = $1',
        [faqId]
      );
      
      if (existingFAQ.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'FAQ not found');
      }
      
      if (!existingFAQ.rows[0].is_active) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'FAQ is already deleted');
      }
      
      // Soft delete: set is_active to false
      await pool.query(
        `UPDATE faq_content 
         SET is_active = false, updated_at = NOW()
         WHERE id = $1`,
        [faqId]
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'FAQ deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update Terms & Conditions (admin only)
   */
  static async createTermsAndConditions(req, res, next) {
    try {
      const { title, content, version, effectiveDate } = req.body;
      const createdBy = req.user.id;
      const pool = getPool();
      
      // Deactivate previous versions
      await pool.query(
        'UPDATE terms_conditions SET is_active = false WHERE is_active = true'
      );
      
      const newTerms = await pool.query(
        `INSERT INTO terms_conditions (
          title, content, version, effective_date, created_by
        ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, content, version, effectiveDate, createdBy]
      );
      
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: newTerms.rows[0],
        message: 'Terms & Conditions created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update Privacy Policy (admin only)
   */
  static async createPrivacyPolicy(req, res, next) {
    try {
      const { title, content, version, effectiveDate } = req.body;
      const createdBy = req.user.id;
      const pool = getPool();
      
      // Deactivate previous versions
      await pool.query(
        'UPDATE privacy_policy SET is_active = false WHERE is_active = true'
      );
      
      const newPrivacy = await pool.query(
        `INSERT INTO privacy_policy (
          title, content, version, effective_date, created_by
        ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, content, version, effectiveDate, createdBy]
      );
      
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: newPrivacy.rows[0],
        message: 'Privacy Policy created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update notification template (admin only)
   */
  static async updateNotificationTemplate(req, res, next) {
    try {
      const { templateId } = req.params;
      const { name, subject, template, variables, isActive } = req.body;
      const pool = getPool();
      
      const updatedTemplate = await pool.query(
        `UPDATE notification_templates 
         SET name = $2, subject = $3, template = $4, variables = $5, 
             is_active = $6, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [templateId, name, subject, template, variables, isActive]
      );
      
      if (updatedTemplate.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Template not found');
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedTemplate.rows[0],
        message: 'Template updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get content analytics
   */
  static async getContentAnalytics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const pool = getPool();
      
      let dateFilter = '';
      let params = [];
      
      if (startDate && endDate) {
        dateFilter = 'AND created_at BETWEEN $1 AND $2';
        params = [startDate, endDate];
      } else if (startDate) {
        dateFilter = 'AND created_at >= $1';
        params = [startDate];
      } else if (endDate) {
        dateFilter = 'AND created_at <= $1';
        params = [endDate];
      }
      
      const analytics = await pool.query(
        `SELECT 
          'help_content' as content_type,
          COUNT(*) as total_content,
          SUM(view_count) as total_views,
          AVG(view_count) as avg_views_per_content
        FROM help_content 
        WHERE is_active = true ${dateFilter}
        
        UNION ALL
        
        SELECT 
          'faq_content' as content_type,
          COUNT(*) as total_content,
          SUM(view_count) as total_views,
          AVG(view_count) as avg_views_per_content
        FROM faq_content 
        WHERE is_active = true ${dateFilter}
        
        UNION ALL
        
        SELECT 
          'notification_templates' as content_type,
          COUNT(*) as total_content,
          0 as total_views,
          0 as avg_views_per_content
        FROM notification_templates 
        WHERE is_active = true ${dateFilter}`,
        params
      );
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: analytics.rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Increment view count for content
   */
  static async incrementViewCount(req, res, next) {
    try {
      const { contentType, contentId } = req.params;
      const pool = getPool();
      
      let tableName;
      switch (contentType) {
        case 'help':
          tableName = 'help_content';
          break;
        case 'faq':
          tableName = 'faq_content';
          break;
        default:
          throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid content type');
      }
      
      const result = await pool.query(
        `UPDATE ${tableName} 
         SET view_count = view_count + 1 
         WHERE id = $1 RETURNING view_count`,
        [contentId]
      );
      
      if (result.rows.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Content not found');
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: { viewCount: result.rows[0].view_count }
      });
    } catch (error) {
      next(error);
    }
  }
}
