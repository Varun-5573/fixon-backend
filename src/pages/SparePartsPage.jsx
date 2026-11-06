import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';

// Valid state machine transitions matching backend SPARE_ORDER_TRANSITIONS
const ALLOWED_TRANSITIONS = {
  'NEW': ['NEW', 'CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['CONFIRMED', 'PACKED', 'CANCELLED'],
  'PACKED': ['PACKED', 'SHIPPED', 'CANCELLED'],
  'SHIPPED': ['SHIPPED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  'OUT_FOR_DELIVERY': ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  'DELIVERED': ['DELIVERED'],
  'CANCELLED': ['CANCELLED']
};

const ALL_STATUS_OPTIONS = [
  { value: 'NEW', label: '🆕 NEW' },
  { value: 'CONFIRMED', label: '✅ CONFIRMED' },
  { value: 'PACKED', label: '📦 PACKED' },
  { value: 'SHIPPED', label: '🚚 SHIPPED' },
  { value: 'OUT_FOR_DELIVERY', label: '🛵 OUT FOR DELIVERY' },
  { value: 'DELIVERED', label: '🎉 DELIVERED' },
  { value: 'CANCELLED', label: '❌ CANCELLED' }
];

export default function SparePartsPage({ socket }) {
  const [activeTab, setActiveTab] = useState('categories');
  const [expandedCatBrands, setExpandedCatBrands] = useState({});
  // { categoryId, categoryName, categoryIcon, brand } — when set, show brand detail view inside Categories tab
  const [selectedBrandView, setSelectedBrandView] = useState(null);

  const [loading, setLoading] = useState(true);
  const [spareParts, setSpareParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Quick Edit Stock / Price state
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickPrice, setQuickPrice] = useState('');
  const [quickStock, setQuickStock] = useState('');

  // New Part Form State
  const [partForm, setPartForm] = useState({
    name: '',
    category: 'AC Parts',
    brand: '',
    partNumber: '',
    quality: 'Original',
    acType: 'All Types',
    acCapacity: '1 Ton, 1.5 Ton, 2 Ton',
    price: '',
    discountPrice: '',
    stock: '10',
    lowStockThreshold: '5',
    compatibleModels: '',
    description: '',
    warranty: '6 Months Replacement Warranty',
    photo: '',
    deliveryCharge: '40',
    supplierId: '',
    supplierName: '',
    supplierContact: '',
    purchasePrice: ''
  });

  // New Category Form State
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('🔧');

  // New Brand Form State
  const [brandForm, setBrandForm] = useState({ categoryId: '', categoryName: '', name: '', logo: '🔧' });

  // New Supplier Form State
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  // Workers list for delivery assignment
  const [workersList, setWorkersList] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false, orderId: null, orderNum: '', targetStatus: '' });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [partsRes, catRes, brandsRes, ordersRes, suppRes, reqRes, anaRes, workersRes] = await Promise.all([
        adminApi.getSpareParts(),
        adminApi.getSparePartCategories(),
        adminApi.getSparePartBrands(),
        adminApi.getSparePartOrders(),
        adminApi.getSparePartSuppliers(),
        adminApi.getSparePartRequests(),
        adminApi.getSparePartsAnalytics(),
        adminApi.getWorkers().catch(() => ({ success: true, workers: [] }))
      ]);

      if (partsRes?.success) setSpareParts(partsRes.spareParts || []);
      if (catRes?.success) setCategories(catRes.categories || []);
      if (brandsRes?.success) setBrands(brandsRes.brands || []);
      if (ordersRes?.success) setOrders(ordersRes.orders || []);
      if (suppRes?.success) setSuppliers(suppRes.suppliers || []);
      if (reqRes?.success) setRequests(reqRes.requests || []);
      if (anaRes?.success) setAnalytics(anaRes.analytics || null);
      if (workersRes?.workers) setWorkersList(workersRes.workers || []);
    } catch (err) {
      console.error('Failed to load Spare Parts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleDeliveryLocation = (data) => {
      if (!data || !data.orderId) return;
      setOrders(prev => prev.map(o => {
        const isMatch = o.orderId === data.orderId ||
                        o._id === data.orderId ||
                        o.lookupId === data.orderId ||
                        (o.orderId && o.orderId.replace('#', '') === data.orderId.replace('#', ''));
        if (isMatch) {
          return {
            ...o,
            workerLatitude: data.latitude,
            workerLongitude: data.longitude,
            lastLocationUpdate: data.timestamp
          };
        }
        return o;
      }));
    };

    socket.on('spare_part_delivery_location', handleDeliveryLocation);
    return () => {
      socket.off('spare_part_delivery_location', handleDeliveryLocation);
    };
  }, [socket]);


  // Real-time new orders from customers
  useEffect(() => {
    if (!socket) return;
    const handleNewOrder = (order) => {
      if (!order || !order._id) return;
      setOrders(prev => {
        const exists = prev.some(o => o._id === order._id || o.orderId === order.orderId);
        if (exists) return prev;
        try { require('react-hot-toast').default.success('New Spare Part Order: ' + order.orderId + ' from ' + order.customerName, { duration: 6000 }); } catch {}
        return [order, ...prev];
      });
    };
    socket.on('spare_part_order', handleNewOrder);
    return () => { socket.off('spare_part_order', handleNewOrder); };
  }, [socket]);

  const initiateStatusChange = (orderId, orderNum, targetStatus) => {
    setConfirmModal({
      show: true,
      orderId,
      orderNum: orderNum || orderId,
      targetStatus
    });
  };

  const handleConfirmStatusChange = async () => {
    if (!confirmModal.orderId || !confirmModal.targetStatus) return;
    const { orderId, targetStatus } = confirmModal;

    try {
      const res = await adminApi.updateSparePartOrderStatus(orderId, targetStatus, `Status changed to ${targetStatus} by Admin`);
      if (res?.success) {
        setConfirmModal({ show: false, orderId: null, orderNum: '', targetStatus: '' });
        loadAllData();
      } else {
        alert('❌ ' + (res?.message || 'Unable to update order status.'));
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Server error';
      alert('❌ ' + errMsg);
    }
  };

  const handleAssignWorker = async (orderId, workerId) => {
    const selectedWorker = workersList.find(w => w._id === workerId || w.workerId === workerId);
    if (!selectedWorker) return;

    try {
      const res = await adminApi.assignSparePartDeliveryWorker(
        orderId,
        selectedWorker._id || selectedWorker.workerId,
        selectedWorker.name,
        selectedWorker.phone || 'N/A'
      );
      if (res?.success) {
        alert(`✅ Assigned ${selectedWorker.name} to order!`);
        loadAllData();
      } else {
        alert(res?.message || 'Failed to assign worker');
      }
    } catch (err) {
      alert('Failed to assign worker');
    }
  };

  const handleSavePart = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...partForm,
        compatibleModels: partForm.compatibleModels
          ? partForm.compatibleModels.split(',').map(s => s.trim()).filter(Boolean)
          : []
      };

      let res;
      if (editingPart) {
        res = await adminApi.updateSparePart(editingPart._id, payload);
      } else {
        res = await adminApi.addSparePart(payload);
      }

      if (res?.success) {
        alert(editingPart ? 'Spare Part updated!' : 'New Spare Part added to store!');
        setShowAddModal(false);
        setEditingPart(null);
        resetPartForm();
        loadAllData();
      } else {
        alert(res?.message || 'Action failed');
      }
    } catch (err) {
      alert('Error saving spare part: ' + (err.message || err));
    }
  };

  const handleQuickSave = async (partId) => {
    try {
      const res = await adminApi.updateSparePart(partId, {
        price: Number(quickPrice),
        stock: Number(quickStock)
      });
      if (res?.success) {
        setQuickEditId(null);
        loadAllData();
      } else {
        alert(res?.message || 'Quick edit failed');
      }
    } catch (err) {
      alert('Error saving quick edit');
    }
  };

  const handleToggleActive = async (part) => {
    try {
      const res = await adminApi.updateSparePart(part._id, { active: !part.active });
      if (res?.success) loadAllData();
    } catch (err) {
      alert('Error updating status');
    }
  };

  const handleOrderStatusUpdate = async (orderId, newStatus) => {
    try {
      const res = await adminApi.updateSparePartOrderStatus(orderId, newStatus, `Updated to ${newStatus} by Admin`);
      if (res?.success) loadAllData();
    } catch (err) {
      alert('Failed to update order status');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!catName) return;
    try {
      const res = await adminApi.addSparePartCategory({ name: catName, icon: catIcon });
      if (res?.success) {
        setCatName('');
        setShowCategoryModal(false);
        loadAllData();
      }
    } catch (err) {
      alert('Error adding category');
    }
  };

  const handleAddBrand = async (e) => {
    e.preventDefault();
    if (!brandForm.name || !brandForm.categoryId) {
      alert('Please select a category and enter a brand name.');
      return;
    }
    try {
      const res = await adminApi.addSparePartBrand(brandForm);
      if (res?.success) {
        setBrandForm({ categoryId: '', categoryName: '', name: '', logo: '🔧' });
        setShowBrandModal(false);
        loadAllData();
      } else {
        alert(res?.message || 'Failed to add brand');
      }
    } catch (err) {
      alert('Error adding brand');
    }
  };

  const handleDeleteBrand = async (brandId, brandName) => {
    if (!window.confirm(`Remove brand "${brandName}"? It won't appear in the customer app.`)) return;
    try {
      const res = await adminApi.deleteSparePartBrand(brandId);
      if (res?.success) loadAllData();
    } catch (err) {
      alert('Error removing brand');
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.name) return;
    try {
      const res = await adminApi.addSparePartSupplier(supplierForm);
      if (res?.success) {
        setSupplierForm({ name: '', phone: '', email: '', address: '', notes: '' });
        setShowSupplierModal(false);
        loadAllData();
      }
    } catch (err) {
      alert('Error adding supplier');
    }
  };

  const handleWorkerRequestAction = async (requestId, status) => {
    try {
      const res = await adminApi.updateSparePartRequest(requestId, { status });
      if (res?.success) loadAllData();
    } catch (err) {
      alert('Error updating worker request');
    }
  };

  const resetPartForm = () => {
    setPartForm({
      name: '',
      category: categories[0]?.name || 'AC Parts',
      brand: '',
      partNumber: '',
      quality: 'Original',
      acType: 'All Types',
      acCapacity: '1 Ton, 1.5 Ton, 2 Ton',
      price: '',
      discountPrice: '',
      stock: '10',
      lowStockThreshold: '5',
      compatibleModels: '',
      description: '',
      warranty: '6 Months Replacement Warranty',
      photo: '',
      deliveryCharge: '40',
      supplierId: '',
      supplierName: '',
      supplierContact: '',
      purchasePrice: ''
    });
  };

  const startEditPart = (part) => {
    setEditingPart(part);
    setPartForm({
      name: part.name || '',
      category: part.category || 'AC Parts',
      brand: part.brand || '',
      partNumber: part.partNumber || '',
      quality: part.quality || 'Original',
      acType: part.acType || 'All Types',
      acCapacity: part.acCapacity || '',
      price: part.price || '',
      discountPrice: part.discountPrice || '',
      stock: part.stock !== undefined ? String(part.stock) : '10',
      lowStockThreshold: part.lowStockThreshold !== undefined ? String(part.lowStockThreshold) : '5',
      compatibleModels: Array.isArray(part.compatibleModels) ? part.compatibleModels.join(', ') : '',
      description: part.description || '',
      warranty: part.warranty || '',
      photo: part.photo || '',
      deliveryCharge: part.deliveryCharge !== undefined ? String(part.deliveryCharge) : '40',
      supplierId: part.supplierId || '',
      supplierName: part.supplierName || '',
      supplierContact: part.supplierContact || '',
      purchasePrice: part.purchasePrice || ''
    });
    setShowAddModal(true);
  };

  // Filtering
  const filteredParts = spareParts.filter(p => {
    const matchesSearch = !searchTerm ||
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.partNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'All' || p.category?.toLowerCase() === categoryFilter.toLowerCase();
    const matchesStatus = statusFilter === 'All' ||
      (statusFilter === 'Active' && p.active !== false) ||
      (statusFilter === 'Disabled' && p.active === false) ||
      (statusFilter === 'LowStock' && p.stock <= (p.lowStockThreshold || 5) && p.stock > 0) ||
      (statusFilter === 'OutOfStock' && p.stock === 0);
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div style={{ padding: '24px', color: '#F1F5F9', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Top Title Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🛒</span> Spare Parts Store Management
          </h1>
          <p style={{ color: '#94A3B8', margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage appliance inventory, prices, stock levels, orders, and field worker part requests.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={loadAllData}
            style={{
              padding: '10px 16px', borderRadius: '10px', background: '#334155', color: '#fff',
              border: 'none', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            🔄 Refresh Data
          </button>
          <button
            onClick={() => { resetPartForm(); setEditingPart(null); setShowAddModal(true); }}
            style={{
              padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C3AED, #6366F1)',
              color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '700', boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)'
            }}
          >
            ➕ Add Spare Part
          </button>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📦</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC' }}>{analytics?.totalParts || spareParts.length}</div>
          <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600' }}>Total Products</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>✅</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10B981' }}>{analytics?.activeParts || spareParts.filter(p => p.active !== false).length}</div>
          <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600' }}>Active in Shop</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚠️</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#F59E0B' }}>{analytics?.lowStock || spareParts.filter(p => p.stock > 0 && p.stock <= (p.lowStockThreshold || 5)).length}</div>
          <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600' }}>Low Stock Items</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>❌</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#EF4444' }}>{analytics?.outOfStock || spareParts.filter(p => p.stock === 0).length}</div>
          <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600' }}>Out of Stock</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>🛍️</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#3B82F6' }}>{analytics?.totalOrders || orders.length}</div>
          <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600' }}>Total Orders</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>💰</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#A855F7' }}>₹{analytics?.revenue || orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)}</div>
          <div style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '600' }}>Store Revenue</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155', marginBottom: '24px', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { id: 'categories', label: '📁 Categories', badge: categories.length },
          { id: 'inventory', label: '🏬 Inventory & Stock Alerts', badge: spareParts.filter(p => p.stock <= (p.lowStockThreshold || 5)).length },
          { id: 'orders', label: '🛒 Customer Orders', badge: orders.filter(o => o.orderStatus === 'NEW').length },
          { id: 'suppliers', label: '🚚 Suppliers (Private)', badge: suppliers.length },
          { id: 'requests', label: '🔧 Field Worker Requests', badge: requests.filter(r => r.status === 'PENDING').length }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setSelectedBrandView(null); }}
            style={{
              padding: '12px 20px',
              background: activeTab === t.id ? '#1E293B' : 'transparent',
              color: activeTab === t.id ? '#38BDF8' : '#94A3B8',
              border: 'none',
              borderBottom: activeTab === t.id ? '3px solid #38BDF8' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{t.label}</span>
            {t.badge > 0 && (
              <span style={{
                background: activeTab === t.id ? '#38BDF8' : '#334155',
                color: activeTab === t.id ? '#0F172A' : '#94A3B8',
                fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '12px'
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: PRODUCTS CATALOG */}
      {activeTab === 'products' && (
        <div>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Search name, brand, model, part #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={inputStyle}
            />

            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Disabled">Disabled Only</option>
              <option value="LowStock">Low Stock Only</option>
              <option value="OutOfStock">Out of Stock Only</option>
            </select>
          </div>

          {/* Product Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredParts.map(part => (
              <div key={part._id} style={{
                background: '#1E293B', borderRadius: '16px', padding: '16px', border: '1px solid #334155',
                display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden'
              }}>
                {/* Active Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                    background: part.quality === 'Original' ? '#065F46' : (part.quality === 'OEM' ? '#1E40AF' : '#374151'),
                    color: '#fff'
                  }}>
                    {part.quality || 'Original'}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: part.active !== false ? '#10B981' : '#EF4444', fontWeight: '700' }}>
                      {part.active !== false ? '● Visible' : '○ Hidden'}
                    </span>
                    <button
                      onClick={() => handleToggleActive(part)}
                      title="Toggle Visibility"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                    >
                      {part.active !== false ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>

                {/* Photo & Details */}
                <div style={{ display: 'flex', gap: '14px', marginBottom: '12px' }}>
                  <img
                    src={part.photo || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60'}
                    alt={part.name}
                    style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', background: '#0F172A' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {part.name}
                    </h3>
                    <div style={{ color: '#38BDF8', fontSize: '13px', fontWeight: '600' }}>{part.category}</div>
                    <div style={{ color: '#94A3B8', fontSize: '12px' }}>Brand: {part.brand || 'Generic'} | Part #{part.partNumber}</div>
                    <div style={{ color: '#94A3B8', fontSize: '12px' }}>Warranty: {part.warranty}</div>
                    {(part.acType || part.acCapacity) && (
                      <div style={{ color: '#A78BFA', fontSize: '11px', marginTop: '2px' }}>
                        {part.acType && `⚡ ${part.acType}`}{part.acType && part.acCapacity && ' · '}{part.acCapacity && `🌡️ ${part.acCapacity}`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Models Compatible */}
                {Array.isArray(part.compatibleModels) && part.compatibleModels.length > 0 && (
                  <div style={{ background: '#0F172A', padding: '8px 12px', borderRadius: '10px', marginBottom: '12px', fontSize: '12px', color: '#CBD5E1' }}>
                    <span style={{ color: '#94A3B8', fontWeight: '700' }}>Fits Models: </span>
                    {part.compatibleModels.join(', ')}
                  </div>
                )}

                {/* Stock & Pricing Bar */}
                <div style={{ background: '#0F172A', padding: '12px', borderRadius: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>SELLING PRICE</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#10B981' }}>
                          ₹{part.discountPrice || part.price}
                        </span>
                        {part.discountPrice && (
                          <span style={{ fontSize: '12px', textDecoration: 'line-through', color: '#64748B' }}>
                            ₹{part.price}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>STOCK LEVEL</div>
                      <div style={{
                        fontSize: '14px', fontWeight: '800',
                        color: part.stock === 0 ? '#EF4444' : (part.stock <= (part.lowStockThreshold || 5) ? '#F59E0B' : '#10B981')
                      }}>
                        {part.stock === 0 ? '❌ Out of Stock' : (part.stock <= (part.lowStockThreshold || 5) ? `⚠️ ${part.stock} left` : `✅ ${part.stock} in stock`)}
                      </div>
                    </div>
                  </div>

                  {/* Purchase Price + Profit */}
                  {part.purchasePrice > 0 && (() => {
                    const sell = part.discountPrice || part.price || 0;
                    const buy = part.purchasePrice || 0;
                    const profit = sell - buy;
                    const margin = buy > 0 ? Math.round((profit / sell) * 100) : 0;
                    return (
                      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px', borderTop: '1px solid #1E293B' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>PURCHASE COST</div>
                          <div style={{ fontSize: '13px', color: '#F59E0B', fontWeight: '700' }}>₹{buy}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>PROFIT</div>
                          <div style={{ fontSize: '13px', color: profit >= 0 ? '#10B981' : '#EF4444', fontWeight: '700' }}>₹{profit} ({margin}%)</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Quick Edit or Action Buttons */}
                {quickEditId === part._id ? (
                  <div style={{ display: 'flex', gap: '8px', background: '#0F172A', padding: '10px', borderRadius: '10px' }}>
                    <input
                      type="number"
                      placeholder="Price"
                      value={quickPrice}
                      onChange={(e) => setQuickPrice(e.target.value)}
                      style={{ ...inputStyle, width: '90px' }}
                    />
                    <input
                      type="number"
                      placeholder="Stock"
                      value={quickStock}
                      onChange={(e) => setQuickStock(e.target.value)}
                      style={{ ...inputStyle, width: '90px' }}
                    />
                    <button onClick={() => handleQuickSave(part._id)} style={btnSaveStyle}>Save</button>
                    <button onClick={() => setQuickEditId(null)} style={btnCancelStyle}>✖</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button
                      onClick={() => { setQuickEditId(part._id); setQuickPrice(part.price); setQuickStock(part.stock); }}
                      style={{ flex: 1, padding: '8px', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                    >
                      ⚡ Quick Edit
                    </button>
                    <button
                      onClick={() => startEditPart(part)}
                      style={{ flex: 1, padding: '8px', background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                    >
                      ✏️ Edit All
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORIES — with inline brand drill-down */}
      {activeTab === 'categories' && (
        <div>
          {/* ── BRAND DETAIL VIEW (shown after clicking a brand) ── */}
          {selectedBrandView ? (() => {
            const { categoryName, categoryIcon, brand } = selectedBrandView;
            const brandParts = spareParts.filter(
              p => p.brand?.toLowerCase() === brand.name.toLowerCase() &&
                   p.category?.toLowerCase() === categoryName.toLowerCase()
            );
            return (
              <div>
                {/* Breadcrumb back bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <button
                    onClick={() => setSelectedBrandView(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 16px', background: '#334155', color: '#fff',
                      border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px'
                    }}
                  >
                    ← Back to Categories
                  </button>
                  <span style={{ color: '#64748B' }}>›</span>
                  <span style={{ color: '#94A3B8', fontSize: '14px' }}>{categoryIcon} {categoryName}</span>
                  <span style={{ color: '#64748B' }}>›</span>
                  <span style={{ color: '#38BDF8', fontWeight: '700', fontSize: '14px' }}>{brand.logo} {brand.name}</span>
                </div>

                {/* Brand header banner */}
                <div style={{
                  background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                  border: '1px solid #334155', borderRadius: '16px',
                  padding: '24px', marginBottom: '24px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '52px', lineHeight: 1 }}>{brand.logo || '🔧'}</div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: '#F8FAFC' }}>{brand.name}</h2>
                      <div style={{ color: '#94A3B8', fontSize: '14px', marginTop: '4px' }}>
                        {categoryIcon} {categoryName} &nbsp;·&nbsp;
                        <span style={{ color: '#38BDF8', fontWeight: '700' }}>{brandParts.length} product{brandParts.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ background: '#0F172A', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#10B981' }}>{brandParts.filter(p => p.active !== false).length}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Active</div>
                    </div>
                    <div style={{ background: '#0F172A', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#F59E0B' }}>{brandParts.filter(p => p.stock > 0 && p.stock <= (p.lowStockThreshold || 5)).length}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Low Stock</div>
                    </div>
                    <div style={{ background: '#0F172A', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#EF4444' }}>{brandParts.filter(p => p.stock === 0).length}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Out of Stock</div>
                    </div>
                    <button
                      onClick={() => {
                        resetPartForm();
                        setPartForm(prev => ({ ...prev, category: categoryName, brand: brand.name }));
                        setEditingPart(null);
                        setShowAddModal(true);
                      }}
                      style={{
                        padding: '12px 18px', background: 'linear-gradient(135deg, #7C3AED, #6366F1)',
                        color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer',
                        fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      ➕ Add {brand.name} Product
                    </button>
                  </div>
                </div>

                {/* Products grid */}
                {brandParts.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '60px 20px',
                    background: '#1E293B', borderRadius: '16px', border: '1px dashed #334155'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                    <div style={{ color: '#94A3B8', fontSize: '16px', fontWeight: '600' }}>No products yet for {brand.name} in {categoryName}</div>
                    <div style={{ color: '#64748B', fontSize: '13px', marginTop: '6px' }}>Click "Add {brand.name} Product" above to add the first one.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {brandParts.map(part => (
                      <div key={part._id} style={{
                        background: '#1E293B', borderRadius: '16px', padding: '16px',
                        border: '1px solid #334155', display: 'flex', flexDirection: 'column'
                      }}>
                        {/* Top row: quality badge + visibility */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700',
                            background: part.quality === 'Original' ? '#065F46' : (part.quality === 'OEM' ? '#1E40AF' : '#374151'),
                            color: '#fff'
                          }}>{part.quality || 'Original'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: part.active !== false ? '#10B981' : '#EF4444', fontWeight: '700' }}>
                              {part.active !== false ? '● Visible' : '○ Hidden'}
                            </span>
                            <button
                              onClick={() => handleToggleActive(part)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px' }}
                            >{part.active !== false ? '👁️' : '🙈'}</button>
                          </div>
                        </div>

                        {/* Photo + details */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                          <img
                            src={part.photo || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60'}
                            alt={part.name}
                            style={{ width: '72px', height: '72px', borderRadius: '10px', objectFit: 'cover', background: '#0F172A' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{part.name}</div>
                            <div style={{ color: '#94A3B8', fontSize: '12px' }}>Part #{part.partNumber || '—'}</div>
                            <div style={{ color: '#94A3B8', fontSize: '12px' }}>Warranty: {part.warranty || '—'}</div>
                            {(part.acType || part.acCapacity) && (
                              <div style={{ color: '#A78BFA', fontSize: '11px', marginTop: '2px' }}>
                                {part.acType && `⚡ ${part.acType}`}{part.acType && part.acCapacity && ' · '}{part.acCapacity && `🌡️ ${part.acCapacity}`}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Price + stock */}
                        <div style={{ background: '#0F172A', padding: '10px 12px', borderRadius: '10px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>PRICE</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                <span style={{ fontSize: '17px', fontWeight: '800', color: '#10B981' }}>₹{part.discountPrice || part.price}</span>
                                {part.discountPrice && <span style={{ fontSize: '11px', textDecoration: 'line-through', color: '#64748B' }}>₹{part.price}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>STOCK</div>
                              <div style={{
                                fontSize: '13px', fontWeight: '800',
                                color: part.stock === 0 ? '#EF4444' : (part.stock <= (part.lowStockThreshold || 5) ? '#F59E0B' : '#10B981')
                              }}>
                                {part.stock === 0 ? '❌ Out of Stock' : (part.stock <= (part.lowStockThreshold || 5) ? `⚠️ ${part.stock} left` : `✅ ${part.stock} in stock`)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Compatible models */}
                        {Array.isArray(part.compatibleModels) && part.compatibleModels.length > 0 && (
                          <div style={{ background: '#0F172A', padding: '7px 10px', borderRadius: '8px', marginBottom: '10px', fontSize: '11px', color: '#CBD5E1' }}>
                            <span style={{ color: '#94A3B8', fontWeight: '700' }}>Fits: </span>{part.compatibleModels.join(', ')}
                          </div>
                        )}

                        {/* Edit button */}
                        <button
                          onClick={() => startEditPart(part)}
                          style={{
                            marginTop: 'auto', width: '100%', padding: '8px',
                            background: '#475569', color: '#fff', border: 'none',
                            borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                          }}
                        >✏️ Edit Product</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })() : (
            /* ── CATEGORIES GRID VIEW (default) ── */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', margin: 0 }}>Appliance Categories</h2>
                <button
                  onClick={() => setShowCategoryModal(true)}
                  style={{ padding: '10px 18px', background: '#38BDF8', color: '#0F172A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' }}
                >
                  ➕ Add Category
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {categories.map(cat => {
                  const catBrands = brands.filter(b => b.categoryName?.toLowerCase() === cat.name.toLowerCase() || b.categoryId === cat.id);
                  const catParts = spareParts.filter(p => p.category?.toLowerCase() === cat.name.toLowerCase());
                  const brandsExpanded = !!expandedCatBrands[cat.id];
                  return (
                    <div key={cat.id} style={{ background: '#1E293B', padding: '20px', borderRadius: '16px', border: '1px solid #334155', position: 'relative' }}>
                      {/* Category Header */}
                      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '8px' }}>{cat.icon || '🔧'}</div>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 8px 0' }}>{cat.name}</h3>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ background: '#0F172A', color: '#38BDF8', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>
                            📦 {catParts.length} parts
                          </span>
                          <span style={{ background: '#0F172A', color: '#A855F7', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>
                            🏷️ {catBrands.length} brands
                          </span>
                        </div>
                      </div>

                      {/* Choose Brand Toggle */}
                      <button
                        onClick={() => setExpandedCatBrands(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                        style={{
                          width: '100%', padding: '8px 12px', marginBottom: brandsExpanded ? '10px' : '12px',
                          background: '#0F172A',
                          color: brandsExpanded ? '#38BDF8' : '#94A3B8',
                          border: `1px solid ${brandsExpanded ? '#38BDF8' : '#334155'}`,
                          borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>🏷️ Choose Brand</span>
                        <span style={{ fontSize: '11px' }}>{brandsExpanded ? '▲ Hide' : `▼ Show (${catBrands.length})`}</span>
                      </button>

                      {/* Brand list — each brand is clickable → opens brand detail view */}
                      {brandsExpanded && (
                        <div style={{ marginBottom: '12px' }}>
                          {catBrands.length === 0 ? (
                            <div style={{
                              textAlign: 'center', color: '#64748B', fontSize: '12px',
                              padding: '12px', background: '#0F172A', borderRadius: '10px',
                              border: '1px dashed #334155'
                            }}>
                              No brands yet — click "Add Brand" below
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {catBrands.map(brand => {
                                const count = spareParts.filter(
                                  p => p.brand?.toLowerCase() === brand.name.toLowerCase() &&
                                       p.category?.toLowerCase() === cat.name.toLowerCase()
                                ).length;
                                return (
                                  <div key={brand.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {/* Clickable brand row → brand detail view */}
                                    <button
                                      onClick={() => setSelectedBrandView({ categoryId: cat.id, categoryName: cat.name, categoryIcon: cat.icon || '🔧', brand })}
                                      style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: '#0F172A', padding: '9px 12px', borderRadius: '10px',
                                        border: '1px solid #334155', cursor: 'pointer', textAlign: 'left',
                                        transition: 'border-color 0.15s'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.borderColor = '#38BDF8'}
                                      onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px' }}>{brand.logo || '🔧'}</span>
                                        <div>
                                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#F8FAFC' }}>{brand.name}</div>
                                          <div style={{ fontSize: '11px', color: '#64748B' }}>{count} product{count !== 1 ? 's' : ''}</div>
                                        </div>
                                      </div>
                                      <span style={{ color: '#38BDF8', fontSize: '12px', fontWeight: '700' }}>View →</span>
                                    </button>
                                    {/* Delete brand */}
                                    <button
                                      onClick={() => handleDeleteBrand(brand.id, brand.name)}
                                      title="Remove Brand"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '14px', padding: '4px 6px', flexShrink: 0 }}
                                    >✖</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => { setBrandForm({ categoryId: cat.id, categoryName: cat.name, name: '', logo: '🔧' }); setShowBrandModal(true); }}
                          style={{ flex: 1, padding: '7px 10px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                        >➕ Add Brand</button>
                        <button
                          onClick={() => adminApi.deleteSparePartCategory(cat.id).then(() => loadAllData())}
                          style={{ padding: '7px 12px', background: '#1E293B', color: '#EF4444', border: '1px solid #EF4444', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
                        >🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BRANDS MANAGEMENT — REMOVED (brands are now managed inside Categories tab) */}

      {/* TAB (INVENTORY): INVENTORY & STOCK ALERTS */}
      {activeTab === 'inventory' && (        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>⚠️ Inventory Low Stock & Out of Stock Monitor</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
            {spareParts.filter(p => p.stock <= (p.lowStockThreshold || 5)).map(part => (
              <div key={part._id} style={{
                background: '#1E293B', padding: '16px', borderRadius: '14px',
                borderLeft: part.stock === 0 ? '6px solid #EF4444' : '6px solid #F59E0B'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{part.name}</h4>
                    <div style={{ fontSize: '13px', color: '#94A3B8' }}>{part.category} | Supplier: {part.supplierName || 'Not specified'}</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', marginTop: '6px', color: part.stock === 0 ? '#EF4444' : '#F59E0B' }}>
                      Current Stock: {part.stock} (Threshold: {part.lowStockThreshold || 5})
                    </div>
                  </div>
                  <button
                    onClick={() => { setQuickEditId(part._id); setQuickPrice(part.price); setQuickStock(part.stock + 10); setActiveTab('products'); }}
                    style={{ padding: '8px 14px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                  >
                    📦 Restock +10
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOMER ORDERS */}
      {activeTab === 'orders' && (
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>🛒 Customer Spare Part Orders & Lifecycle Management</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {orders.length === 0 ? (
              <div style={{ background: '#1E293B', padding: '30px', borderRadius: '16px', textAlign: 'center', color: '#94A3B8' }}>
                No customer orders placed yet.
              </div>
            ) : (
              orders.map(order => {
                const subtotal = order.partsAmount || order.subtotal || order.items?.reduce((s, i) => s + (i.subtotal || 0), 0) || 0;
                const delCharge = order.deliveryCharge || 0;
                const instFee = order.installationFee || 0;
                const discount = order.discount || 0;
                const grandTotal = order.totalAmount || (subtotal + delCharge + instFee - discount);

                return (
                  <div key={order._id} style={{ background: '#1E293B', padding: '20px', borderRadius: '16px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#38BDF8' }}>{order.orderId}</span>
                        <span style={{ marginLeft: '12px', color: '#94A3B8', fontSize: '13px' }}>
                          Placed: {new Date(order.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700' }}>Change Status:</span>
                        {(() => {
                          const currentStatus = order.orderStatus || 'NEW';
                          const allowed = ALLOWED_TRANSITIONS[currentStatus] || [currentStatus];
                          const isTerminal = currentStatus === 'DELIVERED' || currentStatus === 'CANCELLED';

                          return (
                            <select
                              value={currentStatus}
                              disabled={isTerminal}
                              onChange={(e) => initiateStatusChange(order._id, order.orderId, e.target.value)}
                              style={{
                                padding: '8px 14px', borderRadius: '10px', fontWeight: '700',
                                background: currentStatus === 'DELIVERED' ? '#065F46' : (currentStatus === 'CANCELLED' ? '#7F1D1D' : '#1E40AF'),
                                color: '#fff', border: 'none', cursor: isTerminal ? 'not-allowed' : 'pointer',
                                opacity: isTerminal ? 0.85 : 1
                              }}
                            >
                              {ALL_STATUS_OPTIONS
                                .filter(opt => allowed.includes(opt.value))
                                .map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                            </select>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '12px' }}>
                      {/* Customer Info */}
                      <div style={{ background: '#0F172A', padding: '14px', borderRadius: '12px' }}>
                        <div style={{ fontWeight: '700', color: '#38BDF8', marginBottom: '6px', fontSize: '13px' }}>👤 CUSTOMER & DELIVERY INFO</div>
                        <div style={{ fontWeight: '700', color: '#F8FAFC' }}>{order.customerName}</div>
                        <div style={{ color: '#CBD5E1', fontSize: '13px', marginTop: '2px' }}>📞 {order.customerPhone}</div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px', lineHeight: '1.4' }}>
                          📍 Address: {typeof order.deliveryAddress === 'string' ? order.deliveryAddress : (order.deliveryAddress?.address || 'N/A')}
                        </div>
                      </div>

                      {/* Delivery Worker Assignment */}
                      <div style={{ background: '#0F172A', padding: '14px', borderRadius: '12px' }}>
                        <div style={{ fontWeight: '700', color: '#10B981', marginBottom: '6px', fontSize: '13px' }}>🛵 ASSIGNED DELIVERY WORKER</div>
                        {order.deliveryWorkerName ? (
                          <div>
                            <div style={{ fontWeight: '700', color: '#F8FAFC' }}>{order.deliveryWorkerName}</div>
                            <div style={{ color: '#CBD5E1', fontSize: '13px' }}>📞 {order.deliveryWorkerPhone}</div>
                            {order.orderStatus === 'OUT_FOR_DELIVERY' && (
                              <div style={{ marginTop: '8px', padding: '8px 10px', background: '#0369A1', borderRadius: '8px', border: '1px solid #38BDF8' }}>
                                <div style={{ color: '#F8FAFC', fontSize: '11px', fontWeight: '700' }}>
                                  📍 LIVE GPS TRACKING ACTIVE
                                </div>
                                {order.workerLatitude ? (
                                  <div style={{ color: '#E0F2FE', fontSize: '11px', marginTop: '2px' }}>
                                    Lat: {Number(order.workerLatitude).toFixed(4)}, Lng: {Number(order.workerLongitude).toFixed(4)}
                                    {order.lastLocationUpdate && ` • ${new Date(order.lastLocationUpdate).toLocaleTimeString()}`}
                                  </div>
                                ) : (
                                  <div style={{ color: '#BAE6FD', fontSize: '10px', marginTop: '2px' }}>
                                    Broadcasting worker coordinates to customer app...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: '#F59E0B', fontSize: '13px', fontWeight: '600' }}>
                            No Worker Assigned Yet
                          </div>
                        )}


                        <div style={{ marginTop: '10px' }}>
                          <select
                            onChange={(e) => e.target.value && handleAssignWorker(order._id, e.target.value)}
                            defaultValue=""
                            style={{ ...selectStyle, width: '100%', fontSize: '12px', padding: '6px 10px' }}
                          >
                            <option value="" disabled>Select Worker to Assign...</option>
                            {workersList.map(w => (
                              <option key={w._id || w.workerId} value={w._id || w.workerId}>
                                {w.name} ({w.category || 'Worker'})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Payment & Price Breakdown */}
                      <div style={{ background: '#0F172A', padding: '14px', borderRadius: '12px' }}>
                        <div style={{ fontWeight: '700', color: '#A855F7', marginBottom: '6px', fontSize: '13px' }}>💰 PAYMENT & ITEMIZED BREAKDOWN</div>
                        <div style={{ fontSize: '12px', color: '#CBD5E1', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>Product Subtotal:</span> <span>₹{subtotal}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#CBD5E1', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>Delivery Charge:</span> <span>₹{delCharge}</span>
                        </div>
                        {instFee > 0 && (
                          <div style={{ fontSize: '12px', color: '#A855F7', display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: '700' }}>
                            <span>Technician Installation Fee:</span> <span>₹{instFee}</span>
                          </div>
                        )}
                        {discount > 0 && (
                          <div style={{ fontSize: '12px', color: '#EF4444', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span>Discount:</span> <span>-₹{discount}</span>
                          </div>
                        )}
                        <div style={{ borderTop: '1px solid #334155', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', color: '#10B981' }}>
                          <span>Total Amount ({order.paymentMethod || 'COD'}):</span> <span>₹{grandTotal}</span>
                        </div>
                        <div style={{ fontSize: '12px', marginTop: '4px', textAlign: 'right' }}>
                          Payment Status: <span style={{ fontWeight: '700', color: order.paymentStatus === 'PAID' ? '#10B981' : '#F59E0B' }}>
                            {order.paymentStatus === 'PAID' ? '✅ PAID' : '⌛ PENDING (COD)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ordered Items */}
                    <div style={{ background: '#0F172A', padding: '12px', borderRadius: '10px', marginBottom: '12px' }}>
                      <div style={{ fontWeight: '700', color: '#94A3B8', fontSize: '12px', marginBottom: '8px' }}>ORDERED ITEMS ({order.items?.length || 0})</div>
                      {order.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: idx < order.items.length - 1 ? '1px solid #1E293B' : 'none' }}>
                          <span style={{ color: '#F8FAFC' }}>• {item.partName} <span style={{ color: '#94A3B8' }}>(Qty: {item.quantity})</span></span>
                          <span style={{ fontWeight: '700', color: '#38BDF8' }}>₹{item.subtotal}</span>
                        </div>
                      ))}
                    </div>

                    {/* Order Status History Timeline */}
                    {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
                      <div style={{ background: '#0F172A', padding: '12px', borderRadius: '10px' }}>
                        <div style={{ fontWeight: '700', color: '#94A3B8', fontSize: '12px', marginBottom: '8px' }}>⏳ STATUS HISTORY TIMELINE</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {order.statusHistory.map((h, hIdx) => (
                            <div key={hIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderLeft: '3px solid #38BDF8', paddingLeft: '8px' }}>
                              <div>
                                <span style={{ fontWeight: '700', color: '#38BDF8' }}>{h.status}</span> - <span style={{ color: '#CBD5E1' }}>{h.note || 'Updated'}</span>
                              </div>
                              <div style={{ color: '#64748B' }}>
                                {new Date(h.timestamp).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR ORDER STATUS CHANGE */}
      {confirmModal.show && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '450px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#F8FAFC' }}>
              Confirm Status Transition
            </h3>
            <p style={{ color: '#CBD5E1', fontSize: '15px', margin: '0 0 20px 0', lineHeight: '1.5' }}>
              Confirm changing order <b>{confirmModal.orderNum}</b> status to <b style={{ color: '#38BDF8' }}>{confirmModal.targetStatus}</b>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setConfirmModal({ show: false, orderId: null, orderNum: '', targetStatus: '' })}
                style={btnCancelStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                style={btnSaveStyle}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', margin: 0 }}>Private Suppliers Directory</h2>
            <button onClick={() => setShowSupplierModal(true)} style={{ padding: '10px 18px', background: '#38BDF8', color: '#0F172A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' }}>
              ➕ Add Supplier
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {suppliers.map(s => (
              <div key={s._id} style={{ background: '#1E293B', padding: '20px', borderRadius: '16px', border: '1px solid #334155' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#38BDF8' }}>{s.name}</h3>
                <div style={{ fontSize: '13px', color: '#CBD5E1', marginBottom: '4px' }}>📞 Phone: {s.phone}</div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', marginBottom: '4px' }}>✉️ Email: {s.email || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', marginBottom: '4px' }}>📍 Address: {s.address || 'N/A'}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px', background: '#0F172A', padding: '8px', borderRadius: '8px' }}>
                  Notes: {s.notes || 'None'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: WORKER REQUESTS */}
      {activeTab === 'requests' && (
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>🔧 Technician Spare Part Field Requests</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.map(req => (
              <div key={req._id} style={{ background: '#1E293B', padding: '16px', borderRadius: '14px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{req.partName} (Qty: {req.quantity})</h4>
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                    Requested by <b>{req.workerName}</b> for Booking #{req.bookingId} | Reason: {req.reason}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                    background: req.status === 'APPROVED' ? '#065F46' : (req.status === 'REJECTED' ? '#7F1D1D' : '#D97706')
                  }}>
                    {req.status}
                  </span>
                  {req.status === 'PENDING' && (
                    <>
                      <button onClick={() => handleWorkerRequestAction(req._id, 'APPROVED')} style={{ padding: '6px 12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Approve</button>
                      <button onClick={() => handleWorkerRequestAction(req._id, 'REJECTED')} style={{ padding: '6px 12px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Reject</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SPARE PART */}
      {showAddModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>{editingPart ? '✏️ Edit Spare Part' : '➕ Add New Spare Part'}</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>✖</button>
            </div>

            <form onSubmit={handleSavePart} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Part Name *</label>
                <input type="text" required value={partForm.name} onChange={e => setPartForm({ ...partForm, name: e.target.value })} style={inputStyle} placeholder="e.g. LG AC Capacitor 25µF" />
              </div>

              <div>
                <label style={labelStyle}>Category *</label>
                <select value={partForm.category} onChange={e => setPartForm({ ...partForm, category: e.target.value, brand: '' })} style={selectStyle}>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Brand / Manufacturer</label>
                {(() => {
                  const catBrands = brands.filter(b =>
                    b.categoryName?.toLowerCase() === partForm.category?.toLowerCase() ||
                    categories.find(c => c.name === partForm.category)?.id === b.categoryId
                  );
                  return catBrands.length > 0 ? (
                    <select value={partForm.brand} onChange={e => setPartForm({ ...partForm, brand: e.target.value })} style={selectStyle}>
                      <option value="">-- Select Brand --</option>
                      {catBrands.map(b => <option key={b.id} value={b.name}>{b.logo} {b.name}</option>)}
                      <option value="__other__">➕ Other (type manually)</option>
                    </select>
                  ) : (
                    <div>
                      <input type="text" value={partForm.brand} onChange={e => setPartForm({ ...partForm, brand: e.target.value })} style={inputStyle} placeholder="e.g. LG, Samsung, IFB" />
                      <div style={{ color: '#64748B', fontSize: '11px', marginTop: '4px' }}>
                        💡 No brands added for this category yet. <span style={{ color: '#38BDF8', cursor: 'pointer' }} onClick={() => { setShowAddModal(false); setShowBrandModal(true); setBrandForm({ ...brandForm, categoryName: partForm.category, categoryId: categories.find(c => c.name === partForm.category)?.id || '' }); }}>Add brands in Brands tab →</span>
                      </div>
                    </div>
                  );
                })()}
                {partForm.brand === '__other__' && (
                  <input type="text" onChange={e => setPartForm({ ...partForm, brand: e.target.value })} style={{ ...inputStyle, marginTop: '8px' }} placeholder="Type brand name manually..." autoFocus />
                )}
              </div>

              <div>
                <label style={labelStyle}>Part Number / SKU</label>
                <input type="text" value={partForm.partNumber} onChange={e => setPartForm({ ...partForm, partNumber: e.target.value })} style={inputStyle} placeholder="e.g. EAE31131507" />
              </div>

              <div>
                <label style={labelStyle}>Quality Grade</label>
                <select value={partForm.quality} onChange={e => setPartForm({ ...partForm, quality: e.target.value })} style={selectStyle}>
                  <option value="Original">Original Brand Genuine</option>
                  <option value="OEM">OEM Grade A+</option>
                  <option value="Compatible">Universal Compatible</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Selling Price (₹) *</label>
                <input type="number" required value={partForm.price} onChange={e => setPartForm({ ...partForm, price: e.target.value })} style={inputStyle} placeholder="499" />
              </div>

              <div>
                <label style={labelStyle}>Discount Price (Optional ₹)</label>
                <input type="number" value={partForm.discountPrice} onChange={e => setPartForm({ ...partForm, discountPrice: e.target.value })} style={inputStyle} placeholder="450" />
              </div>

              <div>
                <label style={labelStyle}>Stock Quantity *</label>
                <input type="number" required value={partForm.stock} onChange={e => setPartForm({ ...partForm, stock: e.target.value })} style={inputStyle} placeholder="15" />
              </div>

              <div>
                <label style={labelStyle}>Low Stock Alert Threshold</label>
                <input type="number" value={partForm.lowStockThreshold} onChange={e => setPartForm({ ...partForm, lowStockThreshold: e.target.value })} style={inputStyle} placeholder="5" />
              </div>

              <div>
                <label style={labelStyle}>Warranty Period</label>
                <input type="text" value={partForm.warranty} onChange={e => setPartForm({ ...partForm, warranty: e.target.value })} style={inputStyle} placeholder="6 Months Warranty" />
              </div>

              <div>
                <label style={labelStyle}>AC Type</label>
                <select value={partForm.acType || 'All Types'} onChange={e => setPartForm({ ...partForm, acType: e.target.value })} style={selectStyle}>
                  <option value="All Types">All Types</option>
                  <option value="Inverter">Inverter</option>
                  <option value="Non-Inverter">Non-Inverter</option>
                  <option value="Heat Pump">Heat Pump</option>
                  <option value="Cassette">Cassette AC</option>
                  <option value="Window AC">Window AC</option>
                  <option value="Portable">Portable AC</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>AC Capacity</label>
                <select value={partForm.acCapacity || ''} onChange={e => setPartForm({ ...partForm, acCapacity: e.target.value })} style={selectStyle}>
                  <option value="">Universal (All Tons)</option>
                  <option value="0.75 Ton">0.75 Ton</option>
                  <option value="1 Ton">1 Ton</option>
                  <option value="1.5 Ton">1.5 Ton</option>
                  <option value="2 Ton">2 Ton</option>
                  <option value="2.5 Ton">2.5 Ton</option>
                  <option value="1 Ton, 1.5 Ton">1 Ton, 1.5 Ton</option>
                  <option value="1 Ton, 1.5 Ton, 2 Ton">1 Ton, 1.5 Ton, 2 Ton</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Compatible Models (Comma separated)</label>
                <input type="text" value={partForm.compatibleModels} onChange={e => setPartForm({ ...partForm, compatibleModels: e.target.value })} style={inputStyle} placeholder="LG 1.5 Ton Split AC, LG 2 Ton Split AC" />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Photo Image URL</label>
                <input type="text" value={partForm.photo} onChange={e => setPartForm({ ...partForm, photo: e.target.value })} style={inputStyle} placeholder="https://..." />
              </div>

              {/* Private Supplier Info */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #334155', paddingTop: '12px', marginTop: '6px' }}>
                <h4 style={{ color: '#38BDF8', margin: '0 0 10px 0' }}>🔒 Private Supplier & Cost Info (Admin Only)</h4>
              </div>

              <div>
                <label style={labelStyle}>Supplier Name</label>
                <input type="text" value={partForm.supplierName} onChange={e => setPartForm({ ...partForm, supplierName: e.target.value })} style={inputStyle} placeholder="CoolTech Components" />
              </div>

              <div>
                <label style={labelStyle}>Purchase Cost (₹)</label>
                <input type="number" value={partForm.purchasePrice} onChange={e => setPartForm({ ...partForm, purchasePrice: e.target.value })} style={inputStyle} placeholder="280" />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={btnCancelStyle}>Cancel</button>
                <button type="submit" style={btnSaveStyle}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CATEGORY */}
      {showCategoryModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>➕ Add Spare Parts Category</h3>
            <form onSubmit={handleAddCategory}>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Category Name</label>
                <input type="text" required value={catName} onChange={e => setCatName(e.target.value)} style={inputStyle} placeholder="e.g. Microwave Oven Parts" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Icon Emoji</label>
                <input type="text" value={catIcon} onChange={e => setCatIcon(e.target.value)} style={inputStyle} placeholder="🔌" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowCategoryModal(false)} style={btnCancelStyle}>Cancel</button>
                <button type="submit" style={btnSaveStyle}>Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BRAND */}
      {showBrandModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>🏷️ Add Brand to Category</h3>
              <button onClick={() => setShowBrandModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>✖</button>
            </div>
            <form onSubmit={handleAddBrand}>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Category *</label>
                <select
                  required
                  value={brandForm.categoryId}
                  onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value);
                    setBrandForm({ ...brandForm, categoryId: e.target.value, categoryName: cat?.name || '' });
                  }}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="">Select a Category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Brand Name *</label>
                <input
                  type="text" required
                  value={brandForm.name}
                  onChange={e => setBrandForm({ ...brandForm, name: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. LG, Samsung, Voltas"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Logo / Icon Emoji</label>
                <input
                  type="text"
                  value={brandForm.logo}
                  onChange={e => setBrandForm({ ...brandForm, logo: e.target.value })}
                  style={inputStyle}
                  placeholder="🔧"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowBrandModal(false)} style={btnCancelStyle}>Cancel</button>
                <button type="submit" style={btnSaveStyle}>Add Brand</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showSupplierModal && (        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '500px' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>➕ Add Private Supplier</h3>
            <form onSubmit={handleAddSupplier}>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Supplier Name *</label>
                <input type="text" required value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} style={inputStyle} placeholder="Apex Spares" />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Phone</label>
                <input type="text" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} style={inputStyle} placeholder="9848012345" />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} style={inputStyle} placeholder="supplier@gmail.com" />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Address</label>
                <input type="text" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} style={inputStyle} placeholder="Hyderabad Market" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={supplierForm.notes} onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })} style={{ ...inputStyle, height: '60px' }} placeholder="Notes..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowSupplierModal(false)} style={btnCancelStyle}>Cancel</button>
                <button type="submit" style={btnSaveStyle}>Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const cardStyle = {
  background: '#1E293B',
  padding: '16px',
  borderRadius: '16px',
  border: '1px solid #334155',
  textAlign: 'center'
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  background: '#0F172A',
  border: '1px solid #334155',
  color: '#F8FAFC',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box'
};

const selectStyle = {
  padding: '10px 14px',
  borderRadius: '10px',
  background: '#0F172A',
  border: '1px solid #334155',
  color: '#F8FAFC',
  fontSize: '14px',
  outline: 'none'
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '700',
  color: '#94A3B8',
  marginBottom: '4px'
};

const btnSaveStyle = {
  padding: '10px 20px',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #10B981, #059669)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '700'
};

const btnCancelStyle = {
  padding: '10px 20px',
  borderRadius: '10px',
  background: '#334155',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '600'
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.85)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  padding: '20px'
};

const modalContentStyle = {
  background: '#1E293B',
  borderRadius: '20px',
  padding: '24px',
  width: '100%',
  maxWidth: '700px',
  maxHeight: '90vh',
  overflowY: 'auto',
  border: '1px solid #334155',
  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
};
