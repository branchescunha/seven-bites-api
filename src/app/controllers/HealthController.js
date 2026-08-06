import database from '../../database/index.js';
import { buildHealthPayload, buildReadyPayload } from '../services/health.js';

class HealthController {
  show(_request, response) {
    return response.status(200).json(buildHealthPayload());
  }

  async ready(_request, response) {
    const checks = await database.checkConnections();
    const readiness = buildReadyPayload(checks);

    return response.status(readiness.statusCode).json(readiness.body);
  }
}

export default new HealthController();
