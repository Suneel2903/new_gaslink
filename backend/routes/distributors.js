import express from 'express';
import db from '../db.js';

const router = express.Router();

// Get all distributors
const getAllDistributors = async (req, res) => {
    try {
        const query = 'SELECT * FROM distributors ORDER BY distributor_name';
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching distributors:', error);
        res.status(500).json({ error: 'Failed to fetch distributors' });
    }
};

// Add a new distributor
const addDistributor = async (req, res) => {
    try {
        const { distributor_name, phone, email, address } = req.body;
        
        const query = `
            INSERT INTO distributors (distributor_name, phone, email, address)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        
        const result = await db.query(query, [distributor_name, phone, email, address]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding distributor:', error);
        res.status(500).json({ error: 'Failed to add distributor' });
    }
};

router.get('/', getAllDistributors);
router.post('/', addDistributor);

export default router; 