const mongoose = require('mongoose');
const Admin = require('./models/admins');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jrmsu_appointments';
(async ()=>{
  try{
    await mongoose.connect(MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
    const a = await Admin.findOne({}).lean().exec();
    console.log('Admin doc:', a);
    await mongoose.disconnect();
  }catch(e){
    console.error(e);
    process.exit(1);
  }
})();
