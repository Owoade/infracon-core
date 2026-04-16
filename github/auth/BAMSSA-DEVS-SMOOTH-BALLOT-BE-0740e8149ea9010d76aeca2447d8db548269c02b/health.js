const axios = require('axios');
const {Agent} = require('https');

(async ()=> {

    axios.defaults.httpAgent = new Agent({ keepAlive: false });

    const res = await axios.get("http://127.0.0.1:3000");

    console.log(res.data)
})()