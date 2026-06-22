/**
 * FixoN Demo Data Seeder
 * Run: node seed_demo_data.js
 * Seeds 12 realistic bookings + 3 users + ratings into the live server
 */

const BASE = 'http://localhost:5000';

const demoBookings = [
  { userId:'U_DEMO_1', userName:'Ravi Kumar', userPhone:'9876500001', service:'Plumbing', description:'Kitchen pipe leak repair', address:'Ameerpet, Hyderabad', city:'Hyderabad', price:499, status:'completed', workerId:'W_DEFAULT_1', workerName:'VARUN', rating:5, ratingComment:'Excellent work, fixed very quickly!', couponCode:null, discount:0, createdAt:'2026-05-18T09:15:00.000Z', completedAt:'2026-05-18T11:30:00.000Z' },
  { userId:'U_DEMO_2', userName:'Priya Reddy', userPhone:'9876500002', service:'Electrical', description:'Fan installation in bedroom', address:'Banjara Hills, Hyderabad', city:'Hyderabad', price:599, status:'completed', workerId:'W_DEFAULT_2', workerName:'ADITHYA', rating:4, ratingComment:'Good service, on time.', couponCode:'FIRST50', discount:50, createdAt:'2026-05-20T14:00:00.000Z', completedAt:'2026-05-20T16:00:00.000Z' },
  { userId:'U_DEMO_3', userName:'Suresh Babu', userPhone:'9876500003', service:'Cleaning', description:'2 BHK deep cleaning', address:'Hanamkonda, Warangal', city:'Warangal', price:2199, status:'completed', workerId:'W_DEFAULT_3', workerName:'Prasad Cleaning', rating:5, ratingComment:'Spotless! Very professional team.', couponCode:'FIXON10', discount:220, createdAt:'2026-05-22T08:00:00.000Z', completedAt:'2026-05-22T13:00:00.000Z' },
  { userId:'U_DEMO_1', userName:'Ravi Kumar', userPhone:'9876500001', service:'AC Repair', description:'AC not cooling — gas refill needed', address:'Ameerpet, Hyderabad', city:'Hyderabad', price:2499, status:'completed', workerId:'W_DEFAULT_4', workerName:'Vijay Tech', rating:5, ratingComment:'Vijay is the best! AC is ice cold now.', couponCode:null, discount:0, createdAt:'2026-05-26T10:00:00.000Z', completedAt:'2026-05-26T12:30:00.000Z' },
  { userId:'U_DEMO_2', userName:'Priya Reddy', userPhone:'9876500002', service:'Carpentry', description:'Wardrobe door hinge repair', address:'Karimnagar Main Rd, Karimnagar', city:'Karimnagar', price:699, status:'completed', workerId:'W_DEFAULT_5', workerName:'Mahesh Carpenter', rating:4, ratingComment:'Quick fix. Happy with the result.', couponCode:null, discount:0, createdAt:'2026-06-01T11:00:00.000Z', completedAt:'2026-06-01T13:00:00.000Z' },
  { userId:'U_DEMO_3', userName:'Suresh Babu', userPhone:'9876500003', service:'Electrical', description:'Home safety wiring check', address:'Nizamabad Bus Stand Area', city:'Nizamabad', price:1999, status:'completed', workerId:'W_DEFAULT_2', workerName:'ADITHYA', rating:5, ratingComment:'Very thorough and safe!', couponCode:'FIXON10', discount:200, createdAt:'2026-06-04T09:30:00.000Z', completedAt:'2026-06-04T12:00:00.000Z' },
  { userId:'U_DEMO_1', userName:'Ravi Kumar', userPhone:'9876500001', service:'Pest Control', description:'Full house cockroach treatment', address:'Ameerpet, Hyderabad', city:'Hyderabad', price:999, status:'completed', workerId:'W_DEFAULT_3', workerName:'Prasad Cleaning', rating:4, ratingComment:'Effective spray, no pests since.', couponCode:'SUMMER25', discount:250, createdAt:'2026-06-07T10:00:00.000Z', completedAt:'2026-06-07T11:30:00.000Z' },
  { userId:'U_DEMO_2', userName:'Priya Reddy', userPhone:'9876500002', service:'Plumbing', description:'Full bathroom polish + leak fix', address:'Banjara Hills, Hyderabad', city:'Hyderabad', price:1499, status:'completed', workerId:'W_DEFAULT_1', workerName:'VARUN', rating:5, ratingComment:'VARUN bhai is amazing! Best plumber.', couponCode:null, discount:0, createdAt:'2026-06-10T08:00:00.000Z', completedAt:'2026-06-10T11:00:00.000Z' },
  { userId:'U_DEMO_3', userName:'Suresh Babu', userPhone:'9876500003', service:'AC Repair', description:'AC basic service and filter clean', address:'Warangal City Center', city:'Warangal', price:799, status:'completed', workerId:'W_DEFAULT_4', workerName:'Vijay Tech', rating:5, ratingComment:'Punctual and efficient!', couponCode:null, discount:0, createdAt:'2026-06-12T14:00:00.000Z', completedAt:'2026-06-12T16:00:00.000Z' },
  { userId:'U_DEMO_1', userName:'Ravi Kumar', userPhone:'9876500001', service:'Cleaning', description:'1 BHK home cleaning', address:'Ameerpet, Hyderabad', city:'Hyderabad', price:1299, status:'completed', workerId:'W_DEFAULT_3', workerName:'Prasad Cleaning', rating:4, ratingComment:'Good cleaning, satisfied.', couponCode:'FIRST50', discount:50, createdAt:'2026-06-14T09:00:00.000Z', completedAt:'2026-06-14T11:30:00.000Z' },
  { userId:'U_DEMO_2', userName:'Priya Reddy', userPhone:'9876500002', service:'Electrical', description:'3 switch board repair', address:'Banjara Hills, Hyderabad', city:'Hyderabad', price:599, status:'accepted', workerId:'W_DEFAULT_2', workerName:'ADITHYA', couponCode:null, discount:0, createdAt:'2026-06-15T16:00:00.000Z' },
  { userId:'U_DEMO_3', userName:'Suresh Babu', userPhone:'9876500003', service:'Carpentry', description:'Wooden shelf installation', address:'Khammam Town', city:'Khammam', price:699, status:'pending', couponCode:null, discount:0, createdAt:'2026-06-16T07:45:00.000Z' },
];

async function seed() {
  console.log('🌱 FixoN Demo Data Seeder Starting...\n');

  // Check server is running
  try {
    const ping = await fetch(`${BASE}/api/bookings`);
    if (!ping.ok) throw new Error('Server not OK');
    console.log('✅ Server is running on port 5000\n');
  } catch {
    console.error('❌ Server is NOT running! Start it first: node server.js');
    process.exit(1);
  }

  // Check if already seeded
  const existing = await fetch(`${BASE}/api/bookings`).then(r => r.json());
  const existingList = existing.bookings || existing || [];
  const alreadySeeded = existingList.some(b => b._id?.startsWith('BK_DEMO_'));
  if (alreadySeeded) {
    console.log('ℹ️  Demo data already seeded. Skipping duplicate insert.\n');
    console.log(`📊 Total bookings in DB: ${existingList.length}`);
    return;
  }

  let successCount = 0;
  let bookingIds = [];

  // Seed bookings
  for (const booking of demoBookings) {
    try {
      const res = await fetch(`${BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      });
      const data = await res.json();
      if (data.success || data._id || data.booking) {
        const id = data._id || data.booking?._id;
        bookingIds.push({ id, service: booking.service, workerId: booking.workerId, rating: booking.rating, comment: booking.ratingComment });
        successCount++;
        process.stdout.write(`  ✅ Booking ${successCount}: ${booking.service} - ${booking.status}\n`);
      } else {
        console.log(`  ⚠️  ${booking.service}: ${JSON.stringify(data)}`);
      }
    } catch(e) {
      console.log(`  ❌ Failed: ${booking.service} — ${e.message}`);
    }
  }

  // Seed ratings for completed bookings
  console.log('\n🌟 Seeding ratings...');
  for (const b of bookingIds) {
    if (!b.rating || !b.workerId || !b.id) continue;
    try {
      await fetch(`${BASE}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: b.id, workerId: b.workerId, rating: b.rating, comment: b.comment }),
      });
      process.stdout.write(`  ⭐ Rating posted: ${b.rating}/5 for ${b.workerId}\n`);
    } catch { /* ignore rating errors */ }
  }

  console.log(`\n🎉 Seeding complete! ${successCount}/${demoBookings.length} bookings created.`);
  console.log('📊 Refresh your Admin Panel to see live charts!');
  console.log('   http://localhost:3000 → Analytics\n');
}

seed().catch(console.error);
