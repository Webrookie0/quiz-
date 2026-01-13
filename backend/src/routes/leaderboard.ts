import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Get global leaderboard (top 50)
router.get('/', async (req, res) => {
    try {
        const leaderboard = await User.find({})
            .select('name picture totalScore gamesPlayed')
            .sort({ totalScore: -1 })
            .limit(50);

        res.json(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

export default router;
