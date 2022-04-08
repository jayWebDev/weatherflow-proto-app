const express = require('express');
cors = require('cors');
const { errorHandler } = require('./middleware/errorMiddleware');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const port = process.env.PORT || 3000;

const app = express();
const corsOptions = {
  origin: ['http://127.0.0.1:5500', 'https://shoreco.dev/', 'localhost'],
	optionsSuccessStatus: 200
}
app.use(cors(corsOptions));

app.use('/weatherflow/api-wrapper', require('./routes/weatherflow-routes'));

app.use(errorHandler);

app.listen(port, () => console.log(`Server started on port ${port}`));