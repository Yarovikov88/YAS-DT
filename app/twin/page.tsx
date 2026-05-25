'use client';
import { useState } from 'react';

export default function YasTwinInput() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState({ loading: false, message: '', error: false });

  const sendToTwin = async () => {
    if (!text.trim()) return;
    setStatus({ loading: true, message: 'Проводка через Шлюз Шумоподавления...', error: false });

    try {
      const res = await fetch('/api/twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus({ loading: false, message: `✅ ${data.message}`, error: false });
        setText('');
      } else {
        setStatus({ loading: false, message: `❌ ${data.message || data.error}`, error: true });
      }
    } catch (e) {
      setStatus({ loading: false, message: '💥 Системный сбой конвейера данных', error: true });
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#000', minHeight: '100vh' }}>
      <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>DT YAS // INPUT_INTERFACE v3.0</h2>
      <p style={{ color: '#888', fontSize: '12px' }}>Слой: Облачной валидации. Назначение: Запись в PostgreSQL.</p>
      <textarea
        style={{ width: '100%', height: '180px', backgroundColor: '#111', color: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #333', fontSize: '14px', fontFamily: 'monospace', marginTop: '20px' }}
        placeholder="Транслируй поток мыслей или новый факт..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={status.loading}
      />
      <button
        style={{ width: '100%', padding: '14px', marginTop: '15px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
        onClick={sendToTwin}
        disabled={status.loading}
      >
        {status.loading ? 'АНАЛИЗ И СЕГМЕНТАЦИЯ ИИ...' : 'ОЦИФРОВАТЬ И ВШИТЬ В БЭК'}
      </button>
      {status.message && (
        <div style={{ marginTop: '20px', padding: '12px', borderRadius: '6px', border: '1px solid #333', backgroundColor: status.error ? '#2a1111' : '#112a11', color: status.error ? '#ff8888' : '#88ff88', fontSize: '13px' }}>
          {status.message}
        </div>
      )}
    </div>
  );
}
