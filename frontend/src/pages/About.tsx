import React from 'react';
import Navbar from '../components/Navbar';

const About: React.FC = () => {
    return (
        <>
            <Navbar />
            <div className="container">
                <div className="card about-card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
                    <h1 style={{ color: 'var(--primary-color)', marginBottom: '20px' }}>About the Owner</h1>
                    <div className="owner-info">
                        <div className="avatar-placeholder" style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--surface-color-hover)',
                            margin: '0 auto 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '40px'
                        }}>
                            SK
                        </div>
                        <h2 style={{ marginBottom: '10px' }}>Sumit Kumar</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Creator of the AI Quiz Platform. Passionate about building intelligent web applications using modern technologies.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default About;
