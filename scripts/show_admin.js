const mongoose = require('mongoose');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';

async function run(){
  try{
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    const Admin = require(path.join(__dirname, '..', 'models', 'admins'));
    const admin = await Admin.findOne({}).lean();
    if(!admin){
      console.log('No Admin document found in DB');
    } else {
      console.log('Admin document:');
      console.log(JSON.stringify(admin, null, 2));
    }
    process.exit(0);
  }catch(e){
    console.error('Error:', e);
    process.exit(1);
  }
}

run();
