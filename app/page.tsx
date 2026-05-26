import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem', textAlign: 'center' }}>
        YAS Digital Twin
      </h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#888', textAlign: 'center' }}>
        Семантический граф знаний v2.0
      </p>
      
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link 
          href="/graph" 
          style={{
            padding: '1rem 2rem',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📊 Граф знаний
        </Link>
        
        <Link 
          href="/api/facts" 
          style={{
            padding: '1rem 2rem',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🔌 API
        </Link>
      </div>

      <div style={{ 
        marginTop: '3rem', 
        padding: '2rem',
        background: '#1a1a1a',
        borderRadius: '8px',
        maxWidth: '600px'
      }}>
        <h2 style={{ marginBottom: '1rem' }}>📈 Статистика</h2>
        <ul style={{ listStyle: 'none', lineHeight: '2' }}>
          <li>• Фактов: 163+ узлов графа</li>
          <li>• Секций: 8 (Генезис, Военная академия, ...)</li>
          <li>• Категорий: 7 (Военный, Технология, ...)</li>
          <li>• Типов связей: 10 семантических типов</li>
        </ul>
      </div>

      <div style={{ 
        marginTop: '2rem',
        fontSize: '0.9rem',
        color: '#666',
        textAlign: 'center'
      }}>
        <p>Архитектор: Андрей Яровиков (YAS)</p>
        <p>Версия: 2.0.0</p>
      </div>
    </main>
  )
}
