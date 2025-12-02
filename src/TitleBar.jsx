import React from 'react';

const TitleBar = ({ title = "Data Labeler" }) => {
    return (
        <div className="window-controls" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            backgroundColor: '#2c2c2c',
            borderBottom: '1px solid #555',
            zIndex: 9999,
            WebkitAppRegion: 'drag', // Allow dragging the window
            userSelect: 'none'
        }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>{title}</span>
            <div style={{ display: 'flex', gap: '5px', WebkitAppRegion: 'no-drag' }}>
                <button
                    onClick={() => window.electronAPI.minimize()}
                    title="Minimize"
                    style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                    _
                </button>
                <button
                    onClick={() => window.electronAPI.maximize()}
                    title="Maximize"
                    style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                    ▢
                </button>
                <button
                    onClick={() => window.electronAPI.close()}
                    title="Close"
                    style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
