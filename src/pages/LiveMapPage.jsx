import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { adminApi } from '../services/api';

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const customerIcon = L.divIcon({
  html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#9D5AF7);display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 4px 16px rgba(124,58,237,0.6)">👤</div>`,
  className: '', iconSize: [40, 40], iconAnchor: [20, 20],
});
const workerIcon = L.divIcon({
  html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#06B6D4,#0891B2);display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 4px 16px rgba(6,182,212,0.6)">🔧</div>`,
  className: '', iconSize: [40, 40], iconAnchor: [20, 20],
});
const focusedIcon = L.divIcon({
  html: `<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#F59E0B,#EF4444);display:flex;align-items:center;justify-content:center;font-size:22px;border:4px solid white;box-shadow:0 0 0 4px rgba(245,158,11,0.3),0 6px 20px rgba(239,68,68,0.5)">📍</div>`,
  className: '', iconSize: [48, 48], iconAnchor: [24, 24],
});

function MapFlyTo({ pos, zoom = 15 }) {
  const map = useMap();
  const prevPos = useRef(null);
  useEffect(() => {
    if (pos && (prevPos.current?.lat !== pos.lat || prevPos.current?.lng !== pos.lng)) {
      map.flyTo([pos.lat, pos.lng], zoom, { animate: true, duration: 1.5 });
      prevPos.current = pos;
    }
  }, [pos, zoom, map]);
  return null;
}

const HYDERABAD = [17.3850, 78.4867];

// Calculate distance (km) between two coords
function calcKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

function calcETA(km) {
  const minutes = Math.ceil((km / 25) * 60); // ~25 km/h city speed
  if (minutes < 60) return `~${minutes} min`;
  return `~${Math.ceil(minutes / 60)}h ${minutes % 60}m`;
}

export default function LiveMapPage({ socket, focusedBooking, onClearFocus }) {
  const [customers, setCustomers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [flyTo, setFlyTo] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [routes, setRoutes] = useState([]); // [{customer, worker, distance, eta}]

  const loadData = useCallback(async () => {
    try {
      const [wRes, lRes] = await Promise.all([adminApi.getWorkers(), adminApi.getLiveLocations()]);
      setWorkers((wRes.workers || wRes || []).filter(w => w.currentLocation?.lat));
      const liveCusts = (lRes.customers || []).filter(c => c.lat);
      if (liveCusts.length > 0) {
        setCustomers(liveCusts);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadData();
    const poll = setInterval(loadData, 8000);

    if (socket) {
      socket.on('admin_join', () => {});
      socket.emit('admin_join');

      socket.on('user_location', data => {
        setCustomers(prev => {
          const exists = prev.find(c => c.userId === data.userId);
          if (exists) return prev.map(c => c.userId === data.userId ? { ...c, ...data } : c);
          return [...prev, data];
        });
      });

      socket.on('worker_location', data => {
        setWorkers(prev => prev.map(w =>
          String(w._id) === String(data.workerId)
            ? { ...w, currentLocation: { lat: data.lat, lng: data.lng } }
            : w
        ));
      });
    }

    return () => {
      clearInterval(poll);
      socket?.off('user_location');
      socket?.off('worker_location');
    };
  }, [socket, loadData]);

  // When a booking is focused (from confirm), fly to customer
  useEffect(() => {
    if (focusedBooking) {
      const lat = focusedBooking.location?.lat || focusedBooking.userId?.location?.lat;
      const lng = focusedBooking.location?.lng || focusedBooking.userId?.location?.lng;
      if (lat && lng) {
        setFlyTo({ lat, lng });
        setSelectedCustomer({
          name: focusedBooking.userId?.name,
          lat, lng,
          address: focusedBooking.location?.address,
          service: focusedBooking.service,
        });
      }
    }
  }, [focusedBooking]);

  // Build route lines between customers and nearest workers
  useEffect(() => {
    if (customers.length === 0 || workers.length === 0) { setRoutes([]); return; }
    const newRoutes = customers.map(c => {
      const nearest = workers.reduce((best, w) => {
        const d = calcKm(c.lat, c.lng, w.currentLocation.lat, w.currentLocation.lng);
        return (!best || d < best.dist) ? { ...w, dist: parseFloat(d) } : best;
      }, null);
      if (!nearest) return null;
      return {
        customer: c, worker: nearest,
        distance: nearest.dist,
        eta: calcETA(nearest.dist),
        line: [[c.lat, c.lng], [nearest.currentLocation.lat, nearest.currentLocation.lng]],
      };
    }).filter(Boolean);
    setRoutes(newRoutes);
  }, [customers, workers]);

  const visibleCustomers = filter === 'workers' ? [] : customers;
  const visibleWorkers = filter === 'customers' ? [] : workers;

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Live <span className="gradient-text">Tracking Map</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />Real-time GPS tracking • Auto-updates every 8s</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {focusedBooking && (
            <button className="btn btn-secondary btn-sm" onClick={onClearFocus}>✕ Clear Focus</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={loadData}>🔄 Refresh</button>
        </div>
      </div>

      {/* Focused booking banner */}
      {focusedBooking && (
        <div style={{ marginBottom: 16, padding: '12px 18px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.08))', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Tracking: {focusedBooking.userId?.name} — {focusedBooking.service}</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{focusedBooking.location?.address || 'GPS coordinates visible on map'}</div>
          </div>
          <span className="badge badge-active" style={{ marginLeft: 'auto' }}>CONFIRMED</span>
        </div>
      )}

      {/* Stats Strip */}
      <div className="map-stats-strip">
        {[
          { label: 'Live Customers', value: customers.length, icon: '👤', color: '#7C3AED' },
          { label: 'Active Workers', value: workers.length, icon: '🔧', color: '#06B6D4' },
          { label: 'Routes Mapped', value: routes.length, icon: '🛣️', color: '#10B981' },
          { label: 'GPS Quality', value: 'High', icon: '📡', color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="map-stat-card" style={{ flex: 1 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-sub)', fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Legend Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '10px 16px', borderRadius: '12px 12px 0 0', border: '1px solid var(--border)', borderBottom: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'customers', 'workers'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
              {f === 'all' ? '🌍 All' : f === 'customers' ? '👤 Customers' : '🔧 Workers'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-sub)' }}>
          <span>👤 Customer</span>
          <span>🔧 Worker</span>
          <span>🛣️ Route line</span>
          <span style={{ color: 'var(--secondary)' }}><span className="live-dot" /> Live</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: 'calc(100vh - 400px)', minHeight: 450, borderRadius: '0 0 16px 16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={HYDERABAD} zoom={12} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB" />
          {flyTo && <MapFlyTo pos={flyTo} zoom={15} />}

          {/* Route lines */}
          {filter !== 'workers' && routes.map((r, i) => (
            <Polyline key={i}
              positions={r.line}
              pathOptions={{ color: '#F59E0B', weight: 2.5, dashArray: '8,6', opacity: 0.7 }}
            />
          ))}

          {/* Customer Markers */}
          {visibleCustomers.map((c, i) => (
            <Marker key={i} position={[c.lat, c.lng]} icon={focusedBooking?.userId?.name === c.name ? focusedIcon : customerIcon}
              eventHandlers={{ click: () => setSelectedCustomer(c) }}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <b style={{ fontSize: 14 }}>👤 {c.name || 'Customer'}</b>
                  {c.address && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>📍 {c.address}</div>}
                  {c.service && <div style={{ fontSize: 12, color: '#666' }}>🔧 {c.service}</div>}
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{c.lat?.toFixed(5)}, {c.lng?.toFixed(5)}</div>
                </div>
              </Popup>
              <Circle center={[c.lat, c.lng]} radius={250} pathOptions={{ color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.06, weight: 1.5 }} />
            </Marker>
          ))}

          {/* Worker Markers */}
          {visibleWorkers.map((w, i) => {
            const route = routes.find(r => r.worker._id === w._id);
            return (
              <Marker key={i} position={[w.currentLocation.lat, w.currentLocation.lng]} icon={workerIcon}>
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <b style={{ fontSize: 14 }}>🔧 {w.name}</b>
                    <div style={{ fontSize: 12, color: '#666' }}>{w.category || w.skills?.[0] || 'Worker'}</div>
                    <div style={{ fontSize: 12 }}>⭐ {(w.rating || 4.2).toFixed(1)} • {w.isAvailable ? '🟢 Available' : '🟡 Busy'}</div>
                    {route && (
                      <div style={{ marginTop: 6, padding: '6px 8px', background: '#f0f0f0', borderRadius: 6, fontSize: 12 }}>
                        📏 {route.distance} km to customer<br />
                        ⏱ ETA: {route.eta}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{w.currentLocation.lat?.toFixed(5)}, {w.currentLocation.lng?.toFixed(5)}</div>
                  </div>
                </Popup>
                <Circle center={[w.currentLocation.lat, w.currentLocation.lng]} radius={150} pathOptions={{ color: '#06B6D4', fillColor: '#06B6D4', fillOpacity: 0.06, weight: 1.5 }} />
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Route Summary Table */}
      {routes.length > 0 && (
        <div className="table-card" style={{ marginTop: 16 }}>
          <div className="table-header">
            <h3>🛣️ Worker → Customer Routes</h3>
            <span className="badge badge-active">Live ETA</span>
          </div>
          <table>
            <thead><tr><th>Customer</th><th>Location</th><th>Assigned Worker</th><th>Distance</th><th>ETA</th></tr></thead>
            <tbody>
              {routes.map((r, i) => (
                <tr key={i}>
                  <td>{r.customer.name || 'Customer'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-sub)' }}>{r.customer.address || `${r.customer.lat?.toFixed(4)}, ${r.customer.lng?.toFixed(4)}`}</td>
                  <td>{r.worker.name}</td>
                  <td style={{ fontWeight: 700, color: '#F59E0B' }}>{r.distance} km</td>
                  <td style={{ fontWeight: 700, color: '#10B981' }}>{r.eta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {customers.length === 0 && workers.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 16, padding: 20, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>Waiting for live GPS data... Customers will appear when the app sends their location.</div>
        </div>
      )}
    </div>
  );
}
