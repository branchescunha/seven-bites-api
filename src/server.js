import app from './app.js';
import './database/index.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`Application is running at port ${env.port}`);
});
