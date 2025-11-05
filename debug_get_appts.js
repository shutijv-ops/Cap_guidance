const http = require('http');

http.get('http://localhost:3000/api/appointments', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try{
      const obj = JSON.parse(data);
      const appts = obj.appointments || [];
      const filtered = appts.filter(a => a.date === '2025-11-28');
      console.log(JSON.stringify(filtered, null, 2));
    }catch(e){ console.error('Failed to parse', e, data); }
  });
}).on('error', err => console.error(err));
