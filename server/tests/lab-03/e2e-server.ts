import { assertTestEnvironment } from './safety.js';
import setup from './global-setup.js';
// No fixture/reset endpoints are exposed by the application.
assertTestEnvironment();
if (process.env.PORT !== '3101' || process.env.FRONTEND_ORIGIN !== 'http://localhost:5174') throw new Error('E2E requires dedicated app ports.');
await setup();
const { app } = await import('../../src/app.js');
app.listen(3101, 'localhost');
