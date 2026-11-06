import React, { useState, useEffect } from 'react';
import { 
  Newspaper, 
  ExternalLink, 
  Share2, 
  Play, 
  Clock, 
  CheckCircle2,
  MessageSquare,
  List,
  LayoutGrid
} from 'lucide-react';

export interface NewsItem {
  id: string;
  type: 'news' | 'twitter' | 'youtube';
  title: string;
  publisher: string;
  url: string;
  publishedAt?: string;
  thumbnail?: string;
  tag?: string;
  description?: string;
}

interface SectorNewsRadarProps {
  ticker: string;
  company: string;
  sector?: string;
  industry?: string;
}

export const SectorNewsRadar: React.FC<SectorNewsRadarProps> = ({
  ticker,
  company,
  sector = 'Mercado General',
  industry = 'General'
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'news' | 'twitter' | 'youtube'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function fetchMediaData() {
      const items: NewsItem[] = [];

      try {
        // 1. Obtener noticias de portales gratuitos via proxy /api/news (o fallback en producción GitHub Pages)
        let res = await fetch(`/api/news?q=${ticker}&newsCount=6`).catch(() => null);
        if (!res || !res.ok || !(res.headers.get('content-type') || '').includes('json')) {
          const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=6`;
          res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`).catch(() => null);
        }
        if (res && res.ok) {
          const data = await res.json();
          const rawNews = data?.news || [];

          for (const item of rawNews) {
            const pubTime = item.providerPublishTime 
              ? new Date(item.providerPublishTime * 1000).toLocaleDateString('es-ES', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Reciente';

            const thumb = item.thumbnail?.resolutions?.[0]?.url;

            // Aseguramos enlaces directos de libre acceso (Yahoo Finance)
            items.push({
              id: item.uuid || `news-${Math.random()}`,
              type: 'news',
              title: item.title,
              publisher: item.publisher || 'Yahoo Finance (Portal Abierto)',
              url: item.link || `https://finance.yahoo.com/quote/${ticker}/news/`,
              publishedAt: pubTime,
              thumbnail: thumb,
              tag: 'Portal Gratuito',
              description: `Noticia pública de libre consulta sobre ${ticker} y sus últimos acontecimientos corporativos.`
            });
          }
        }
      } catch (err) {
        console.warn('Error fetching free news:', err);
      }

      // Si por alguna razón la API devolvió menos de 3 noticias, agregar entradas de portales abiertos verificados
      if (items.length < 3) {
        items.push({
          id: `news-fallback-1-${ticker}`,
          type: 'news',
          title: `Cobertura Corporativa y Estados Financieros de ${company} (${ticker})`,
          publisher: 'Yahoo Finance (Acceso Gratuito)',
          url: `https://finance.yahoo.com/quote/${ticker}/`,
          publishedAt: 'Hoy',
          tag: 'Portal Gratuito',
          description: `Consulta cotizaciones en vivo, ratios y noticias abiertas de ${ticker} sin suscripciones de pago.`
        });
        items.push({
          id: `news-fallback-2-${ticker}`,
          type: 'news',
          title: `Monitoreo Noticioso Sectorial: ${sector} e Industria ${industry}`,
          publisher: 'Google News Finanzas (Libre Acceso)',
          url: `https://news.google.com/search?q=${encodeURIComponent(ticker + ' stock ' + sector)}&hl=es-419`,
          publishedAt: 'Actualizado',
          tag: 'Portal Gratuito',
          description: `Feed abierto con agregación de más de 50 medios de comunicación financieros globales sin barreras de pago.`
        });
      }

      // 2. Incorporar Publicaciones y Flujo en Vivo en X (Twitter)
      items.push({
        id: `twitter-1-${ticker}`,
        type: 'twitter',
        title: `Conversaciones en Vivo: Cashtag $${ticker} en X`,
        publisher: 'X (Comunidad Financiera)',
        url: `https://x.com/search?q=%24${ticker}&f=live`,
        publishedAt: 'En Vivo',
        tag: `Cashtag $${ticker}`,
        description: `Flujo continuo de publicaciones en tiempo real de traders, gestores de fondos y analistas debatiendo la acción $${ticker}.`
      });

      items.push({
        id: `twitter-2-${ticker}`,
        type: 'twitter',
        title: `Análisis Sectorial en X: Tendencias en ${sector}`,
        publisher: 'X (Mercados Globales)',
        url: `https://x.com/search?q=%24${ticker}%20${encodeURIComponent(sector)}&f=live`,
        publishedAt: 'En Vivo',
        tag: `Sector ${sector}`,
        description: `Hilos explicativos, gráficos de flujo de capitales e ideas macroeconómicas sobre la industria ${industry}.`
      });

      // 3. Incorporar Análisis en Video en YouTube (Directo y Gratuito)
      items.push({
        id: `youtube-1-${ticker}`,
        type: 'youtube',
        title: `Videoanálisis Técnico y Niveles Clave para ${ticker}`,
        publisher: 'YouTube (Acceso Libre)',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(ticker + ' ' + company + ' analisis tecnico accion')}`,
        publishedAt: 'Reciente',
        tag: 'Video HD',
        description: `Revisiones gráficas en video con retrocesos Fibonacci, medias móviles y proyecciones de soporte para ${ticker}.`
      });

      items.push({
        id: `youtube-2-${ticker}`,
        type: 'youtube',
        title: `Tesis Fundamental & Valoración en Video: ${company}`,
        publisher: 'YouTube (Educación Financiera)',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(ticker + ' ' + company + ' stock valuation review')}`,
        publishedAt: 'Reciente',
        tag: 'Video HD',
        description: `Explicación audiovisual detallada de resultados trimestrales, ventajas competitivas (Moat) y precio objetivo.`
      });

      items.push({
        id: `youtube-3-${ticker}`,
        type: 'youtube',
        title: `Perspectivas del Sector ${sector} para el Ciclo Actual`,
        publisher: 'YouTube (Canales de Inversión)',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(sector + ' sector stocks outlook ' + new Date().getFullYear())}`,
        publishedAt: 'Reciente',
        tag: 'Video HD',
        description: `Informes audiovisuales de los mejores estrategas de mercado sobre el desempeño del sector ${sector}.`
      });

      if (isMounted) {
        setNewsList(items);
        setLoading(false);
      }
    }

    fetchMediaData();
    return () => { isMounted = false; };
  }, [ticker, company, sector, industry]);

  const filteredItems = newsList.filter(item => {
    if (activeTab === 'all') return true;
    return item.type === activeTab;
  });

  const countNews = newsList.filter(i => i.type === 'news').length;
  const countTwitter = newsList.filter(i => i.type === 'twitter').length;
  const countYoutube = newsList.filter(i => i.type === 'youtube').length;

  return (
    <div className="glass-panel" style={{ padding: '26px', marginTop: '28px', marginBottom: '28px' }}>
      
      {/* Cabecera del Módulo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <Newspaper size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Radar Multimedia: Noticias Abiertas, Comunidad en X y Videos
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Monitoreo continuo de fuentes <strong>100% gratuitas (sin paywall)</strong>, publicaciones en X y análisis en YouTube para <strong>{ticker}</strong> y el sector <strong>{sector}</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Pestañas de Filtro */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <button
            className={`btn ${activeTab === 'all' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700 }}
            onClick={() => setActiveTab('all')}
          >
            Todos ({newsList.length})
          </button>
          <button
            className={`btn ${activeTab === 'news' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setActiveTab('news')}
          >
            <Newspaper size={13} />
            Noticias ({countNews})
          </button>
          <button
            className={`btn ${activeTab === 'twitter' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setActiveTab('twitter')}
          >
            <Share2 size={13} />
            En X ({countTwitter})
          </button>
          <button
            className={`btn ${activeTab === 'youtube' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setActiveTab('youtube')}
          >
            <Play size={13} />
            YouTube ({countYoutube})
          </button>
        </div>

        {/* Selector de Vista: Lista vs Cuadrícula */}
        <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button 
            className={`btn ${viewMode === 'list' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 9px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setViewMode('list')}
            title="Vista en Lista Estructurada"
          >
            <List size={13} />
            Lista
          </button>
          <button 
            className={`btn ${viewMode === 'grid' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 9px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setViewMode('grid')}
            title="Vista en Tarjetas"
          >
            <LayoutGrid size={13} />
            Tarjetas
          </button>
        </div>
      </div>

      {/* Renderizado de Noticias: Lista vs Cuadrícula */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Consultando medios gratuitos, publicaciones en X y análisis en video...
        </div>
      ) : viewMode === 'list' ? (
        <div className="table-container" style={{ borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <table className="data-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Tipo</th>
                <th>Titular / Contenido</th>
                <th style={{ width: '180px' }}>Fuente / Portal</th>
                <th style={{ width: '110px' }}>Fecha</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Enlace</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const isTwitter = item.type === 'twitter';
                const isYoutube = item.type === 'youtube';

                return (
                  <tr key={item.id} className="data-row-hover">
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: isTwitter ? 'rgba(56, 189, 248, 0.15)' : isYoutube ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isTwitter ? '#38bdf8' : isYoutube ? '#f87171' : 'var(--accent-green)'
                      }}>
                        {isTwitter ? <Share2 size={11} /> : isYoutube ? <Play size={11} /> : <Newspaper size={11} />}
                        {isTwitter ? 'En X' : isYoutube ? 'YouTube' : 'Noticia'}
                      </span>
                    </td>
                    <td>
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, display: 'block', lineHeight: 1.4 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-cyan)'}
                        onMouseLeave={e => e.currentTarget.style.color = '#fff'}
                      >
                        {item.title}
                      </a>
                      {item.description && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {item.description.slice(0, 110)}...
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {item.publisher}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {item.publishedAt || 'Reciente'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-secondary" 
                        style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        Abrir
                        <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '16px'
        }}>
          {filteredItems.map(item => {
            const isNews = item.type === 'news';
            const isTwitter = item.type === 'twitter';
            const isYoutube = item.type === 'youtube';

            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: isTwitter 
                    ? '1px solid rgba(56, 189, 248, 0.2)' 
                    : isYoutube 
                      ? '1px solid rgba(239, 68, 68, 0.2)' 
                      : '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '16px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                className="media-card-hover"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = isTwitter ? '#38bdf8' : isYoutube ? '#ef4444' : 'var(--accent-green)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = isTwitter 
                    ? 'rgba(56, 189, 248, 0.2)' 
                    : isYoutube 
                      ? 'rgba(239, 68, 68, 0.2)' 
                      : 'var(--border-subtle)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  {/* Fila Superior: Tipo, Badge y Fecha */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isNews && (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: 'var(--accent-green)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid rgba(16, 185, 129, 0.25)'
                        }}>
                          <CheckCircle2 size={11} />
                          Portal Gratuito
                        </span>
                      )}
                      {isTwitter && (
                        <span style={{
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid rgba(56, 189, 248, 0.25)'
                        }}>
                          <MessageSquare size={11} />
                          Comunidad en X
                        </span>
                      )}
                      {isYoutube && (
                        <span style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#f87171',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid rgba(239, 68, 68, 0.25)'
                        }}>
                          <Play size={11} fill="#f87171" />
                          Video Análisis HD
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Clock size={12} />
                      <span>{item.publishedAt}</span>
                    </div>
                  </div>

                  {/* Título */}
                  <h3 style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: '#fff',
                    lineHeight: 1.35,
                    marginBottom: '8px'
                  }}>
                    {item.title}
                  </h3>

                  {/* Descripción o Extracto */}
                  {item.description && (
                    <p style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                      marginBottom: '14px'
                    }}>
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Pie de Tarjeta: Medio / Fuente y Enlace */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '0.78rem'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    {item.publisher}
                  </span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: isTwitter ? '#38bdf8' : isYoutube ? '#f87171' : 'var(--accent-green)',
                    fontWeight: 700
                  }}>
                    {isNews ? 'Leer Gratis' : isTwitter ? 'Ver en X' : 'Ver Video'}
                    <ExternalLink size={12} />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};
