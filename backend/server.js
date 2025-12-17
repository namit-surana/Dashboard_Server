import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Get active users based on time period (days)
app.get('/api/active-users', async (req, res) => {
  try {
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;
    const dateFilter = days > 0 ? `>= NOW() - INTERVAL '${days} days'` : `IS NOT NULL`;

    const query = `
      SELECT DISTINCT
        u.user_id,
        u.email,
        u.company_name,
        u.first_name,
        u.last_name,
        GREATEST(
          MAX(cs.created_at),
          MAX(cs.updated_at),
          MAX(cm.timestamp)
        ) as last_activity,
        COUNT(DISTINCT cm.message_id) FILTER (WHERE cm.timestamp ${dateFilter}) as message_count
      FROM users u
      LEFT JOIN chat_sessions cs ON u.user_id = cs.user_id
      LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
      WHERE
        cs.created_at ${dateFilter}
        OR cs.updated_at ${dateFilter}
        OR cm.timestamp ${dateFilter}
      GROUP BY u.user_id, u.email, u.company_name, u.first_name, u.last_name
      ORDER BY last_activity DESC;
    `;

    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active users'
    });
  }
});

// Get dashboard statistics
app.get('/api/stats', async (req, res) => {
  try {
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;
    const dateFilter = days > 0 ? `>= NOW() - INTERVAL '${days} days'` : `IS NOT NULL`;

    // Total users
    const totalUsersQuery = 'SELECT COUNT(*) as total FROM users';
    const totalUsersResult = await pool.query(totalUsersQuery);

    // Active sessions in time period
    const activeSessionsQuery = `
      SELECT COUNT(*) as total
      FROM chat_sessions
      WHERE created_at ${dateFilter}
    `;
    const activeSessionsResult = await pool.query(activeSessionsQuery);

    // Total messages in time period
    const totalMessagesQuery = `
      SELECT COUNT(*) as total
      FROM chat_messages
      WHERE timestamp ${dateFilter}
    `;
    const totalMessagesResult = await pool.query(totalMessagesQuery);

    // Message type counts (text-low and text-minimal only)
    const messageTypeCountsQuery = `
      SELECT type, COUNT(*) as count
      FROM chat_messages
      WHERE timestamp ${dateFilter}
        AND type IN ('text-low', 'text-minimal')
      GROUP BY type
    `;
    const messageTypeCountsResult = await pool.query(messageTypeCountsQuery);

    // Active users count
    const activeUsersQuery = `
      SELECT COUNT(DISTINCT u.user_id) as total
      FROM users u
      LEFT JOIN chat_sessions cs ON u.user_id = cs.user_id
      LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
      WHERE
        cs.created_at ${dateFilter}
        OR cs.updated_at ${dateFilter}
        OR cm.timestamp ${dateFilter}
    `;
    const activeUsersResult = await pool.query(activeUsersQuery);

    // Feedback stats
    const totalFeedbackQuery = `
      SELECT COUNT(*) as total
      FROM chat_feedbacks
      WHERE timestamp ${dateFilter}
    `;
    const totalFeedbackResult = await pool.query(totalFeedbackQuery);

    const positiveFeedbackQuery = `
      SELECT COUNT(*) as total
      FROM chat_feedbacks
      WHERE timestamp ${dateFilter}
        AND is_positive = true
    `;
    const positiveFeedbackResult = await pool.query(positiveFeedbackQuery);

    const negativeFeedbackQuery = `
      SELECT COUNT(*) as total
      FROM chat_feedbacks
      WHERE timestamp ${dateFilter}
        AND is_positive = false
    `;
    const negativeFeedbackResult = await pool.query(negativeFeedbackQuery);

    const totalFeedback = parseInt(totalFeedbackResult.rows[0].total);
    const positiveFeedback = parseInt(positiveFeedbackResult.rows[0].total);
    const negativeFeedback = parseInt(negativeFeedbackResult.rows[0].total);
    const positiveRate = totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : 0;

    // Format message type counts
    const messageTypeCounts = messageTypeCountsResult.rows.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(totalUsersResult.rows[0].total),
        activeUsers: parseInt(activeUsersResult.rows[0].total),
        activeSessions: parseInt(activeSessionsResult.rows[0].total),
        totalMessages: parseInt(totalMessagesResult.rows[0].total),
        messageTypeCounts: messageTypeCounts,
        totalFeedback: totalFeedback,
        positiveFeedback: positiveFeedback,
        negativeFeedback: negativeFeedback,
        positiveRate: positiveRate,
        period: `${days} days`
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// Get active users over time
app.get('/api/active-users-timeline', async (req, res) => {
  try {
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;
    const dateFilter = days > 0 ? `AND occurred_at >= NOW() - INTERVAL '${days} days'` : '';

    // Active users over time for chatbot service
    const chatbotActiveUsersQuery = `
      SELECT
        DATE(occurred_at) as date,
        COUNT(DISTINCT account_id) as active_users
      FROM account_transactions
      WHERE txn_type = 'chatbot'
        AND db_cr_flag = 1
        ${dateFilter}
      GROUP BY DATE(occurred_at)
      ORDER BY date ASC
    `;
    const chatbotActiveUsersResult = await pool.query(chatbotActiveUsersQuery);

    // Active users over time for file generation (service_purchase)
    const fileGenActiveUsersQuery = `
      SELECT
        DATE(occurred_at) as date,
        COUNT(DISTINCT account_id) as active_users
      FROM account_transactions
      WHERE txn_type = 'service_purchase'
        AND db_cr_flag = 1
        ${dateFilter}
      GROUP BY DATE(occurred_at)
      ORDER BY date ASC
    `;
    const fileGenActiveUsersResult = await pool.query(fileGenActiveUsersQuery);

    console.log('🔍 Active Users Timeline - Chatbot:', chatbotActiveUsersResult.rows.length, 'rows');
    console.log('🔍 Active Users Timeline - FileGen:', fileGenActiveUsersResult.rows.length, 'rows');
    console.log('Sample chatbot data:', chatbotActiveUsersResult.rows.slice(0, 3));
    console.log('Sample fileGen data:', fileGenActiveUsersResult.rows.slice(0, 3));

    res.json({
      success: true,
      data: {
        chatbotActiveUsers: chatbotActiveUsersResult.rows,
        fileGenActiveUsers: fileGenActiveUsersResult.rows,
        period: days === 0 ? 'All Time' : `${days} days`
      }
    });
  } catch (error) {
    console.error('Error fetching active users timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active users timeline'
    });
  }
});

// Get feedback list with user details
app.get('/api/feedbacks', async (req, res) => {
  try {
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;
    const type = req.query.type || 'all'; // all, positive, negative
    const dateFilter = days > 0 ? `cf.timestamp >= NOW() - INTERVAL '${days} days'` : '1=1';

    let typeFilter = '';
    if (type === 'positive') {
      typeFilter = 'AND cf.is_positive = true';
    } else if (type === 'negative') {
      typeFilter = 'AND cf.is_positive = false';
    }

    const query = `
      SELECT
        cf.chat_feedback_id,
        cf.is_positive,
        cf.negative_reason,
        cf.timestamp,
        cs.session_id,
        u.user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.company_name
      FROM chat_feedbacks cf
      JOIN chat_messages cm ON cf.message_id = cm.message_id
      JOIN chat_sessions cs ON cm.session_id = cs.session_id
      JOIN users u ON cs.user_id = u.user_id
      WHERE ${dateFilter}
        ${typeFilter}
      ORDER BY cf.timestamp DESC
    `;

    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedbacks'
    });
  }
});

// Get compliance artifacts from queue
app.get('/api/compliance-queue', async (req, res) => {
  try {
    const query = `
      SELECT
        compliance_id,
        compliance_name_origin,
        compliance_name_translated,
        url,
        status,
        created_at
      FROM queued_compliance_artifacts
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching compliance queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance queue'
    });
  }
});

// Approve compliance artifact
app.post('/api/compliance-queue/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE queued_compliance_artifacts
      SET status = 'approved'
      WHERE compliance_id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compliance artifact not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error approving compliance artifact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve compliance artifact'
    });
  }
});

// Disapprove compliance artifact (deletes the record)
app.post('/api/compliance-queue/:id/disapprove', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      DELETE FROM queued_compliance_artifacts
      WHERE compliance_id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compliance artifact not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error disapproving compliance artifact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disapprove compliance artifact'
    });
  }
});

// Revert compliance artifact to pending
app.post('/api/compliance-queue/:id/revert', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE queued_compliance_artifacts
      SET status = 'pending'
      WHERE compliance_id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compliance artifact not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error reverting compliance artifact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revert compliance artifact'
    });
  }
});

// Update URL for compliance artifact
app.post('/api/compliance-queue/:id/update-url', async (req, res) => {
  try {
    const { id } = req.params;
    const { url } = req.body;

    const query = `
      UPDATE queued_compliance_artifacts
      SET url = $1
      WHERE compliance_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [url, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compliance artifact not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update URL'
    });
  }
});

// Update compliance name (translated) for compliance artifact
app.post('/api/compliance-queue/:id/update-name', async (req, res) => {
  try {
    const { id } = req.params;
    const { compliance_name_translated } = req.body;

    const query = `
      UPDATE queued_compliance_artifacts
      SET compliance_name_translated = $1
      WHERE compliance_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [compliance_name_translated, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Compliance artifact not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating compliance name:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update compliance name'
    });
  }
});

// Initiate webscrap pipeline
app.post('/api/initiate-webscrap', async (req, res) => {
  try {
    // Get all approved compliance artifacts
    const query = `
      SELECT
        compliance_id,
        compliance_name_origin,
        compliance_name_translated,
        url
      FROM queued_compliance_artifacts
      WHERE status = 'approved'
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No approved items to process',
        count: 0
      });
    }

    console.log(`Webscrap pipeline initiated with ${result.rows.length} approved items`);

    // Call the scrape API for each approved item
    const scrapeResults = [];
    const errors = [];

    for (const item of result.rows) {
      try {
        // Set status to 'in_progress' before starting
        await pool.query(
          `UPDATE queued_compliance_artifacts SET status = 'in_progress' WHERE compliance_id = $1`,
          [item.compliance_id]
        );

        const payload = {
          certification_name: item.compliance_name_translated || item.compliance_name_origin,
          domain: item.url ? [item.url] : null,
          limit: 10,
          save_to_kb: true
        };

        console.log(`Scraping compliance artifact: ${payload.certification_name}`);

        const response = await fetch('https://agent.mangrovesai.com/scrape_compliance_artifact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
          // Delete the item after successful webscraping
          await pool.query(
            `DELETE FROM queued_compliance_artifacts WHERE compliance_id = $1`,
            [item.compliance_id]
          );

          scrapeResults.push({
            compliance_id: item.compliance_id,
            name: payload.certification_name,
            status: 'success',
            data: data
          });
          console.log(`✓ Successfully scraped and removed: ${payload.certification_name}`);
        } else {
          // Revert status back to 'approved' if scraping failed
          await pool.query(
            `UPDATE queued_compliance_artifacts SET status = 'approved' WHERE compliance_id = $1`,
            [item.compliance_id]
          );
          errors.push({
            compliance_id: item.compliance_id,
            name: payload.certification_name,
            error: data.error || 'Unknown error'
          });
          console.error(`✗ Failed to scrape: ${payload.certification_name}`, data);
        }
      } catch (err) {
        // Revert status back to 'approved' if an exception occurred
        await pool.query(
          `UPDATE queued_compliance_artifacts SET status = 'approved' WHERE compliance_id = $1`,
          [item.compliance_id]
        );
        errors.push({
          compliance_id: item.compliance_id,
          name: item.compliance_name_translated || item.compliance_name_origin,
          error: err.message
        });
        console.error(`✗ Error scraping ${item.compliance_name_translated || item.compliance_name_origin}:`, err);
      }
    }

    res.json({
      success: true,
      message: `Webscrap pipeline completed. Processed ${result.rows.length} items: ${scrapeResults.length} successful, ${errors.length} failed`,
      count: result.rows.length,
      successful: scrapeResults.length,
      failed: errors.length,
      results: scrapeResults,
      errors: errors
    });
  } catch (error) {
    console.error('Error initiating webscrap pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate webscrap pipeline'
    });
  }
});

// Get usage timeline for graphs (chatbot and file generation)
app.get('/api/usage-timeline', async (req, res) => {
  try {
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;

    // Generate complete date range with zeros for missing dates
    let chatbotUsageQuery, fileGenUsageQuery;

    if (days === 0) {
      // For "All Time", get the date range from first to last transaction
      chatbotUsageQuery = `
        WITH date_range AS (
          SELECT generate_series(
            (SELECT MIN(DATE(occurred_at)) FROM account_transactions WHERE txn_type = 'chatbot' AND db_cr_flag = 1),
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          dr.date,
          COALESCE(COUNT(at.txn_id), 0) as transaction_count,
          COALESCE(COUNT(DISTINCT at.account_id), 0) as unique_users,
          COALESCE(ROUND(SUM(at.amount) / 100.0, 2), 0.00) as total_usd
        FROM date_range dr
        LEFT JOIN account_transactions at
          ON DATE(at.occurred_at) = dr.date
          AND at.txn_type = 'chatbot'
          AND at.db_cr_flag = 1
        GROUP BY dr.date
        ORDER BY dr.date ASC
      `;

      fileGenUsageQuery = `
        WITH date_range AS (
          SELECT generate_series(
            (SELECT MIN(DATE(occurred_at)) FROM account_transactions WHERE txn_type IN ('file_gen', 'service_purchase') AND db_cr_flag = 1),
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          dr.date,
          COALESCE(COUNT(at.txn_id), 0) as transaction_count,
          COALESCE(COUNT(DISTINCT at.account_id), 0) as unique_users,
          COALESCE(ROUND(SUM(at.amount) / 100.0, 2), 0.00) as total_usd
        FROM date_range dr
        LEFT JOIN account_transactions at
          ON DATE(at.occurred_at) = dr.date
          AND at.txn_type IN ('file_gen', 'service_purchase')
          AND at.db_cr_flag = 1
        GROUP BY dr.date
        ORDER BY dr.date ASC
      `;
    } else {
      // For specific time periods, generate date range from N days ago to today
      chatbotUsageQuery = `
        WITH date_range AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '${days} days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          dr.date,
          COALESCE(COUNT(at.txn_id), 0) as transaction_count,
          COALESCE(COUNT(DISTINCT at.account_id), 0) as unique_users,
          COALESCE(ROUND(SUM(at.amount) / 100.0, 2), 0.00) as total_usd
        FROM date_range dr
        LEFT JOIN account_transactions at
          ON DATE(at.occurred_at) = dr.date
          AND at.txn_type = 'chatbot'
          AND at.db_cr_flag = 1
        GROUP BY dr.date
        ORDER BY dr.date ASC
      `;

      fileGenUsageQuery = `
        WITH date_range AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '${days} days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          dr.date,
          COALESCE(COUNT(at.txn_id), 0) as transaction_count,
          COALESCE(COUNT(DISTINCT at.account_id), 0) as unique_users,
          COALESCE(ROUND(SUM(at.amount) / 100.0, 2), 0.00) as total_usd
        FROM date_range dr
        LEFT JOIN account_transactions at
          ON DATE(at.occurred_at) = dr.date
          AND at.txn_type IN ('file_gen', 'service_purchase')
          AND at.db_cr_flag = 1
        GROUP BY dr.date
        ORDER BY dr.date ASC
      `;
    }

    const chatbotUsageResult = await pool.query(chatbotUsageQuery);
    const fileGenUsageResult = await pool.query(fileGenUsageQuery);

    console.log('📊 Usage Timeline - Chatbot:', chatbotUsageResult.rows.length, 'data points');
    console.log('📊 Usage Timeline - FileGen:', fileGenUsageResult.rows.length, 'data points');

    res.json({
      success: true,
      data: {
        chatbotUsage: chatbotUsageResult.rows,
        fileGenUsage: fileGenUsageResult.rows,
        period: days === 0 ? 'All Time' : `${days} days`
      }
    });
  } catch (error) {
    console.error('Error fetching usage timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage timeline'
    });
  }
});

// Get reasoning mode analytics (text-low vs text-minimal)
app.get('/api/reasoning-mode-analytics', async (req, res) => {
  try {
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;
    const dateFilter = days > 0 ? `AND timestamp >= NOW() - INTERVAL '${days} days'` : '';

    // Overall reasoning mode statistics
    const summaryQuery = `
      SELECT
        SUM(CASE WHEN type = 'text-low' THEN 1 ELSE 0 END) as reasoning_count,
        SUM(CASE WHEN type = 'text-minimal' THEN 1 ELSE 0 END) as non_reasoning_count,
        COUNT(*) as total_messages,
        ROUND(100.0 * SUM(CASE WHEN type = 'text-low' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as reasoning_percentage,
        ROUND(100.0 * SUM(CASE WHEN type = 'text-minimal' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as non_reasoning_percentage
      FROM chat_messages
      WHERE role = 'assistant'
        AND type IN ('text-low', 'text-minimal')
        ${dateFilter}
    `;
    const summaryResult = await pool.query(summaryQuery);

    // Daily timeline with complete date range
    let timelineQuery;
    if (days === 0) {
      timelineQuery = `
        WITH date_range AS (
          SELECT generate_series(
            (SELECT MIN(DATE(timestamp)) FROM chat_messages WHERE type IN ('text-low', 'text-minimal') AND role = 'assistant'),
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          dr.date,
          COALESCE(SUM(CASE WHEN cm.type = 'text-low' THEN 1 ELSE 0 END), 0) as reasoning_count,
          COALESCE(SUM(CASE WHEN cm.type = 'text-minimal' THEN 1 ELSE 0 END), 0) as non_reasoning_count,
          COALESCE(COUNT(cm.message_id), 0) as total_messages,
          CASE
            WHEN COUNT(cm.message_id) > 0 THEN
              ROUND(100.0 * SUM(CASE WHEN cm.type = 'text-low' THEN 1 ELSE 0 END) / COUNT(cm.message_id), 2)
            ELSE 0
          END as reasoning_percentage
        FROM date_range dr
        LEFT JOIN chat_messages cm
          ON DATE(cm.timestamp) = dr.date
          AND cm.role = 'assistant'
          AND cm.type IN ('text-low', 'text-minimal')
        GROUP BY dr.date
        ORDER BY dr.date ASC
      `;
    } else {
      timelineQuery = `
        WITH date_range AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '${days} days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          dr.date,
          COALESCE(SUM(CASE WHEN cm.type = 'text-low' THEN 1 ELSE 0 END), 0) as reasoning_count,
          COALESCE(SUM(CASE WHEN cm.type = 'text-minimal' THEN 1 ELSE 0 END), 0) as non_reasoning_count,
          COALESCE(COUNT(cm.message_id), 0) as total_messages,
          CASE
            WHEN COUNT(cm.message_id) > 0 THEN
              ROUND(100.0 * SUM(CASE WHEN cm.type = 'text-low' THEN 1 ELSE 0 END) / COUNT(cm.message_id), 2)
            ELSE 0
          END as reasoning_percentage
        FROM date_range dr
        LEFT JOIN chat_messages cm
          ON DATE(cm.timestamp) = dr.date
          AND cm.role = 'assistant'
          AND cm.type IN ('text-low', 'text-minimal')
        GROUP BY dr.date
        ORDER BY dr.date ASC
      `;
    }
    const timelineResult = await pool.query(timelineQuery);

    console.log('🧠 Reasoning Mode Analytics - Timeline:', timelineResult.rows.length, 'data points');

    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        timeline: timelineResult.rows,
        period: days === 0 ? 'All Time' : `${days} days`
      }
    });
  } catch (error) {
    console.error('Error fetching reasoning mode analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reasoning mode analytics'
    });
  }
});

// Get service analytics data
app.get('/api/service-analytics', async (req, res) => {
  try {
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;
    // If days is 0, show all time (no date filter)
    const dateFilter = days > 0 ? `AND occurred_at >= NOW() - INTERVAL '${days} days'` : '';

    // Service usage breakdown (deductions only) - Convert credits to USD (1 credit = $0.01)
    const serviceUsageQuery = `
      SELECT
        txn_type,
        COUNT(*) as transaction_count,
        COUNT(DISTINCT account_id) as unique_users,
        ROUND(SUM(amount) / 100.0, 2) as total_usd_spent,
        ROUND(AVG(amount) / 100.0, 2) as avg_usd_per_transaction,
        ROUND(MIN(amount) / 100.0, 2) as min_usd,
        ROUND(MAX(amount) / 100.0, 2) as max_usd
      FROM account_transactions
      WHERE db_cr_flag = 1
        ${dateFilter}
      GROUP BY txn_type
      ORDER BY total_usd_spent DESC
    `;
    const serviceUsageResult = await pool.query(serviceUsageQuery);

    // Individual top-up transactions log
    const topUpQuery = `
      SELECT
        at.occurred_at as date_time,
        u.first_name,
        u.last_name,
        u.company_name,
        ROUND(at.amount / 100.0, 2) as amount_usd,
        at.txn_type
      FROM account_transactions at
      JOIN accounts a ON at.account_id = a.account_id
      JOIN users u ON a.user_id = u.user_id
      WHERE at.db_cr_flag = 2
        ${dateFilter}
      ORDER BY at.occurred_at DESC
    `;
    const topUpResult = await pool.query(topUpQuery);

    // Overall summary - Convert credits to USD (1 credit = $0.01)
    const summaryQuery = `
      SELECT
        ROUND(SUM(CASE WHEN db_cr_flag = 1 THEN amount ELSE 0 END) / 100.0, 2) as total_usd_spent,
        ROUND(SUM(CASE WHEN db_cr_flag = 2 THEN amount ELSE 0 END) / 100.0, 2) as total_usd_topped_up,
        COUNT(DISTINCT CASE WHEN db_cr_flag = 1 THEN account_id END) as users_with_usage,
        COUNT(DISTINCT CASE WHEN db_cr_flag = 2 THEN account_id END) as users_with_topups,
        COUNT(CASE WHEN db_cr_flag = 1 THEN 1 END) as total_usage_transactions,
        COUNT(CASE WHEN db_cr_flag = 2 THEN 1 END) as total_topup_transactions
      FROM account_transactions
      ${days > 0 ? `WHERE occurred_at >= NOW() - INTERVAL '${days} days'` : ''}
    `;
    const summaryResult = await pool.query(summaryQuery);

    // Chatbot specific stats - Convert credits to USD (1 credit = $0.01)
    const chatbotStatsQuery = `
      SELECT
        COUNT(*) as chatbot_transaction_count,
        COUNT(DISTINCT account_id) as chatbot_unique_users,
        ROUND(SUM(amount) / 100.0, 2) as chatbot_total_usd,
        ROUND(AVG(amount) / 100.0, 2) as chatbot_avg_usd,
        ROUND(MIN(amount) / 100.0, 2) as chatbot_min_usd,
        ROUND(MAX(amount) / 100.0, 2) as chatbot_max_usd
      FROM account_transactions
      WHERE txn_type = 'chatbot'
        AND db_cr_flag = 1
        ${dateFilter}
    `;
    const chatbotStatsResult = await pool.query(chatbotStatsQuery);

    // File generation specific stats - Convert credits to USD (1 credit = $0.01)
    const fileGenStatsQuery = `
      SELECT
        COUNT(*) as filegen_transaction_count,
        COUNT(DISTINCT account_id) as filegen_unique_users,
        ROUND(SUM(amount) / 100.0, 2) as filegen_total_usd,
        ROUND(AVG(amount) / 100.0, 2) as filegen_avg_usd
      FROM account_transactions
      WHERE txn_type = 'file_gen'
        AND db_cr_flag = 1
        ${dateFilter}
    `;
    const fileGenStatsResult = await pool.query(fileGenStatsQuery);

    // User balance summary - Convert credits to USD (1 credit = $0.01)
    const userBalanceQuery = `
      SELECT
        a.account_id,
        u.email,
        u.first_name,
        u.last_name,
        u.company_name,
        ROUND(a.balance / 100.0, 2) as balance_usd,
        a.currency,
        a.status,
        COUNT(at.txn_id) as total_transactions,
        ROUND(SUM(CASE WHEN at.db_cr_flag = 1 THEN at.amount ELSE 0 END) / 100.0, 2) as total_usd_spent,
        ROUND(SUM(CASE WHEN at.db_cr_flag = 2 THEN at.amount ELSE 0 END) / 100.0, 2) as total_usd_topped_up,
        MAX(at.occurred_at) as last_transaction
      FROM accounts a
      LEFT JOIN users u ON a.user_id = u.user_id
      LEFT JOIN account_transactions at ON a.account_id = at.account_id
        ${days > 0 ? `AND at.occurred_at >= NOW() - INTERVAL '${days} days'` : ''}
      GROUP BY a.account_id, u.email, u.first_name, u.last_name, u.company_name, a.balance, a.currency, a.status
      ORDER BY a.balance DESC
    `;
    const userBalanceResult = await pool.query(userBalanceQuery);

    console.log('🔍 Chatbot Stats:', chatbotStatsResult.rows[0]);

    res.json({
      success: true,
      data: {
        serviceUsage: serviceUsageResult.rows,
        topUps: topUpResult.rows,
        summary: summaryResult.rows[0],
        chatbotStats: chatbotStatsResult.rows[0],
        fileGenStats: fileGenStatsResult.rows[0],
        userBalances: userBalanceResult.rows,
        period: days === 0 ? 'All Time' : `${days} days`
      }
    });
  } catch (error) {
    console.error('Error fetching service analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service analytics'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Serve React app for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
