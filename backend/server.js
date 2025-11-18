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
    const days = parseInt(req.query.days) || 30;

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
        ) as last_activity
      FROM users u
      LEFT JOIN chat_sessions cs ON u.user_id = cs.user_id
      LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
      WHERE
        cs.created_at >= NOW() - INTERVAL '${days} days'
        OR cs.updated_at >= NOW() - INTERVAL '${days} days'
        OR cm.timestamp >= NOW() - INTERVAL '${days} days'
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
    const days = parseInt(req.query.days) || 30;

    // Total users
    const totalUsersQuery = 'SELECT COUNT(*) as total FROM users';
    const totalUsersResult = await pool.query(totalUsersQuery);

    // Active sessions in time period
    const activeSessionsQuery = `
      SELECT COUNT(*) as total
      FROM chat_sessions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;
    const activeSessionsResult = await pool.query(activeSessionsQuery);

    // Total messages in time period
    const totalMessagesQuery = `
      SELECT COUNT(*) as total
      FROM chat_messages
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
    `;
    const totalMessagesResult = await pool.query(totalMessagesQuery);

    // Message type counts (text-low and text-minimal only)
    const messageTypeCountsQuery = `
      SELECT type, COUNT(*) as count
      FROM chat_messages
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
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
        cs.created_at >= NOW() - INTERVAL '${days} days'
        OR cs.updated_at >= NOW() - INTERVAL '${days} days'
        OR cm.timestamp >= NOW() - INTERVAL '${days} days'
    `;
    const activeUsersResult = await pool.query(activeUsersQuery);

    // Feedback stats
    const totalFeedbackQuery = `
      SELECT COUNT(*) as total
      FROM chat_feedbacks
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
    `;
    const totalFeedbackResult = await pool.query(totalFeedbackQuery);

    const positiveFeedbackQuery = `
      SELECT COUNT(*) as total
      FROM chat_feedbacks
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
        AND is_positive = true
    `;
    const positiveFeedbackResult = await pool.query(positiveFeedbackQuery);

    const negativeFeedbackQuery = `
      SELECT COUNT(*) as total
      FROM chat_feedbacks
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
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

// Get feedback list with user details
app.get('/api/feedbacks', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const type = req.query.type || 'all'; // all, positive, negative

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
      WHERE cf.timestamp >= NOW() - INTERVAL '${days} days'
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
