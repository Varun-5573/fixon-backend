import React, { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

const DEFAULT_SERVICES = [
  { _id: '1', name: 'Plumbing', icon: '🔧', category: 'Maintenance', price: 499, description: 'Pipe repairs, leak fixing, installation', active: true, bookings: 47, packages: [{name: 'Leaky Tap Repair', price: 499}, {name: 'Full Bathroom Polish', price: 1499}] },
  { _id: '2', name: 'Electrical', icon: '⚡', category: 'Maintenance', price: 599, description: 'Wiring, switch repair, fan installation', active: true, bookings: 38, packages: [{name: 'Single Point Fix', price: 599}, {name: 'Home Safety Check', price: 1999}] },
  { _id: '3', name: 'Deep Cleaning', icon: '🧹', category: 'Cleaning', price: 1299, description: 'Full home deep cleaning service', active: true, bookings: 55, packages: [{name: '1 BHK', price: 1299}, {name: '2 BHK', price: 2199}, {name: 'Villa', price: 4999}] },
  { _id: '4', name: 'AC Repair', icon: '❄️', category: 'Appliances', price: 799, description: 'AC servicing, gas refill, repair', active: true, bookings: 61, packages: [{name: 'Basic Service', price: 799}, {name: 'Gas Refill & Check', price: 2499}] },
  { _id: '5', name: 'Carpentry', icon: '🪚', category: 'Maintenance', price: 699, description: 'Furniture repair & wood work', active: true, bookings: 28, packages: [] },
  { _id: '6', name: 'Painting', icon: '🎨', category: 'Home Improvement', price: 2499, description: 'Interior & exterior painting', active: false, bookings: 23, packages: [] },
  { _id: '7', name: 'Pest Control', icon: '🐛', category: 'Cleaning', price: 999, description: 'Cockroach, rat & insect removal', active: true, bookings: 19, packages: [] },
  { _id: '8', name: 'CCTV Installation', icon: '📹', category: 'Security', price: 3499, description: 'Security camera setup & wiring', active: true, bookings: 14, packages: [] },
];

const ALL_CATEGORIES = [
  'Maintenance', 'Cleaning', 'Appliances', 'Home Improvement', 'Security',
  'Plumbing Services', 'Electrical Repairs', 'AC & Refrigeration (HVAC)', 'Carpentry & Woodwork', 'Interior & Exterior Painting',
  'Pest Control & Disinfection', 'CCTV & Smart Home Automation', 'Roofing & Waterproofing', 'Gardening & Lawn Care', 'Solar Panel Installation',
  'Masonry & Concrete Works', 'Glass & Mirror Fitting', 'Locksmith & Door Repair', 'Furniture Assembly', 'Deep Home Cleaning',
  'Sofa & Carpet Cleaning', 'Kitchen Deep Cleaning', 'Water Tank & Sump Cleaning', 'Bathroom & Tile Scrubbing', 'Laundry & Dry Cleaning',
  'Car Wash & Auto Detailing', 'Bike Repair & Servicing', 'EV Charging Setup', 'Computer & Laptop Repair', 'Smartphone & Tablet Repair',
  'TV & Home Theatre Setup', 'Water Purifier (RO) Service', 'Geyser & Water Heater Repair', 'Washing Machine Repair', 'Refrigerator Service',
  'Microwave & Oven Repair', 'Chimney & Stove Repair', 'Inverter & Battery Service', 'Flooring & Tiling', 'Ceiling & False Ceiling',
  'Welding & Metal Fabrication', 'Aluminium & UPVC Windows', 'Wall Papering & Decor', 'Packers & Movers', 'Goods Transport & Hauling',
  'Event Decor & Management', 'Catering & Private Chef', 'Photography & Videography', 'Makeup & Hair Styling', 'Salon at Home (Women)',
  'Men\'s Grooming at Home', 'Spa & Massage Therapy', 'Fitness Trainer at Home', 'Yoga Instructor', 'Pet Care & Dog Grooming',
  'Veterinary at Home', 'Elderly Care & Nursing', 'Baby Sitting & Child Care', 'Driver on Demand', 'Tailoring & Alterations',
  'Fumigation & Sanitization', 'Commercial Office Cleaning', 'Lift & Elevator Servicing', 'Generator Maintenance', 'Fire Safety Equipment',
  'Borewell & Motor Pump Service', 'Swimming Pool Maintenance', 'Septic Tank & Sewer Cleaning', 'Car Mechanic & Breakdown', 'Battery Jumpstart & Towing',
  'Bicycle Repair', 'Key Duplication & Emergency Lock', 'Sanitaryware Installation', 'Gas Pipeline Fitting', 'Water Leak Detection',
  'Wall Drilling & Mounting', 'Curtain & Blind Rod Fitting', 'Smart Lock Installation', 'Home Theatre Acoustics', 'Network & Wi-Fi Setup',
  'Intercom & EPABX Repair', 'Solar Water Heater Repair', 'Marble Polishing & Restoration', 'Granite Work & Polishing', 'Wood Polishing & Varnishing',
  'Termite Control Treatment', 'Bird & Pigeon Netting', 'Mosquito Mesh Installation', 'Scaffold & Ladder Rental', 'Debris & Rubble Removal',
  'Drain Cleaning & Unclogging', 'Pressure Washing & Jet Clean', 'Disinfection Drive', 'Home Inspection & Audit', 'Thermal & Energy Audit',
  'Structural Retrofitting', 'Interior Design Consultancy', 'Architectural Drafting', 'Vastu Consultation', 'Sound System Repair',
  'Printer & Copier Service', 'Sanitary & Plumbing Fixtures', 'Chimney Repair', 'Modular Kitchen Service', 'Home Automation Setup'
];

const ALL_ICONS = [
  { icon: '🔧', label: 'Wrench / Plumbing' },
  { icon: '⚡', label: 'Electricity / Lightning' },
  { icon: '🧹', label: 'Broom / Cleaning' },
  { icon: '❄️', label: 'AC / Snowflake / Cooling' },
  { icon: '🪚', label: 'Saw / Carpentry' },
  { icon: '🎨', label: 'Paint / Palette' },
  { icon: '🐛', label: 'Pest / Bug' },
  { icon: '📹', label: 'CCTV / Video' },
  { icon: '🏠', label: 'House / Home' },
  { icon: '🛁', label: 'Bathtub / Bathroom' },
  { icon: '🪣', label: 'Bucket / Wash' },
  { icon: '🔌', label: 'Plug / Wire' },
  { icon: '💡', label: 'Bulb / Light' },
  { icon: '🪟', label: 'Window / Glass' },
  { icon: '🚿', label: 'Shower / Water' },
  { icon: '🛋️', label: 'Sofa / Living' },
  { icon: '🚪', label: 'Door / Gate' },
  { icon: '🔑', label: 'Key / Locksmith' },
  { icon: '🔒', label: 'Lock / Security' },
  { icon: '🚘', label: 'Car / Wash' },
  { icon: '🛵', label: 'Bike / Scooter' },
  { icon: '💻', label: 'Laptop / Repair' },
  { icon: '📱', label: 'Mobile / Phone' },
  { icon: '📺', label: 'TV / Screen' },
  { icon: '🪛', label: 'Screwdriver / Tool' },
  { icon: '🔨', label: 'Hammer / Build' },
  { icon: '🧰', label: 'Toolbox / Equipment' },
  { icon: '🔩', label: 'Nut Bolt / Hardware' },
  { icon: '🧯', label: 'Fire Extinguisher' },
  { icon: '🧱', label: 'Brick / Wall / Masonry' },
  { icon: '🪞', label: 'Mirror / Glass' },
  { icon: '🪑', label: 'Chair / Seat' },
  { icon: '📦', label: 'Package / Movers' },
  { icon: '🧴', label: 'Sanitizer / Soap' },
  { icon: '🧺', label: 'Laundry / Basket' },
  { icon: '🪤', label: 'Mouse Trap / Pest' },
  { icon: '🪴', label: 'Potted Plant / Garden' },
  { icon: '🌳', label: 'Tree / Lawn' },
  { icon: '☀️', label: 'Sun / Solar Energy' },
  { icon: '🐕', label: 'Dog / Pet Care' },
  { icon: '👨‍🍳', label: 'Chef / Kitchen' },
  { icon: '📸', label: 'Camera / Photo' },
  { icon: '💆‍♀️', label: 'Spa / Massage' },
  { icon: '✂️', label: 'Scissors / Salon' },
  { icon: '🛞', label: 'Wheel / Tire' },
  { icon: '⛽', label: 'Fuel / Gas' },
  { icon: '💧', label: 'Water Drop / Plumbing' },
  { icon: '🌡️', label: 'Thermometer / HVAC' },
  { icon: '📶', label: 'WiFi / Internet' },
  { icon: '📡', label: 'Dish Antenna' },
  { icon: '🚨', label: 'Alarm Siren' },
  { icon: '📐', label: 'Ruler / Drafting' },
  { icon: '🖌️', label: 'Brush / Painting' },
  { icon: '🗑️', label: 'Trash / Debris' },
  { icon: '⚙️', label: 'Gear / Motor' },
  { icon: '🧪', label: 'Chemical / Disinfection' },
  { icon: '🧤', label: 'Gloves / Protection' },
  { icon: '🥽', label: 'Goggles / Welding' },
  { icon: '🪜', label: 'Ladder / Scaffolding' },
  { icon: '🪡', label: 'Needle / Tailor' },
  { icon: '🧵', label: 'Thread / Stitch' },
  { icon: '🧽', label: 'Sponge / Scrub' },
  { icon: '🧼', label: 'Soap Bar' },
  { icon: '🪥', label: 'Toothbrush / Detailing' },
  { icon: '🔊', label: 'Speaker / Sound' },
  { icon: '🖥️', label: 'Monitor / Computer' },
  { icon: '🖨️', label: 'Printer / Copier' },
  { icon: '🔋', label: 'Battery / Inverter' },
  { icon: '🛗', label: 'Elevator / Lift' },
  { icon: '🚰', label: 'Water Tap' },
  { icon: '🚽', label: 'Toilet / Commode' },
  { icon: '🪠', label: 'Plunger / Drain' },
  { icon: '🚚', label: 'Truck / Cargo' },
  { icon: '🚲', label: 'Bicycle' },
  { icon: '⛺', label: 'Tent / Outdoor' },
  { icon: '🎂', label: 'Cake / Event' },
  { icon: '🎈', label: 'Balloon / Decor' },
  { icon: '💐', label: 'Flowers / Decoration' },
  { icon: '💅', label: 'Nails / Beauty' },
  { icon: '💄', label: 'Makeup / Cosmetics' },
  { icon: '💇‍♂️', label: 'Haircut / Barber' },
  { icon: '🏋️‍♂️', label: 'Gym / Fitness' },
  { icon: '🧘‍♀️', label: 'Yoga / Meditation' },
  { icon: '🩺', label: 'Stethoscope / Medical' },
  { icon: '💊', label: 'Pill / Health' },
  { icon: '🩹', label: 'Bandage / First Aid' }
];

const empty = { name: '', icon: '🔧', category: '', price: '', description: '', active: true, packages: [] };

export default function ServicesPage() {
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Dropdown states with search
  const [showCatDrop, setShowCatDrop] = useState(false);
  const [catSearch, setCatSearch] = useState('');

  const [showIconDrop, setShowIconDrop] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  const catRef = useRef(null);
  const iconRef = useRef(null);

  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminApi.getServices();
      if (r?.services?.length) setServices(r.services);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (catRef.current && !catRef.current.contains(e.target)) setShowCatDrop(false);
      if (iconRef.current && !iconRef.current.contains(e.target)) setShowIconDrop(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openAdd = () => { setForm(empty); setModal('add'); setShowCatDrop(false); setShowIconDrop(false); };
  const openEdit = (s) => { 
    setForm({ 
      category: 'Maintenance', 
      description: '', 
      packages: [],
      ...s 
    }); 
    setModal('edit'); 
    setShowCatDrop(false);
    setShowIconDrop(false);
  };

  const save = async () => {
    if (!form.name || !form.price) return toast.error('Fill all required fields (Name, Price)');
    setSaving(true);
    try {
      if (modal === 'add') {
        const r = await adminApi.addService(form);
        toast.success('Service added! 🎉');
        await load();
      } else {
        const result = await adminApi.updateService(form._id, form);
        if (result?.service) {
          setServices(p => p.map(s => s._id === form._id ? { ...s, ...result.service } : s));
        } else {
          setServices(p => p.map(s => s._id === form._id ? { ...s, ...form } : s));
        }
        toast.success('Service updated! ✅ Price synced to all apps');
      }
      setModal(null);
    } catch (e) {
      toast.error('Failed to save: ' + (e?.message || 'Unknown error'));
    }
    setSaving(false);
  };

  const toggleActive = async (id) => {
    setServices(p => p.map(s => s._id === id ? { ...s, active: !s.active } : s));
    try { await adminApi.updateService(id, {}); } catch {}
    toast.success('Status updated');
  };

  const doDelete = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    setServices(p => p.filter(s => s._id !== id));
    try { await adminApi.deleteService(id); } catch {}
    toast.success('Service deleted');
  };

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase()));

  // Filtered categories
  const filteredCats = ALL_CATEGORIES.filter(c => c.toLowerCase().includes(catSearch.toLowerCase()));

  // Filtered icons
  const filteredIcons = ALL_ICONS.filter(ic => 
    ic.icon.includes(iconSearch) || ic.label.toLowerCase().includes(iconSearch.toLowerCase())
  );

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Service <span className="gradient-text">Management</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />{services.length} services configured</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="search-bar" style={{ width: 220 }}>
            <span className="search-icon">🔍</span>
            <input className="input" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>➕ Add Service</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Services', value: services.length, icon: '🛠️', color: '#7C3AED' },
          { label: 'Active', value: services.filter(s => s.active).length, icon: '✅', color: '#10B981' },
          { label: 'Inactive', value: services.filter(s => !s.active).length, icon: '⏸', color: '#EF4444' },
          { label: 'Total Bookings', value: services.reduce((a, s) => a + (s.bookings || 0), 0), icon: '📦', color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms`, '--glow': `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 28 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Services Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
        {filtered.map((s, i) => (
          <div key={s._id} className="service-card fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="service-icon-wrap">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>{s.category}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className={`badge badge-${s.active ? 'active' : 'inactive'}`}>{s.active ? 'Active' : 'Inactive'}</span>
                {s.packages?.length > 0 && <span className="badge" style={{ background: 'var(--primary-light)', padding: '2px 8px', fontSize: 10 }}>{s.packages.length} Packages</span>}
              </div>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 14, lineHeight: 1.5 }}>{s.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>Starting Price</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}>₹{s.price}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>Bookings</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-light)' }}>{s.bookings}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(s)}>✏️ Edit</button>
                <button className={`btn btn-sm ${s.active ? 'btn-warning' : 'btn-success'}`} style={{ flex: 1 }} onClick={() => toggleActive(s._id)}>
                  {s.active ? '⏸ Disable' : '▶ Enable'}
                </button>
                <button className="btn btn-sm btn-danger btn-icon" onClick={() => doDelete(s._id)}>🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 540, overflow: 'visible' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? '➕ Add New Service' : '✏️ Edit Service'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label>Service Name *</label>
                  <input className="input" placeholder="e.g. Plumbing Repair" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>

                {/* Searchable Category Dropdown */}
                <div className="form-group" ref={catRef} style={{ position: 'relative' }}>
                  <label>Category ({ALL_CATEGORIES.length}+ Available)</label>
                  <button 
                    type="button"
                    className="input" 
                    style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--card)' }}
                    onClick={() => { setShowCatDrop(!showCatDrop); setShowIconDrop(false); }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {form.category || 'Select...'}
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
                  </button>

                  {showCatDrop && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                      background: '#131129', border: '1px solid var(--border)', borderRadius: 12,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 9999, padding: 8,
                      maxHeight: 240, display: 'flex', flexDirection: 'column'
                    }}>
                      <div className="search-bar" style={{ marginBottom: 6, flexShrink: 0 }}>
                        <span className="search-icon">🔍</span>
                        <input 
                          className="input" 
                          placeholder="Search 100+ categories..." 
                          value={catSearch} 
                          onChange={e => setCatSearch(e.target.value)} 
                          autoFocus
                          style={{ padding: '6px 10px 6px 30px', fontSize: 12 }}
                        />
                      </div>
                      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {catSearch.trim() !== '' && !ALL_CATEGORIES.some(c => c.toLowerCase() === catSearch.toLowerCase()) && (
                          <div 
                            style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--primary-light)', background: 'var(--card2)', fontWeight: 600 }}
                            onClick={() => { setForm({ ...form, category: catSearch.trim() }); setShowCatDrop(false); setCatSearch(''); }}
                          >
                            ➕ Use custom: "{catSearch.trim()}"
                          </div>
                        )}
                        {filteredCats.map((cat) => (
                          <div 
                            key={cat} 
                            style={{ 
                              padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, 
                              color: form.category === cat ? '#fff' : 'var(--text-sub)',
                              background: form.category === cat ? 'var(--primary)' : 'transparent',
                              fontWeight: form.category === cat ? 700 : 400
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = form.category === cat ? 'var(--primary)' : 'var(--card2)'}
                            onMouseLeave={e => e.currentTarget.style.background = form.category === cat ? 'var(--primary)' : 'transparent'}
                            onClick={() => { setForm({ ...form, category: cat }); setShowCatDrop(false); setCatSearch(''); }}
                          >
                            {cat}
                          </div>
                        ))}
                        {filteredCats.length === 0 && (
                          <div style={{ padding: 10, fontSize: 12, color: 'var(--text-sub)', textAlign: 'center' }}>No matching categories</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Starting Price ₹ *</label>
                  <input className="input" type="number" placeholder="499" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                </div>

                {/* Searchable Icon Dropdown */}
                <div className="form-group" ref={iconRef} style={{ position: 'relative' }}>
                  <label>Icon ({ALL_ICONS.length}+ Available)</label>
                  <button 
                    type="button"
                    className="input" 
                    style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--card)' }}
                    onClick={() => { setShowIconDrop(!showIconDrop); setShowCatDrop(false); }}
                  >
                    <span style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {form.icon} <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                        {ALL_ICONS.find(i => i.icon === form.icon)?.label || ''}
                      </span>
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
                  </button>

                  {showIconDrop && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                      background: '#131129', border: '1px solid var(--border)', borderRadius: 12,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 9999, padding: 8,
                      maxHeight: 240, display: 'flex', flexDirection: 'column'
                    }}>
                      <div className="search-bar" style={{ marginBottom: 6, flexShrink: 0 }}>
                        <span className="search-icon">🔍</span>
                        <input 
                          className="input" 
                          placeholder="Search icon (e.g. car, paint, lock)..." 
                          value={iconSearch} 
                          onChange={e => setIconSearch(e.target.value)} 
                          autoFocus
                          style={{ padding: '6px 10px 6px 30px', fontSize: 12 }}
                        />
                      </div>
                      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredIcons.map((item) => (
                          <div 
                            key={item.icon + item.label} 
                            style={{ 
                              padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, 
                              display: 'flex', alignItems: 'center', gap: 10,
                              color: form.icon === item.icon ? '#fff' : 'var(--text-sub)',
                              background: form.icon === item.icon ? 'var(--primary)' : 'transparent',
                              fontWeight: form.icon === item.icon ? 700 : 400
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = form.icon === item.icon ? 'var(--primary)' : 'var(--card2)'}
                            onMouseLeave={e => e.currentTarget.style.background = form.icon === item.icon ? 'var(--primary)' : 'transparent'}
                            onClick={() => { setForm({ ...form, icon: item.icon }); setShowIconDrop(false); setIconSearch(''); }}
                          >
                            <span style={{ fontSize: 20 }}>{item.icon}</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                          </div>
                        ))}
                        {filteredIcons.length === 0 && (
                          <div style={{ padding: 10, fontSize: 12, color: 'var(--text-sub)', textAlign: 'center' }}>No matching icons</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea className="input" rows={2} placeholder="Service description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>

              {/* Packages Section */}
              <div style={{ background: 'var(--card2)', padding: 16, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ margin: 0, fontWeight: 800, fontSize: 13, color: 'var(--primary-light)' }}>💼 PRICING PACKAGES</label>
                  <button className="btn btn-sm btn-secondary" onClick={() => {
                    const pkgs = [...(form.packages || [])];
                    pkgs.push({ name: '', price: '' });
                    setForm({ ...form, packages: pkgs });
                  }}>+ Add Package</button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(!form.packages || form.packages.length === 0) && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-sub)', padding: '10px 0' }}>No custom packages added. Basic price will be used.</div>
                  )}
                  {(form.packages || []).map((pkg, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input className="input" style={{ flex: 2 }} placeholder="Package Name (e.g. Basic)" value={pkg.name} onChange={e => {
                        const pkgs = [...form.packages];
                        pkgs[idx].name = e.target.value;
                        setForm({ ...form, packages: pkgs });
                      }} />
                      <input className="input" style={{ flex: 1 }} type="number" placeholder="Price" value={pkg.price} onChange={e => {
                        const pkgs = [...form.packages];
                        pkgs[idx].price = e.target.value;
                        setForm({ ...form, packages: pkgs });
                      }} />
                      <button className="btn btn-sm btn-danger btn-icon" onClick={() => {
                        const pkgs = form.packages.filter((_, i) => i !== idx);
                        setForm({ ...form, packages: pkgs });
                      }}>🗑</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="svc-active" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '⏳ Saving...' : modal === 'add' ? '➕ Add Service' : '✅ Update Service'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
