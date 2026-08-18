import { bootstrapHttp } from './main.http';
import { bootstrapWorker } from './main.worker';

const mode = process.env.MODE === 'worker' ? 'worker' : 'http';

void (mode === 'worker' ? bootstrapWorker() : bootstrapHttp());
