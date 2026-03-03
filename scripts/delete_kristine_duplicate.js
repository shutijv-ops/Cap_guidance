const mongoose = require('mongoose');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';
// Default admin identifiers (can be overridden via env)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'kristine.carl';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

async function run(){
  try{
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const Counselor = require(path.join(__dirname, '..', 'models', 'counselors'));

    const filters = [];
    if (ADMIN_USERNAME) filters.push({ username: ADMIN_USERNAME });
    if (ADMIN_EMAIL) filters.push({ email: ADMIN_EMAIL });
    // name match (first + last)
    filters.push({ $and: [ { firstName: { $regex: 'Kristine', $options: 'i' } }, { lastName: { $regex: 'Lopez', $options: 'i' } } ] });

    const query = { $or: filters };

    const found = await Counselor.find(query).lean();
    if (!found || found.length === 0){
      console.log('No matching counselor documents found. Nothing to delete.');
      process.exit(0);
    }

    console.log('Found counselor documents to delete:');
    found.forEach(d => console.log(JSON.stringify(d, null, 2)));

    // Delete the found documents
    const ids = found.map(d => d._id);
    const delRes = await Counselor.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${delRes.deletedCount} counselor document(s).`);

    process.exit(0);
  }catch(e){
    console.error('Error:', e);
    process.exit(1);
  }
}

run();
