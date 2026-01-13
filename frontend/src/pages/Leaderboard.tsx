import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { leaderboardAPI } from '../services/api';

interface LeaderboardEntry {
    _id: string;
    name: string;
    totalScore: number;
    gamesPlayed: number;
    picture?: string;
}

const Leaderboard: React.FC = () => {
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const result = await leaderboardAPI.getTopUsers();
                setData(result);
            } catch (err) {
                setError('Failed to load leaderboard');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    return (
        <>
            <Navbar />
            <div className="container">
                <h1 style={{ textAlign: 'center', color: 'var(--primary-color)', margin: '40px 0' }}>Global Leaderboard</h1>

                {loading ? (
                    <div style={{ textAlign: 'center' }}>Loading...</div>
                ) : error ? (
                    <div style={{ textAlign: 'center', color: 'var(--error-color)' }}>{error}</div>
                ) : (
                    <div className="card" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '15px' }}>Rank</th>
                                    <th style={{ padding: '15px' }}>Player</th>
                                    <th style={{ padding: '15px' }}>Games Played</th>
                                    <th style={{ padding: '15px', textAlign: 'right' }}>Total Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((user, index) => (
                                    <tr key={user._id} style={{ borderBottom: '1px solid #333' }}>
                                        <td style={{ padding: '15px', color: index < 3 ? 'var(--secondary-color)' : 'inherit', fontWeight: index < 3 ? 'bold' : 'normal' }}>
                                            #{index + 1}
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'var(--primary-variant)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '14px'
                                                }}>
                                                    {user.picture ? <img src={user.picture} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : user.name.charAt(0)}
                                                </div>
                                                {user.name}
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px' }}>{user.gamesPlayed}</td>
                                        <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                            {user.totalScore.toFixed(1)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {data.length === 0 && (
                            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No records yet.</p>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default Leaderboard;
