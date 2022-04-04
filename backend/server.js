const express = require('express');
cors = require('cors');
const { errorHandler } = require('./middleware/errorMiddleware');
const dotenv = require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();
const corsOptions = {
  origin: 'http://127.0.0.1:5500',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
app.use(cors(corsOptions));

app.use('/weatherflow/api-wrapper', require('./routes/weatherflow-routes'));

app.use(errorHandler);

app.listen(port, () => console.log(`Server started on port ${port}`));