const axios = require('axios');
const asyncHandler = require('express-async-handler');

const getData = asyncHandler(async (req, res) => {
	const query = req.query;
	let queryString = '';
	
	Object.entries(query).map(([key, value]) => queryString += `&${key}=${value}`);
	
	const url = `https://api.weatherflow.com/wxengine/rest/spot/getSpotDetailSetByZoomLevel?wf_token=${process.env.WF_TOKEN}${queryString}`;

	try {
		const response = await axios.get(url);
		
		res.status(200).json(response.data);
	} catch (error) {
		res.status(400);

    throw new Error('There was a problem retrieving the data.')
  }
})

module.exports = {
	getData,
}