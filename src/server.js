import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.info(`Application is running at port ${env.port}`);
});
