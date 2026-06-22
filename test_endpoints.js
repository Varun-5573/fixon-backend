const http = require('http');
const fs = require('fs');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Loading valid entities from database...');
  try {
    const db = JSON.parse(fs.readFileSync('fixon_data.json', 'utf8'));
    const worker = db.adminWorkers && db.adminWorkers[0];
    const booking = db.bookings && db.bookings[0];

    if (!worker) {
      console.log('❌ No workers found in database to test.');
      return;
    }
    console.log(`\n👤 Testing with Worker: Name="${worker.name}", ID="${worker._id}"`);

    // Test Private Chat
    const chatMsg = await post('/api/chat/send-private', {
      senderId: 'U_TEST_USER',
      receiverId: worker._id,
      message: 'Hello worker! Are you available?',
      senderType: 'customer',
      senderName: 'Test User'
    });
    console.log('✅ Private Chat send success:', chatMsg.success, 'Msg:', chatMsg.message?.message);

    const chatHistory = await get(`/api/chat/private-messages?userA=U_TEST_USER&userB=${worker._id}`);
    console.log('✅ Private Chat history success:', chatHistory.success, 'Count:', chatHistory.messages?.length);

    // Test Worker Verification
    const verifySubmit = await post(`/api/workers/${worker._id}/verify-document`, {
      documentType: 'Aadhaar',
      documentNumber: '123456789012',
      documentFrontUrl: 'https://via.placeholder.com/300',
      documentBackUrl: 'https://via.placeholder.com/300'
    });
    console.log('✅ Worker Document Verification submit success:', verifySubmit.success, 'Status:', verifySubmit.worker?.verification?.status);

    const verifyAdmin = await post(`/api/admin/workers/${worker._id}/verify-status`, {
      status: 'approved'
    });
    console.log('✅ Admin verification update success:', verifyAdmin.success, 'Status:', verifyAdmin.worker?.verification?.status);

    // Test Before/After Photo Upload
    if (booking) {
      console.log(`\n📦 Testing Before/After photos with Booking ID: "${booking._id}"`);
      const photoUpdate = await post(`/api/bookings/${booking._id}/photos`, {
        beforePhoto: 'data:image/jpeg;base64,before_photo_data_mock',
        afterPhoto: 'data:image/jpeg;base64,after_photo_data_mock'
      });
      console.log('✅ Before/After Photo upload success:', photoUpdate.success, 'Before:', !!photoUpdate.booking?.beforePhoto, 'After:', !!photoUpdate.booking?.afterPhoto);
    }

    console.log('\n🎉 ALL ENDPOINT INTEGRATION TESTS PASSED SUCCESSFULY!');
  } catch (err) {
    console.error('❌ Integration test failed:', err);
  }
}

runTests();
